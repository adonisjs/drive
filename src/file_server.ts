/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HttpContext } from '@adonisjs/core/http'

import debug from './debug.js'
import type { Disk } from '../index.js'
import { CannotServeFileException } from './errors.js'

function decodeLocation(location: string): string {
  try {
    return decodeURIComponent(location)
  } catch {
    return location
  }
}

/**
 * Returns a file server function that can be registered as
 * a route to serve files from a specific disk instance.
 */
export function createFileServer(disk: Disk) {
  return async function ({ request, response }: HttpContext) {
    const location = decodeLocation(request.param('*').join('/'))

    /**
     * Grabbing an instance of DriveFile. DriveFile will ensure
     * the path does not have any path traversal segments and
     * will throw an exception.
     */
    const file = disk.file(location)

    /**
     * Getting the visibility of the file. Private files won't be
     * served without signatures.
     */
    const visibility = await file.getVisibility()
    const isPrivate = visibility === 'private'

    /**
     * Check if the current URL is using a signature and
     * also if the signature is valid. We need both
     * for the following use-cases.
     *
     * - When a signature is present, we infer response
     *   headers from the request query string.
     * - So we have to make sure that when a signature
     *   is present, it should also be valid.
     * - Public files can be served without a
     *   signature.
     * - But if someone uses a fake signature on a public
     *   file to trick the response headers, then we
     *   should deny the request.
     */
    const usingSignature = !!request.input('signature')
    const hasValidSignature = request.hasValidSignature()

    /**
     * Deny when file is private and a valid signature is
     * not presented.
     *
     * Or a signature is presented but it is invalid. Regardless
     * of the file visibility
     */
    if ((isPrivate && !hasValidSignature) || (usingSignature && !hasValidSignature)) {
      debug('Access denied for file "%s". Failed condition %o', location, {
        isPrivate,
        hasValidSignature,
        usingSignature,
      })
      return response.unauthorized('Access denied')
    }

    /**
     * Read https://datatracker.ietf.org/doc/html/rfc7234#section-4.3.5 for
     * headers management
     */
    try {
      const metadata = await file.getMetaData()

      response.header('etag', metadata.etag)

      /**
       * Set Last-Modified or the Cache-Control header. We pick
       * the cache control header from the query string only
       * when a valid signature is presented.
       */
      if (usingSignature && request.input('cacheControl')) {
        response.header('Cache-Control', request.input('cacheControl'))
      } else {
        response.header('Last-Modified', metadata.lastModified.toUTCString())
      }

      /**
       * Set the Content-Type header. We pick the contentType header
       * from the query string only when a valid signature
       * is presented
       */
      if (usingSignature && request.input('contentType')) {
        response.header('Content-Type', request.input('contentType'))
      } else if (metadata.contentType) {
        response.type(metadata.contentType)
      }

      /**
       * Set the following headers by reading the query string values.
       * Must be done when a signature was presented.
       */
      if (usingSignature && request.input('contentDisposition')) {
        response.header('Content-Disposition', request.input('contentDisposition'))
      }
      if (usingSignature && request.input('contentEncoding')) {
        response.header('Content-Encoding', request.input('contentEncoding'))
      }
      if (usingSignature && request.input('contentLanguage')) {
        response.header('Content-Language', request.input('contentLanguage'))
      }

      /*
       * Do not stream files for HEAD request, but set the appropriate
       * status code.
       *
       * 200: When NOT using etags or cache is NOT fresh. This forces browser
       *      to always make a GET request
       *
       * 304: When etags are used and cache is fresh
       */
      if (request.method() === 'HEAD') {
        response.status(response.fresh() ? 304 : 200)
        return
      }

      /*
       * Regardless of request method, if cache is
       * fresh, then we must respond with 304
       */
      if (response.fresh()) {
        response.status(304)
        return
      }

      /**
       * Set content length if serving the file
       */
      response.header('Content-length', metadata.contentLength.toString())

      /**
       * Get file stream and send it in the response
       */
      return response.stream(await file.getStream())
    } catch (error) {
      throw new CannotServeFileException(error)
    }
  }
}
