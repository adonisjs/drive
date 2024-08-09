/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'
import { LoggerFactory } from '@adonisjs/core/factories/logger'

import { createHttpContext } from './helpers.js'
import { CannotServeFileException } from '../src/errors.js'

test.group('CannotServeFileException | parseError', () => {
  test('parse error cause', ({ assert }) => {
    const error = new CannotServeFileException(new Error('Something went wrong'))
    const { message, status } = error.parseError(error)
    assert.equal(message, 'Something went wrong')
    assert.equal(status, 500)
  })

  test('parse nested error cause', async ({ assert }) => {
    // @ts-expect-error
    const parseError = await import('node:url').then((url) => url.parse(() => {})).catch((e) => e)

    const error = new CannotServeFileException(
      new Error('Something went wrong', { cause: parseError })
    )
    const { message, status } = error.parseError(error)
    assert.equal(message, 'The "url" argument must be of type string. Received function ')
    assert.equal(status, 500)
  })

  test('parse nested error cause that is not an object', async ({ assert }) => {
    const error = new CannotServeFileException(
      new Error('Something went wrong', { cause: 'parseError' })
    )
    const { message, status } = error.parseError(error)
    assert.equal(message, 'Cannot serve local file using drive')
    assert.equal(status, 500)
  })

  test('return 404 status code for ENOENT error', async ({ assert }) => {
    const fileNotFoundError = new Exception('File not found', { code: 'ENOENT' })

    const error = new CannotServeFileException(fileNotFoundError)
    const { message, status } = error.parseError(error)
    assert.equal(message, 'File not found')
    assert.equal(status, 404)
  })

  test('return 404 status code for flydrive folder access error', async ({ assert }) => {
    const fileNotFoundError = new Exception('Cannot get metadata of a directory')

    const error = new CannotServeFileException(fileNotFoundError)
    const { message, status } = error.parseError(error)
    assert.equal(message, 'Cannot get metadata of a directory')
    assert.equal(status, 404)
  })
})

test.group('CannotServeFileException | handle', () => {
  test('return error message and stack as response', async ({ assert }) => {
    const error = new CannotServeFileException(new Error('Something went wrong'))
    const ctx = createHttpContext()
    error.handle(error, ctx)

    assert.include(ctx.response.getBody(), 'Something went wrong\nStack:')
  })

  test('respond with 404 in non-debug mode', async ({ assert }) => {
    const error = new CannotServeFileException(new Error('Something went wrong'))
    error.debug = false
    const ctx = createHttpContext()
    error.handle(error, ctx)

    assert.equal(ctx.response.getBody(), 'File not found')
    assert.equal(ctx.response.getStatus(), 404)
  })
})

test.group('CannotServeFileException | report', () => {
  test('log error', async ({ assert }) => {
    const error = new CannotServeFileException(new Error('Something went wrong'))
    const ctx = createHttpContext()

    const logLines: string[] = []
    ctx.logger = new LoggerFactory()
      .merge({ enabled: true, level: 'info' })
      .pushLogsTo(logLines)
      .create()

    error.report(error, ctx)

    const logs = logLines.map((log) => JSON.parse(log))
    assert.equal(logs[0].msg, 'Something went wrong')
    assert.equal(logs[0].level, 50)
  })

  test('log warning for missing files', async ({ assert }) => {
    const error = new CannotServeFileException(new Error('Cannot get metadata of a directory'))
    const ctx = createHttpContext()

    const logLines: string[] = []
    ctx.logger = new LoggerFactory()
      .merge({ enabled: true, level: 'info' })
      .pushLogsTo(logLines)
      .create()

    error.report(error, ctx)

    const logs = logLines.map((log) => JSON.parse(log))
    assert.equal(logs[0].msg, 'Cannot get metadata of a directory')
    assert.equal(logs[0].level, 40)
  })
})
