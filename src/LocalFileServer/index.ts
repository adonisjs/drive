/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { extname } from 'path'
import { Exception } from '@poppinss/utils'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import { RouterContract } from '@ioc:Adonis/Core/Route'
import { LocalDriverConfig, LocalDriverContract } from '@ioc:Adonis/Core/Drive'

/**
 * Registers the route to serve files from the local driver
 * or the memory driver.
 */
export class LocalFileServer {
  /**
   * Makes the route name for a given disk name
   */
  public static makeRouteName(diskName: string) {
    return `drive.${diskName}.serve`
  }

  /**
   * The file path route param name
   */
  public static filePathParamName = '*'

  constructor(
    private diskName: string,
    private config: LocalDriverConfig,
    private driver: LocalDriverContract,
    private router: RouterContract,
    private logger: LoggerContract
  ) {}

  /**
   * Registers route for disk using "local" driver and "serveFiles"
   * true
   */
  public registerRoute() {
    /**
     * Base path must always be defined
     */
    if (!this.config.basePath) {
      throw new Exception(
        `Missing property "basePath" in "${this.diskName}" disk config`,
        500,
        'E_MISSING_LOCAL_DRIVER_BASEPATH'
      )
    }

    const routeName = LocalFileServer.makeRouteName(this.diskName)
    const routePattern = `${this.config.basePath.replace(/\/$/, '')}/${
      LocalFileServer.filePathParamName
    }`

    this.logger.trace({ route: routePattern, name: routeName }, 'registering drive route')

    this.router
      .get(routePattern, async ({ response, request, logger }) => {
        let location = request.param(LocalFileServer.filePathParamName).join('/')
        try {
          location = decodeURIComponent(location)
        } catch (error) {
          // keep location should be raised as it is
        }

        const fileVisibility = await this.driver.getVisibility(location)
        const usingSignature = !!request.input('signature')

        /**
         * Deny request when not using signature and file is "private"
         */
        if (!usingSignature && fileVisibility === 'private') {
          response.unauthorized('Access denied')
          return
        }

        /**
         * Deny request when using signature but its invalid. File
         * visibility doesn't play a role here.
         */
        if (usingSignature && !request.hasValidSignature()) {
          response.unauthorized('Access denied')
          return
        }

        /**
         * Read https://datatracker.ietf.org/doc/html/rfc7234#section-4.3.5 for
         * headers management
         */

        try {
          const stats = await this.driver.getStats(location)

          /**
           * Ignore requests for directories
           */
          if (!stats.isFile) {
            return response.notFound('File not found')
          }

          /**
           * Set Last-Modified or the Cache-Control header. We pick
           * the cache control header from the query string only
           * when a valid signature is presented.
           */
          if (usingSignature && request.input('cacheControl')) {
            response.header('Cache-Control', request.input('cacheControl'))
          } else {
            response.header('Last-Modified', stats.modified.toUTCString())
          }

          /**
           * Set the Content-Type header. We pick the contentType header
           * from the query string only when a valid signature
           * is presented
           */
          if (usingSignature && request.input('contentType')) {
            response.header('Content-Type', request.input('contentType'))
          } else {
            response.type(extname(location))
          }

          /**
           * Set the following headers by reading the query string values. Must
           * be done when a signature was presented.
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

          /**
           * Define etag when present in stats
           */
          if (stats.etag) {
            response.header('etag', stats.etag)
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
          response.header('Content-length', stats.size.toString())

          /**
           * Stream file.
           */
          return response.stream(await this.driver.getStream(location))
        } catch (error) {
          if (error.original?.code === 'ENOENT' || error.code === 'ENOENT') {
            response.notFound('File not found')
          } else {
            logger.fatal(
              error,
              `drive: Unable to serve file "${location}" from "${this.diskName}" disk`
            )
            response.internalServerError('Cannot process file')
          }
        }
      })
      .as(routeName)
  }
}
