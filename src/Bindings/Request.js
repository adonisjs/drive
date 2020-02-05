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
        file.setError(`File size should be less than ${size}`, 'size')
        stream.emit('error', file.error())
      }
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
            file.setError(`Image dimensions should be no more than ${width}x${height}`, 'dimension')
            stream.emit('error', file.error())
          }
        } else if (file.size > DEFAULT_LIMIT) {
          file.setError('Reached the limit before detecting image type.', 'dimension')
          stream.emit('error', file.error())
        }
      }
    }).on('finish', () => {
      if (dimensions) {
        return
      }

      file.setError(buffer.length === 0 ? 'No bytes received.' : error && error.message, 'dimension')
      stream.emit('error', file.error())
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
            // file.stream.destroy()
            return reject(file.error())
          }
  
          const location = options.location ? options.location({ request, file }) : `${options.name}/${file.clientName}`
          
          const stream = createValidationStream(file)
          const promise = disk.upload(location, stream, { ContentType: file.headers['content-type'] })
  
          pipeline(file.stream, stream, (err) => {
            if (err) {
              reject(err)
              promise.cancel()
            }
          })
  
          promise.then((url) => {
            files.add(file.fieldName, url)
            resolve()
          }, reject)
        })
      })
    })
  }

  await request.multipart.process()

  return { disk, files: files.get(), fields: fields.get() }
}