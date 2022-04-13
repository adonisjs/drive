/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { slash } from '@poppinss/utils'
import { normalize, relative } from 'path'
import { PathTraversalDetectedException } from '../Exceptions'

/**
 * Path prefixer for resolving and prefixing paths for disk drivers
 */
export class PathPrefixer {
  /**
   * Separator used for dividing path segments is always unix-style forward slash
   */
  public separator = '/' as const

  /**
   * Prefix used for path prefixing. Can be empty string for cloud drivers.
   */
  public prefix: string

  constructor(prefix: string = '') {
    // strip slashes from the end of the prefix
    this.prefix = prefix.replace(/\/+$/g, '')

    // always end prefix with separator if it is not empty
    if (this.prefix !== '' || prefix === this.separator) {
      this.prefix += this.separator
    }
  }

  /**
   * Normalize given path to always use `/` as separator and resolve relative paths using `.` and `..`.
   * It also guards against path traversal beyond the root.
   */
  public normalizePath(path: string): string {
    const parts: string[] = []

    for (const part of slash(path).split(this.separator)) {
      if (['', '.'].includes(part)) {
        continue
      }

      if (part === '..') {
        // if we are traversing beyond the root
        if (parts.length === 0) {
          throw PathTraversalDetectedException.invoke(path)
        }

        parts.pop()
      } else {
        parts.push(part)
      }
    }

    return parts.join(this.separator)
  }

  /**
   * Ruturns normalized and prefixed location path.
   */
  public prefixPath(location: string): string {
    return this.prefix + this.normalizePath(location)
  }

  /**
   * Ruturns normalized and prefixed location path for directory so always ending with slash.
   * Useful for cloud drivers prefix when listitng files.
   */
  public prefixDirectoryPath(location: string): string {
    return this.prefixPath(location) + this.separator
  }

  /**
   * Returns normalized path after stripping the current prefix from it.
   * It is a reverse operation of `prefixPath`.
   */
  public stripPrefix(location: string): string {
    const path = relative(this.prefix, slash(location))
    return this.normalizePath(path)
  }

  /**
   * Returns a new instance of `PathPrefixer` which is using as prefix stripped prefix from path of current `PathPrefixer`.
   */
  public withStrippedPrefix(path: string): PathPrefixer {
    return new PathPrefixer(this.stripPrefix(path))
  }

  /**
   * Returns a new instance of `PathPrefixer` which is using as prefix current prefix merged with provided prefix.
   */
  public withPrefix(prefix: string): PathPrefixer {
    return new PathPrefixer(this.prefixPath(prefix))
  }

  /**
   * Returns a new instance of `PathPrefixer` which is using as prefix provided normalized path.
   */
  public static fromPath(path: string) {
    return new this(slash(normalize(path)))
  }
}
