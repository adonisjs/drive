'use strict'

const contentDisposition = require('content-disposition')
const { pipeline } = require('stream')
const { extname } = require('path')

class StorageController {
  async download ({ $disk, params, request, response }) {
    const path = params.path.join('/')
    const stat = await $disk.stat(path)
    const filename = request.input('filename')

    response.header('Last-Modified', stat.modified.toUTCString())
    response.header('Content-Type', stat.mimetype)
    response.header('Etag', stat.etag)
    response.header('Accept-Ranges', 'bytes')

    if (filename) {
      const extension = extname(path[path.length - 1])
      response.header('Content-Disposition', contentDisposition(`${filename}${extension}`, { type: 'attachment' }))
    }

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
