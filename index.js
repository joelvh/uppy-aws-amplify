import { Plugin } from '@uppy/core'
import Translator from '@uppy/utils/lib/Translator'
import limitPromises from '@uppy/utils/lib/limitPromises'
import settle from '@uppy/utils/lib/settle'
import { Storage } from 'aws-amplify'

export default class AwsAmplify extends Plugin {
  constructor (uppy, opts) {
    super(uppy, opts)

    this.type = 'uploader'
    this.id = 'AwsAmplify'
    this.title = 'AWS Amplify Storage'

    const defaultLocale = {
      strings: {
        preparingUpload: 'Preparing upload...'
      }
    }

    const defaultOptions = {
      limit: 0,
      getUploadParameters: this.getUploadParameters.bind(this),
      locale: defaultLocale
    }

    this.opts = { ...defaultOptions, ...opts }

    // i18n
    this.translator = new Translator([ defaultLocale, this.uppy.locale, this.opts.locale ])
    this.i18n = this.translator.translate.bind(this.translator)
    this.i18nArray = this.translator.translateArray.bind(this.translator)

    this.handleUpload = this.handleUpload.bind(this)

    if (typeof this.opts.limit === 'number' && this.opts.limit !== 0) {
      this.limitRequests = limitPromises(this.opts.limit)
    } else {
      this.limitRequests = (fn) => fn
    }
  }

  async getUploadParameters (file) {
    return {
      filename: `${Date.now()}-${file.name}`
    }
  }

  validateParameters (file, params) {
    return params
  }

  prepareUpload (fileIDs) {
    fileIDs.forEach((id) => {
      this.uppy.emit('preprocess-progress', this.uppy.getFile(id), {
        mode: 'determinate',
        message: this.i18n('preparingUpload'),
        value: 0
      })
    })

    const getUploadParameters = this.limitRequests(this.opts.getUploadParameters)

    return Promise.all(
      fileIDs.map(id => {
        const file = this.uppy.getFile(id)

        return Promise.resolve()
          .then(() => getUploadParameters(file))
          .then(params => {
            this.uppy.emit('preprocess-progress', file, {
              mode: 'determinate',
              message: this.i18n('preparingUpload'),
              value: 1
            })
            return { ...params, id }
          }).catch(error => {
            this.uppy.emit('upload-error', file, error)
          })
      })
    ).then(paramsCollection => {
      fileIDs.forEach(id => this.uppy.emit('preprocess-complete', this.uppy.getFile(id)))
      return paramsCollection
    })
  }

  handleFileUpload (filename, file, position, total) {
    this.uppy.log(`[AwsAmplify] Uploading ${position} of ${total}`)

    return Storage.put(filename, file.data, {
      contentType: file.type,
      progressCallback (progress) {
        if (!this.uppy.getFile(file.id)) {
          throw new Error('File removed?')
        }
        this.uppy.emit('upload-progress', file, {
          uploader: this,
          bytesUploaded: progress.loaded,
          bytesTotal: progress.total
        })
      }
    })
      .then(body => {
        return Storage.get(body.key, { download: false })
          .then(uploadURL => {
            this.uppy.emit('upload-success', file, {
              body,
              uploadURL
            })
          })
          .catch(err => {
            this.uppy.emit('upload-error', file, {
              body: err
            })
          })
      })
      .catch(err => {
        this.uppy.emit('upload-error', file, err)
      })
  }

  handleUpload (fileIDs) {
    if (fileIDs.length === 0) {
      this.uppy.log('[AwsAmplify] No files to upload!')
      return Promise.resolve()
    }

    this.uppy.log('[AwsAmplify] Uploading...')

    return this.prepareUpload(fileIDs).then(paramsCollection => {
      return paramsCollection.map(({ id, filename }, index) => {
        const file = this.uppy.getFile(id)

        if (file.error) {
          return () => Promise.reject(new Error(file.error))
        } else {
          // We emit upload-started here, so that it's also emitted for files
          // that have to wait due to the `limit` option.
          this.uppy.emit('upload-started', file)
          return this.handleFileUpload.bind(this, filename, file, index + 1, paramsCollection.length)
        }
      })
    })
      .then(actions => actions.map(action => this.limitRequests(action)()))
      .then(promises => settle(promises))
      .then(() => null)
  }

  install () {
    this.uppy.addUploader(this.handleUpload)
  }

  uninstall () {
    this.uppy.removeUploader(this.handleUpload)
  }
}
