'use strict'

const fs = require('fs-extra')
const path = require('path')
const PCancelable = require('p-cancelable')
const { pipeline } = require('stream')
const mime = require('mime-types')
const { FileNotFound, PermissionMissing, UnknownException } = require('../Exceptions')

function isReadableStream (stream) {
  return stream !== null
    && typeof (stream) === 'object'
    && typeof (stream.pipe) === 'function'
    && typeof (stream._read) === 'function'
    && typeof (stream._readableState) === 'object'
    && stream.readable !== false
}

function createWriteStream (file, options = {}) {
  // if fd is set with an actual number, file is created, hence directory is too
  if (options.fd) {
    return fs.createWriteStream(file, options)
  } else {
    // this hacks the WriteStream constructor from calling open()
    options.fd = -1
  }
  
  let dirExists = false
  const dir = path.dirname(file)
  const _fs = options.fs || fs
  const ws = new _fs.WriteStream(file, options)
  const oldOpen = ws.open
  
  ws.open = function () {
    // set actual fd
    ws.fd = null

    if (dirExists) {
      return oldOpen.call(ws)
    }

    // this only runs once on first write
    fs.ensureDir(dir).then(() => {
      dirExists = true
      oldOpen.call(ws)
    }).catch((err) => {
      ws.destroy(err)
    })
  }

  ws.open()

  return ws
}

class LocalFileSystem {
  constructor (config) {
    this.root = config.root
  }

  _handleError (err, path) {
    switch (err.code) {
      case 'ENOENT':
        return FileNotFound.file(err, path)
      case 'EPERM':
        return PermissionMissing.invoke(err, path)
      default:
        return UnknownException.invoke(err, err.code, path)
    }
  }

  _fullPath (relativePath) {
    return path.isAbsolute(relativePath) ? relativePath : path.join(this.root, relativePath)
  }

  driver () {
		return fs
  }
  
  upload (location, stream, options = {}) {
    return new PCancelable((resolve, reject, onCancel) => {
      const fullPath = this._fullPath(location)
      const ws = createWriteStream(fullPath, options)

      onCancel(() => {
        ws.destroy()

        if (typeof ws.fd !== 'number') {
          ws.once('open', () => fs.unlink(ws.path, () => {}))
        } else {
          fs.unlink(ws.path, () => {})
        }
      })

      pipeline(stream, ws, (err) => {        
        if (err) {
          return reject(this._handleError(err, location))
        }

        return resolve()
      })
    })
  }
  
  async stat (location) {
    try {
			const stat = await fs.stat(this._fullPath(location))

      return {
        size: stat.size,
        modified: stat.mtime,
        mimetype: mime.lookup(path.extname(location)) || 'application/octet-stream',
        etag: `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`
      }
		} catch (err) {
      throw this._handleError(err, location)
		}
  }

  async *list (location, recursive = false) {
    try {
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
    } catch (err) {
      throw this._handleError(err, location)
    }
  }

  exists (location) {
    return fs.pathExists(this._fullPath(location))
  }

  async get (location, options = {}) {
    try {
      return await fs.readFile(this._fullPath(location), options)
    } catch (err) {
      throw this._handleError(err, location)
    }
  }

  getStream (location, options) {
    return fs.createReadStream(this._fullPath(location), options)
  }

  async put (location, content, options = {}) {
    if (isReadableStream(content)) {
      return new Promise((resolve, reject) => {
        const ws = createWriteStream(this._fullPath(location), options)

        pipeline(content, ws, (err) => {
          if (err) {
            return reject(this._handleError(err, location))
          }

          return resolve(true)
        })
      })
    }

    await fs.outputFile(this._fullPath(location), content, options)

    return true
  }

  async delete (location) {
    await fs.remove(this._fullPath(location))

    return true
  }

  async move (src, dest, options = {}) {
    await fs.move(this._fullPath(src), this._fullPath(dest), options)

    return true
  }

  async copy (src, dest, options) {
    await fs.copy(this._fullPath(src), this._fullPath(dest), options)

    return true
  }
}

module.exports = LocalFileSystem
