/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Router } from '@adonisjs/core/http'
import type { AdonisFSDriverOptions } from './types.ts'
import type { FSDriverOptions } from 'flydrive/drivers/fs/types'

/**
 * Creates the URL builder for the flydrive "fs" driver.
 *
 * @param router - The AdonisJS router instance
 * @param config - The FS driver configuration options
 * @param routeName - The name of the route for file serving
 *
 * @example
 * ```js
 * const urlBuilder = createURLBuilder(router, {
 *   location: '/uploads',
 *   visibility: 'public',
 *   serveFiles: true,
 *   routeBasePath: '/uploads'
 * }, 'drive.uploads.serve')
 *
 * const url = await urlBuilder.generateURL('photo.jpg')
 * const signedUrl = await urlBuilder.generateSignedURL('private.pdf', null, { expiresIn: '1h' })
 * ```
 */
export function createURLBuilder(
  router: Router,
  config: AdonisFSDriverOptions,
  routeName: string
): Exclude<Required<FSDriverOptions['urlBuilder']>, undefined> {
  const prefixUrl = config.appUrl || ''

  return {
    /**
     * Generates a public URL for a file.
     *
     * @param key - The file key/path to generate URL for
     */
    async generateURL(key) {
      return (router.urlBuilder.urlFor as any)(
        routeName,
        { '*': key.split('/') },
        {
          prefixUrl: prefixUrl,
        }
      )
    },
    /**
     * Generates a signed upload URL. Not implemented for FS driver.
     */
    async generateSignedUploadURL() {
      throw new Error('Signed uploads are not supported by the FS driver')
    },
    /**
     * Generates a signed URL for private file access.
     *
     * @param key - The file key/path to generate signed URL for
     * @param _ - Unused parameter (bucket name for cloud drivers)
     * @param options - URL generation options including expiration time and headers
     */
    async generateSignedURL(key, _, options) {
      const { expiresIn, ...headers } = options
      return (router.urlBuilder.signedUrlFor as any)(
        routeName,
        { '*': key.split('/') },
        {
          qs: headers,
          expiresIn,
          prefixUrl: prefixUrl,
        }
      )
    },
  }
}
