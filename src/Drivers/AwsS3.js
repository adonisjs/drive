'use strict'

const BaseAwsS3 = require('@slynova/flydrive/src/Drivers/AwsS3')
const { FileNotFound } = require('@slynova/flydrive/src/Exceptions')

class AwsS3 extends BaseAwsS3 {
  driver () {
    return this.s3
  }

  async stat (location) {
    const params = { Key: location, Bucket: this._bucket.pull() }

    try {
			const result = await this.s3.headObject(params).promise()

      return {
        size: result.ContentLength,
        modified: result.LastModified,
        mimetype: result.ContentType,
        etag: result.ETag
      }
		} catch (err) {
      if (err) {
        throw FileNotFound.file(location)
      }

      throw e
		}
  }

  async *list (location, recursive = false) {
    const params = {
      Bucket: this._bucket.pull(),
      Prefix: location.replace(/^\/+|\/+$/g, '') + '/'
    }

    if (recursive === false) {
      params.Delimiter = '/'
    }

    while (true) {
      const data = await this.s3.listObjectsV2(params).promise()

      for (const file of data.Contents) {
        yield { type: 'file', path: file.Key }
      }

      for (const dir of data.CommonPrefixes) {
        yield { type: 'dir', path: dir.Prefix }
      }

      if (!data.IsTruncated) {
        break
      }

      params.ContinuationToken = data.NextContinuationToken
    }
  }
}

module.exports = AwsS3
