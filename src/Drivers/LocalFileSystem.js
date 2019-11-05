'use strict'

const BaseLocalFileSystem = require('@slynova/flydrive/src/Drivers/LocalFileSystem')
const { FileNotFound } = require('@slynova/flydrive/src/Exceptions')
const fs = require('fs-extra')
const mime = require('mime-types')
const { extname } = require('path')

class LocalFileSystem extends BaseLocalFileSystem {
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
    const dir = this._fullPath(location)
    const dirents = await fs.readdir(dir, { withFileTypes: true })

    for (const dirent of dirents) {
      const res = {
        type: dirent.isDirectory() ? 'dir' : 'file',
        path: resolve(dir, dirent.name)
      }

      yield res

      if (recursive && res.type === 'dir') {
        yield* this.list(res.path, true)
      }
    }
  }
}

module.exports = LocalFileSystem
