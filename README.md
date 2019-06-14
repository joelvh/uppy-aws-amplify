# uppy-aws-amplify

The AWS Amplify Storage (S3) plugin for [uppy](https://uppy.io) which can be used to upload files directly to an S3 bucket using an AWS Amplify session.

This package uses `Storage` from the `aws-amplify` package under the hood, which will use the default configuration you're using for AWS Amplify in your app.

Supports Uppy v1.0

## Example

```es6
const Uppy = require('@uppy/core')
const AwsS3 = require('uppy-aws-amplify')
import { Storage } from 'aws-amplify'

const uppy = Uppy()
uppy.use(AwsAmplify, {
  // configured AWS Amplify Storage reference
  // with `get` and `put` methods
  storage: Storage,
  // default options passed to `Storage.get(...)`
  getOptions: {
    download: false
  },
  limit: 4,
  async getUploadParameters (file) {
    return {
      // Example: to avoid filename conflicts
      filename: `${Date.now()}-${file.name}`
    }
  }
})
```

## Installation

```bash
$ npm install uppy-aws-amplify --save
```

or

```bash
$ yarn add uppy-aws-amplify
```

We recommend installing from yarn and then using a module bundler such as [Webpack](https://webpack.js.org/), [Browserify](http://browserify.org/) or [Rollup.js](http://rollupjs.org/).
