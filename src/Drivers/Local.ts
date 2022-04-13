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
import * as fsExtra from 'fs-extra'
import { dirname } from 'path'
import { DirectoryListing } from '../DirectoryListing'
import { RouterContract } from '@ioc:Adonis/Core/Route'

import {
  Visibility,
  DriveFileStats,
  ContentHeaders,
  LocalDriverConfig,
  LocalDriverContract,
  DirectoryListingContract,
  LocalDriveListItem,
} from '@ioc:Adonis/Core/Drive'

import { pipelinePromise } from '../utils'
import { LocalFileServer } from '../LocalFileServer'
import { PathPrefixer } from '../PathPrefixer'

import {
  CannotCopyFileException,
  CannotMoveFileException,
  CannotReadFileException,
  CannotWriteFileException,
  CannotGenerateUrlException,
  CannotDeleteFileException,
  CannotGetMetaDataException,
  CannotListDirectoryException,
} from '../Exceptions'

/**
 * Local driver interacts with the local file system
 */
export class LocalDriver implements LocalDriverContract {
  private routeName = LocalFileServer.makeRouteName(this.diskName)

  /**
   * Reference to the underlying adapter. Which is
   * fs-extra
   */
  public adapter = fsExtra

  /**
   * Name of the driver
   */
  public name: 'local' = 'local'

  /**
   * Path prefixer used for prefixing paths with disk root
   */
  private prefixer = PathPrefixer.fromPath(this.config.root)

  constructor(
    private diskName: string,
    private config: LocalDriverConfig,
    private router: RouterContract
  ) {}

  /**
   * Make absolute path to a given location
   */
  public makePath(location: string) {
    return this.prefixer.prefixPath(location)
  }

  /**
   * Returns the file contents as a buffer. The buffer return
   * value allows you to self choose the encoding when
   * converting the buffer to a string.
   */
  public async get(location: string): Promise<Buffer> {
    try {
      return await this.adapter.readFile(this.makePath(location))
    } catch (error) {
      throw CannotReadFileException.invoke(location, error)
    }
  }

  /**
   * Returns the file contents as a stream
   */
  public async getStream(location: string): Promise<NodeJS.ReadableStream> {
    try {
      return this.adapter.createReadStream(this.makePath(location))
    } catch (error) {
      throw CannotReadFileException.invoke(location, error)
    }
  }

  /**
   * A boolean to find if the location path exists or not
   */
  public async exists(location: string): Promise<boolean> {
    try {
      return await this.adapter.pathExists(this.makePath(location))
    } catch (error) {
      throw CannotGetMetaDataException.invoke(location, 'exists', error)
    }
  }

  /**
   * Not supported
   */
  public async getVisibility(_: string): Promise<Visibility> {
    return this.config.visibility
  }

  /**
   * Returns the file stats
   */
  public async getStats(location: string): Promise<DriveFileStats> {
    try {
      const stats = await this.adapter.stat(this.makePath(location))
      return {
        modified: stats.mtime,
        size: stats.size,
        isFile: stats.isFile(),
        etag: etag(stats),
      }
    } catch (error) {
      throw CannotGetMetaDataException.invoke(location, 'stats', error)
    }
  }

  /**
   * Returns a signed URL for a given location path
   */
  public async getSignedUrl(
    location: string,
    options?: ContentHeaders & { expiresIn?: string | number }
  ): Promise<string> {
    if (!this.config.serveFiles) {
      throw CannotGenerateUrlException.invoke(location, this.diskName)
    }

    const { expiresIn, ...qs } = options || {}
    return this.router.makeSignedUrl(
      this.routeName,
      { [LocalFileServer.filePathParamName]: [this.prefixer.normalizePath(location)] },
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
    if (!this.config.serveFiles) {
      throw CannotGenerateUrlException.invoke(location, this.diskName)
    }

    return this.router.makeUrl(this.routeName, {
      [LocalFileServer.filePathParamName]: [this.prefixer.normalizePath(location)],
    })
  }

  /**
   * Write string|buffer contents to a destination. The missing
   * intermediate directories will be created (if required).
   */
  public async put(location: string, contents: Buffer | string): Promise<void> {
    try {
      await this.adapter.outputFile(this.makePath(location), contents)
    } catch (error) {
      throw CannotWriteFileException.invoke(location, error)
    }
  }

  /**
   * Write a stream to a destination. The missing intermediate
   * directories will be created (if required).
   */
  public async putStream(location: string, contents: NodeJS.ReadableStream): Promise<void> {
    const absolutePath = this.makePath(location)

    const dir = dirname(absolutePath)
    await this.adapter.ensureDir(dir)

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
    try {
      await pipelinePromise(contents, writeStream)
    } catch (error) {
      throw CannotWriteFileException.invoke(location, error)
    }
  }

  /**
   * Not supported
   */
  public async setVisibility(_: string, __: string): Promise<void> {
    return
  }

  /**
   * Remove a given location path
   */
  public async delete(location: string): Promise<void> {
    try {
      await this.adapter.remove(this.makePath(location))
    } catch (error) {
      throw CannotDeleteFileException.invoke(location, error)
    }
  }

  /**
   * Copy a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public async copy(source: string, destination: string): Promise<void> {
    try {
      await this.adapter.copy(this.makePath(source), this.makePath(destination), {
        overwrite: true,
      })
    } catch (error) {
      throw CannotCopyFileException.invoke(source, destination, error)
    }
  }

  /**
   * Move a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public async move(source: string, destination: string): Promise<void> {
    try {
      await this.adapter.move(this.makePath(source), this.makePath(destination), {
        overwrite: true,
      })
    } catch (error) {
      throw CannotMoveFileException.invoke(source, destination, error)
    }
  }

  /**
   * Return a listing directory iterator for given location.
   */
  public list(location: string): DirectoryListingContract<this, LocalDriveListItem> {
    const fullPath = this.makePath(location)

    return new DirectoryListing(this, async function* () {
      try {
        const dir = await this.adapter.opendir(fullPath)
        const prefixer = this.prefixer.withStrippedPrefix(fullPath)

        for await (const dirent of dir) {
          yield {
            location: prefixer.prefixPath(dirent.name),
            isFile: dirent.isFile(),
            original: dirent,
          }
        }
      } catch (error) {
        throw CannotListDirectoryException.invoke(location, error)
      }
    })
  }
}
