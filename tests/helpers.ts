/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { HttpContext, Router } from '@adonisjs/core/http'
import { AppFactory } from '@adonisjs/core/factories/app'
import { IncomingMessage, ServerResponse } from 'node:http'
import type { ApplicationService } from '@adonisjs/core/types'
import { EncryptionFactory } from '@adonisjs/core/factories/encryption'
import {
  RequestFactory,
  ResponseFactory,
  QsParserFactory,
  HttpContextFactory,
} from '@adonisjs/core/factories/http'

import { Disk } from '../index.js'
import { FSDriver } from '../drivers/fs/main.js'
import type { AdonisFSDriverOptions } from '../src/types.js'
import type { FSDriverOptions } from '../drivers/fs/types.js'

export const BASE_URL = new URL('./', import.meta.url)
const qs = new QsParserFactory().create()
const app = new AppFactory().create(BASE_URL) as unknown as ApplicationService
const encryption = new EncryptionFactory().create()

export function createRouter() {
  const router = new Router(app, encryption, qs)
  return router
}

export async function createAppWithRouter() {
  const application = new AppFactory().create(BASE_URL) as unknown as ApplicationService
  await application.init()

  application.container.bind('router', () => createRouter())
  return application
}

export function getFSDriverConfig(
  configToMerge?: Partial<AdonisFSDriverOptions>
): AdonisFSDriverOptions {
  return {
    location: BASE_URL,
    visibility: 'public' as const,
    routeBasePath: 'uploads',
    ...configToMerge,
  }
}

export function createHttpContext(req?: IncomingMessage, res?: ServerResponse) {
  const request = new RequestFactory().merge({ req, res }).create()
  const response = new ResponseFactory().merge({ req, res }).create()
  return new HttpContextFactory().merge({ request, response }).create()
}

export function createDisk(options?: Partial<FSDriverOptions>) {
  return new Disk(
    new FSDriver({
      ...getFSDriverConfig(),
      ...options,
    })
  )
}

export function createRouteHandler(forFile: string, originalHandler: (ctx: HttpContext) => any) {
  return async function (req: IncomingMessage, res: ServerResponse) {
    const ctx = createHttpContext(req, res)
    ctx.params = { '*': [forFile] }
    try {
      await originalHandler(ctx)
    } catch (error) {
      if (typeof error.handle === 'function') {
        await error.handle(error, ctx)
      } else {
        ctx.response.internalServerError(error)
      }
    } finally {
      ctx.response.finish()
    }
  }
}
