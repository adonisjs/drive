/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * The exception is raised by the LocalFileServer when trying
 * to serve a file during an HTTP request.
 */
export class CannotServeFileException extends Exception {
  #isInProdEnv = process.env.NODE_ENV === 'production'

  constructor(originalError: any) {
    super('Cannot serve local file using drive', {
      code: 'E_CANNOT_SERVE_FILE',
      status: 500,
      cause: originalError,
    })
  }

  /**
   * Returns the root cause of the error by reading
   * the nested "error.cause" property in recursive
   * manner.
   */
  #getRootCause(error: unknown): any {
    if (error && typeof error === 'object' && 'cause' in error) {
      return this.#getRootCause(error.cause)
    }
    return error
  }

  /**
   * Parses the original error to find the accurate error
   * message, stack and the status code.
   */
  parseError(error: this) {
    const rootCause = this.#getRootCause(error)
    const message = rootCause.message || error.message
    const stack = rootCause.stack
    const code = rootCause.code
    const status =
      code === 'ENOENT' || message.includes('Cannot get metadata of a directory') ? 404 : 500

    return { stack, status, message }
  }

  /**
   * Converts error to an HTTP response.
   */
  handle(error: this, ctx: HttpContext) {
    /**
     * Displaying error in production. Always falling back
     * to 404 to avoid leaking internals of the app.
     */
    if (this.#isInProdEnv) {
      return ctx.response.notFound('File not found')
    }

    /**
     * Displaying error during development
     */
    const { stack, status, message } = this.parseError(error)

    switch (ctx.request.accepts(['html', 'application/vnd.api+json', 'json'])) {
      case 'application/vnd.api+json':
        return ctx.response.status(status).send({ title: message, meta: { stack } })
      case 'json':
        return ctx.response.status(status).send({ message, stack })
      case 'html':
      default:
        return ctx.response.status(status).send(`${message}\nStack:${stack}`)
    }
  }

  /**
   * Reporting the error using the logger
   */
  report(error: this, ctx: HttpContext) {
    /**
     * Displaying error during development
     */
    const { stack, status, message } = this.parseError(error)

    if (status === 401) {
      ctx.logger.warn(message)
    } else {
      ctx.logger.error({ err: stack }, message)
    }
  }
}
