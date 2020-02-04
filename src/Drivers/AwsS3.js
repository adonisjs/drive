'use strict'

const S3 = require('aws-sdk/clients/s3')
const PCancelable = require('p-cancelable')
const { FileNotFound, UnknownException } = require('../Exceptions')
const { URL } = require('url')

class AwsS3 {
  constructor (config) {
    this.s3 = new S3(Object.assign({}, {
      accessKeyId: config.key,
      secretAccessKey: config.secret,
      region: config.region,
    }, config))

    this._bucket = config.bucket
    this._url = config.url
  }

  _handleError (err, path) {
    switch (err.name) {
      case 'NoSuchKey':
        return FileNotFound.file(err, path)
      default:
        return UnknownException.invoke(err, err.name, path)
    }
  }

  driver () {
    return this.s3
  }

  upload (location, stream, params = {}) {
    return new PCancelable((resolve, reject, onCancel) => {
      const clonedParams = Object.assign({}, params, {
        Key: location,
        Body: stream,
        Bucket: this._bucket,
      })

      const upload = this.s3.upload(clonedParams, (err, data) => {
        if (err) {
          return reject(this._handleError(err, location))
        }

        return resolve(data.Location)
      })

      onCancel(() => {
        upload.abort()
      })
    })
  }

  getStream (location, { start, end, ...params } = {}) {
    const clonedParams = Object.assign({}, params, {
      Bucket: this._bucket,
      Key: location,
    })

    if (typeof (start) === 'number' && typeof (end) === 'number') {
      clonedParams['Range'] = `bytes=${start}-${end}`
    }

    return this.s3.getObject(clonedParams).createReadStream()
  }

  async stat (location, params) {
    const clonedParams = Object.assign({}, params, {
      Bucket: this._bucket,
      Key: location,
    })

    try {
			const result = await this.s3.headObject(clonedParams).promise()

      return {
        size: result.ContentLength,
        modified: result.LastModified,
        mimetype: result.ContentType,
        etag: result.ETag
      }
		} catch (err) {
      throw this._handleError(err, location)
		}
  }

  async *list (location, recursive = false) {
    const params = {
      Bucket: this._bucket,
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

  exists (location, params) {
    return new Promise((resolve, reject) => {
      const clonedParams = Object.assign({}, params, {
        Bucket: this._bucket,
        Key: location,
      })

      this.s3.headObject(clonedParams, (err) => {
        if (err) {
          return err.statusCode === 404 ? resolve(false) : reject(this._handleError(err, location))
        }

        return resolve(true)
      })
    })
  }

  put (location, content, params) {
    return new Promise((resolve, reject) => {
      const clonedParams = Object.assign({}, params, {
        Key: location,
        Body: content,
        Bucket: this._bucket,
      })

      this.s3.upload(clonedParams, (err, response) => {
        if (err) {
          return reject(this._handleError(err, location))
        }

        return resolve(response.Location)
      })
    })
  }

  delete (location, params = {}) {
    return new Promise((resolve, reject) => {
      const clonedParams = Object.assign({}, params, {
        Bucket: this._bucket,
        Key: location,
      })

      this.s3.deleteObject(clonedParams, (err) => {
        if (err) {
          return reject(this._handleError(err, location))
        }

        return resolve(true)
      })
    })
  }

  async get (location, params = {}) {
    const clonedParams = Object.assign({}, params, {
      Bucket: this._bucket,
      Key: location,
    })

    try {
      const result = await this.s3.getObject(clonedParams).promise()

      return result.Body
    } catch (err) {
      throw this._handleError(err, location)
    }
  }

  getUrl (location) {
    if (this._url) {
      return this._url.replace(/\/$/, '') + '/' + location.replace(/^\/+/, '')
    }
    
    const bucket = this._bucket
    const { href } = this.s3.endpoint

    if (href.startsWith('https://s3.amazonaws')) {
      return `https://${bucket}.s3.amazonaws.com/${location}`
    }

    return `${href}${bucket}/${location}`
  }

  getSignedUrl (location, { expiry = 900, ...params } = {}) {
    return new Promise((resolve, reject) => {
      const clonedParams = Object.assign({}, params, {
        Key: location,
        Bucket: this._bucket,
        Expires: expiry,
      })

      this.s3.getSignedUrl('getObject', clonedParams, (err, url) => {
        if (err) {
          return reject(this._handleError(err, location))
        }

        if (this._url) {
          return resolve(Object.assign(new URL(url), { hostname: new URL(this._url).hostname }).href)
        }

        return resolve(url)
      })
    })
  }

  copy (src, dest, params = {}) {
    return new Promise((resolve, reject) => {
      const clonedParams = Object.assign({}, params, {
        Key: dest,
        CopySource: `/${this._bucket}/${src}`,
        Bucket: this._bucket,
      })

      this.s3.copyObject(clonedParams, (err) => {
        if (err) {
          return reject(this._handleError(err, location))
        }

        return resolve(this.getUrl(dest))
      })
    })
  }

  async move (src, dest, params = {}) {
    const url = await this.copy(src, dest, params)

    await this.delete(src)

    return url
  }
}

module.exports = AwsS3
