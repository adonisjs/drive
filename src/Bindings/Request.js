'use strict'

const FormFields = require('@adonisjs/bodyparser/src/FormFields')
const { PassThrough, pipeline } = require('stream')
const imageSize = require('image-size')
const DEFAULT_LIMIT = 128 * 1024

function createValidationStream (file) {
  const { size, width, height } = file.validationOptions

  const stream = new PassThrough()
    .on('data', (chunk) => {
      file.size += chunk.length

      if (size && file.size > size) {
        stream.emit('bail', `File size should be less than ${size}`, 'size')
      }
    })
    .on('bail', (message, type = 'fatal') => {
      file.setError(message, type)
      stream.emit('error', file.error())
    })

  if (width || height) {
    let buffer = Buffer.alloc(0)
    let dimensions, error

    stream.on('data', (chunk) => {
      if (!dimensions) {
        buffer = Buffer.concat([buffer, chunk], file.size)

        try {
          dimensions = imageSize(buffer)
        } catch (err) {
          error = err
        }

        if (dimensions) {
          if ((width && dimensions.width > width) || (height && dimensions.height > height)) {
            stream.emit('bail', `Image dimensions should be no more than ${width}x${height}`, 'dimension')
          }
        } else if (file.size > DEFAULT_LIMIT) {
          stream.emit('bail', 'Reached the limit before detecting image type.', 'dimension')
        }
      }
    }).on('finish', () => {
      if (dimensions) {
        return
      }

      stream.emit('bail', buffer.length === 0 ? 'No bytes received.' : error && error.message)
    })
  }

  return stream
}

module.exports = async function (request, disk, filesOptions) {
  const files = new FormFields()
  const fields = new FormFields()

  request.multipart.field((name, value) => {
    fields.add(name, value)
  })
  
  for (const options of filesOptions) {
    request.multipart.file(options.name, options.rules, (file) => {
      return new Promise((resolve, reject) => {
        file.runValidations().then(() => {
          if (file.status === 'error') {
            return reject(file.error())
          }
  
          const location = options.location ? options.location({ request, file, fields: fields.get() }) : `${options.name}/${file.clientName}`
          
          const stream = createValidationStream(file)
          const promise = disk.upload(location, stream, { ContentType: file.headers['content-type'] })
  
          pipeline(file.stream, stream, (err) => {
            if (err) {
              reject(err)
              promise.cancel()
            }
          })
  
          promise.then((url) => {
            file.fileName = location
            file.url = url
            file.status = 'moved'
            files.add(file.fieldName, file)
            resolve()
          }, reject)
        })
      })
    })
  }

  await request.multipart.process()

  request._files = files.get()
  request.body = fields.get()

  return { disk, files: files.get(), fields: fields.get() }
}