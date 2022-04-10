/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import etag from 'etag'
import { Volume } from 'memfs'
import type { Dirent } from 'memfs/lib/Dirent'
import { dirname, join, isAbsolute } from 'path'
import { RouterContract } from '@ioc:Adonis/Core/Route'

import {
  DisksList,
  Visibility,
  ContentHeaders,
  DriveFileStats,
  FakeDriverContract,
  DirectoryListingContract,
  DriveListItem,
} from '@ioc:Adonis/Core/Drive'

import { pipelinePromise } from '../utils'
import { LocalFileServer } from '../LocalFileServer'

import {
  CannotCopyFileException,
  CannotMoveFileException,
  CannotReadFileException,
  CannotWriteFileException,
  CannotDeleteFileException,
  CannotGetMetaDataException,
  CannotListDirectoryException,
} from '../Exceptions'

import { DirectoryListing } from '../DirectoryListing'

/**
 * Memory driver is mainly used for testing
 */
export class FakeDriver implements FakeDriverContract {
  /**
   * Reference to the underlying adapter. Which is memfs
   */
  public adapter = new Volume()

  /**
   * Name of the driver
   */
  public name: 'fake' = 'fake'

  /**
   * Root dir for memfs doesn't play any role
   */
  private rootDir = './'

  /**
   * Rely on the config for visibility or fallback to private
   */
  private visibility: Visibility = this.config.visibility || 'private'

  constructor(public disk: keyof DisksList, private config: any, private router: RouterContract) {}

  /**
   * Make absolute path to a given location
   */
  public makePath(location: string) {
    return isAbsolute(location) ? location : join(this.rootDir, location)
  }

  /**
   * Creates the directory recursively with in the memory
   */
  private ensureDir(location: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.adapter.mkdirp(dirname(location), (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Returns the file contents as a buffer. The buffer return
   * value allows you to self choose the encoding when
   * converting the buffer to a string.
   */
  public async get(location: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.adapter.readFile(this.makePath(location), (error, data: Buffer) => {
        if (error) {
          reject(CannotReadFileException.invoke(location, error))
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
   * Returns the file contents as a stream
   */
  public async getStream(location: string): Promise<NodeJS.ReadableStream> {
    return this.adapter.createReadStream(this.makePath(location))
  }

  /**
   * A boolean to find if the location path exists or not
   */
  public exists(location: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.adapter.exists(this.makePath(location), (exists) => {
        resolve(exists)
      })
    })
  }

  /**
   * Not supported
   */
  public async getVisibility(): Promise<Visibility> {
    return this.visibility
  }

  /**
   * Returns the file stats
   */
  public async getStats(location: string): Promise<DriveFileStats> {
    return new Promise((resolve, reject) => {
      this.adapter.stat(this.makePath(location), (error, stats) => {
        if (error) {
          reject(CannotGetMetaDataException.invoke(location, 'stats', error))
        } else {
          resolve({
            modified: stats!.mtime,
            size: stats!.size as number,
            isFile: stats!.isFile(),
            etag: etag(stats),
          })
        }
      })
    })
  }

  /**
   * Returns a signed URL for a given location path
   */
  public async getSignedUrl(
    location: string,
    options?: ContentHeaders & { expiresIn?: string | number }
  ): Promise<string> {
    const { expiresIn, ...qs } = options || {}

    return this.router.makeSignedUrl(
      '/__drive_fake',
      { disk: this.disk, [LocalFileServer.filePathParamName]: [location] },
      {
        expiresIn,
        qs,
      }
    )
  }

  /**
   * Returns a URL for a given location path
   */
  public async getUrl(location: string): Promise<string> {
    return this.router.makeUrl('/__drive_fake', {
      disk: this.disk,
      [LocalFileServer.filePathParamName]: [location],
    })
  }

  /**
   * Write string|buffer contents to a destination. The missing
   * intermediate directories will be created (if required).
   */
  public async put(location: string, contents: Buffer | string): Promise<void> {
    const absolutePath = this.makePath(location)
    await this.ensureDir(absolutePath)

    return new Promise((resolve, reject) => {
      this.adapter.writeFile(absolutePath, contents, (error) => {
        if (error) {
          reject(CannotWriteFileException.invoke(location, error))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Write a stream to a destination. The missing intermediate
   * directories will be created (if required).
   */
  public async putStream(location: string, contents: NodeJS.ReadableStream): Promise<void> {
    const absolutePath = this.makePath(location)
    try {
      await this.ensureDir(absolutePath)

      const writeStream = this.adapter.createWriteStream(absolutePath)

      /**
       * If streaming is interrupted, then the destination file will be
       * created with partial or empty contents.
       *
       * Earlier we are cleaning up the empty file, which addresses one
       * use case (no pre-existing file was there).
       *
       * However, in case there was already a file, it will be then emptied
       * out. So basically there is no way to get the original contents
       * back unless we read the existing content in buffer, but then
       * we don't know how large the file is.
       */
      await pipelinePromise(contents, writeStream)
    } catch (error) {
      throw CannotWriteFileException.invoke(location, error)
    }
  }

  /**
   * Not supported
   */
  public async setVisibility(): Promise<void> {
    return
  }

  /**
   * Remove a given location path
   */
  public async delete(location: string): Promise<void> {
    if (!(await this.exists(location))) {
      return
    }

    return new Promise((resolve, reject) => {
      this.adapter.unlink(this.makePath(location), (error) => {
        if (error) {
          reject(CannotDeleteFileException.invoke(location, error))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Copy a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public async copy(source: string, destination: string): Promise<void> {
    const desintationAbsolutePath = this.makePath(destination)
    await this.ensureDir(desintationAbsolutePath)

    return new Promise((resolve, reject) => {
      this.adapter.copyFile(this.makePath(source), desintationAbsolutePath, (error) => {
        if (error) {
          reject(CannotCopyFileException.invoke(source, destination, error))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Move a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public async move(source: string, destination: string): Promise<void> {
    const sourceAbsolutePath = this.makePath(source)
    const desintationAbsolutePath = this.makePath(destination)
    await this.ensureDir(desintationAbsolutePath)

    return new Promise<void>((resolve, reject) => {
      this.adapter.copyFile(sourceAbsolutePath, desintationAbsolutePath, (error) => {
        if (error) {
          reject(CannotMoveFileException.invoke(source, destination, error))
        } else {
          resolve()
        }
      })
    }).then(() => this.delete(sourceAbsolutePath))
  }

  /**
   * Return a listing directory iterator for given location.
   */
  public list(location: string): DirectoryListingContract<this, DriveListItem> {
    return new DirectoryListing(this, async function* () {
      try {
        const dir = (await this.adapter.promises.readdir(this.makePath(location), {
          withFileTypes: true,
        })) as Dirent[]

        for (const dirent of dir) {
          yield {
            location: `${location}/${dirent.name}`.replace(/^\/+|\/+$/g, ''),
            isFile: dirent.isFile(),
          }
        }
      } catch (error) {
        throw CannotListDirectoryException.invoke(location, error)
      }
    })
  }
}
