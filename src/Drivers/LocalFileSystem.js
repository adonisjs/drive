'use strict'

const { FileNotFound } = require('@slynova/flydrive/src/Exceptions')
const fs = require('fs-extra')
const mime = require('mime-types')
const { extname } = require('path')

module.exports = (LocalFileSystem) => class extends LocalFileSystem {
  driver () {
		return fs
	}
  
  async stat (location) {
    try {
			const stat = await fs.stat(this._fullPath(location))

      return {
        size: stat.size,
        modified: stat.mtime,
        mimetype: mime.lookup(extname(location)) || 'application/octet-stream',
        etag: `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`
      }
		} catch (e) {
      if (e.code === 'ENOENT') {
        throw FileNotFound.file(location)
      }

      throw e
		}
  }

  async *list (location, recursive = false) {
    const dirents = await fs.readdir(this._fullPath(location), { withFileTypes: true })

    for (const dirent of dirents) {
      const res = {
        type: dirent.isDirectory() ? 'dir' : 'file',
        path: `${location}/${dirent.name}`.replace(/^\/+|\/+$/g, '')
      }

      yield res

      if (recursive && res.type === 'dir') {
        yield* this.list(res.path, true)
      }
    }
  }
}
