'use strict'

const { PassThrough, pipeline } = require('stream')
const imageSize = require('image-size')
const DEFAULT_LIMIT = 128 * 1024

function createValidationStream (file) {
  const { size, width, height } = file.validationOptions

  const stream = new PassThrough()
    .on('data', (chunk) => {
      file.size += chunk.length

      if (size && file.size > size) {
        stream.emit('error', new Error(`File size should be less than ${size}`))
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
            stream.emit('error', new Error(`Image size should be no more than ${width}x${height}`))
          }
        } else if (file.size > DEFAULT_LIMIT) {
          stream.emit('error', new Error('Reached the limit before detecting image type.'))
        }
      }
    }).on('finish', () => {
      if (dimensions) {
        return
      }

      stream.emit('error', buffer.length === 0 ? new Error('No bytes received.') : error)
    })
  }

  return stream
}

class StorageController {
  async upload (ctx) {
    ctx.request.multipart.file(ctx.$options.name, ctx.$options.rules, (file) => {
      return new Promise((resolve, reject) => {
        file.runValidations().then(() => {
          const error = file.error()
  
          if (error && Object.keys(error).length) {
            // file.stream.destroy()
            return reject(error)
          }

          const location = ctx.$options.location ? ctx.$options.location({ ctx, file }) : `${ctx.$options.name}/${file.clientName}`
          
          const stream = createValidationStream(file)
          const promise = ctx.$disk.upload(location, stream, { ContentType: file.headers['content-type'] })

          pipeline(file.stream, stream, (err) => {
            if (err) {
              reject(err)
              promise.cancel()
            }
          })

          promise.then(resolve, reject)
        })
      })
    })

    await ctx.request.multipart.process()
  }
  
  async download ({ $disk, params, request, response }) {
    const path = params.path.join('/')
    const stat = await $disk.stat(path)

    response.header('Last-Modified', stat.modified.toUTCString())
    response.header('Content-Type', stat.mimetype)
    response.header('Etag', stat.etag)
    response.header('Accept-Ranges', 'bytes')

    if (request.method() === 'HEAD') {
      return response.status(request.fresh() ? 304 : 200).send('')
    }

    if (request.fresh()) {
      return response.status(304).send('')
    }

    const range = request.header('Range')
    const options = {}

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      let start = parseInt(parts[0], 10)
      let end = parseInt(parts[1], 10)
  
      if (isNaN(start)) {
        start = stat.size - end
        end = stat.size - 1
      } else if (isNaN(end)) {
        end = stat.size - 1
      }

      if (start >= stat.size || end >= stat.size) {
        return response.status(416).header('Content-Range', `bytes */${stat.size}`).send('')
      }

      response
        .status(206)
        .header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
        .header('Content-Length', (end - start) + 1)

      options.start = start
      options.end = end
    } else {
      response
        .status(200)
        .header('Content-Length', stat.size)
    }

    response.implicitEnd = false

    return new Promise((resolve) => {
      const stream = $disk.getStream(path, options)

      pipeline(stream, response.response, (error) => {
        if (error) {
          if (error.code === 'ENOENT') {
            response.status(404).send('File not found')
          } else {
            response.status(500).send('Cannot process file')
          }
        }

        resolve()
      })
    })
  }
}

module.exports = StorageController
