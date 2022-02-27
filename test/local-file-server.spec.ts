/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import etag from 'etag'
import { join } from 'path'
import supertest from 'supertest'
import { createServer } from 'http'
import { setupApp, fs } from '../test-helpers'
import { LocalDriver } from '../src/Drivers/Local'
import { LocalFileServer } from '../src/LocalFileServer'

const TEST_ROOT = join(fs.basePath, 'storage')

test.group('Local file server', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('raise exception when basePath is not configured', async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
    }

    const driver = new LocalDriver('local', config, router)
    try {
      new LocalFileServer('local', config, driver, router, logger).registerRoute()
    } catch (error) {
      assert.equal(
        error.message,
        'E_MISSING_LOCAL_DRIVER_BASEPATH: Missing property "basePath" in "local" disk config'
      )
    }
  })

  test('serve file from a url', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')
    await driver.put('你好.txt', '你好')
    await driver.put('Здравствыйте.txt', 'Здравствыйте')

    const { text, headers } = await supertest(server)
      .get(await driver.getUrl('foo.txt'))
      .expect(200)
    const { text: chineseText, headers: chineseHeaders } = await supertest(server)
      .get(await driver.getUrl(encodeURIComponent('你好.txt')))
      .expect(200)
    const { text: cyrillicText, headers: cyrillicHeaders } = await supertest(server)
      .get(await driver.getUrl(encodeURIComponent('Здравствыйте.txt')))
      .expect(200)

    assert.equal(text, 'hello world')
    assert.equal(headers['content-length'], 'hello world'.length)
    assert.equal(headers['content-type'], 'text/plain; charset=utf-8')

    assert.equal(chineseText, '你好')
    // https://en.wikipedia.org/wiki/UTF-8#Description
    // Single Chinese words is equal to 3 bytes
    assert.equal(chineseHeaders['content-length'], '你好'.length * 3)
    assert.equal(chineseHeaders['content-type'], 'text/plain; charset=utf-8')

    assert.equal(cyrillicText, 'Здравствыйте')
    // https://en.wikipedia.org/wiki/UTF-8#Description
    // Single Cyril words is equal to 2 bytes
    assert.equal(cyrillicHeaders['content-length'], 'Здравствыйте'.length * 2)
    assert.equal(cyrillicHeaders['content-type'], 'text/plain; charset=utf-8')
  })

  test('set etag when serving files', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')

    const { text, headers } = await supertest(server)
      .get(await driver.getUrl('foo.txt'))
      .expect(200)

    assert.equal(text, 'hello world')
    assert.property(headers, 'etag')
  })

  test('invalidate cache when private file signature has expired', async () => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')
    const fileEtag = etag(await driver.adapter.stat(driver.makePath('foo.txt')))

    const url = await driver.getSignedUrl('foo.txt', { expiresIn: '1sec' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    await supertest(server).head(url).set('if-none-match', fileEtag).expect(401)
  }).timeout(6000)

  test('respond with 304 for HEAD requests when cache is fresh', async () => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')
    const fileEtag = etag(await driver.adapter.stat(driver.makePath('foo.txt')))

    const url = await driver.getSignedUrl('foo.txt', { expiresIn: '1sec' })

    await supertest(server).head(url).set('if-none-match', fileEtag).expect(304)
  }).timeout(6000)

  test('respond with 200 for HEAD requests when cache is stale', async () => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')
    const url = await driver.getSignedUrl('foo.txt', { expiresIn: '1sec' })

    await supertest(server).head(url).expect(200)
  }).timeout(6000)

  test('do not serve file when cache is fresh', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')
    const fileEtag = etag(await driver.adapter.stat(driver.makePath('foo.txt')))

    const { text, headers } = await supertest(server)
      .get(await driver.getUrl('foo.txt'))
      .set('if-none-match', fileEtag)
      .expect(304)

    assert.equal(text, '')
    assert.equal(headers['etag'], fileEtag)
  })

  test('deny access when attempting to access a private file without signedUrl', async ({
    assert,
  }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')

    const { text } = await supertest(server)
      .get(await driver.getUrl('foo.txt'))
      .expect(401)

    assert.equal(text, 'Access denied')
  })

  test('return error when trying to access a directory', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('bar/foo.txt', 'hello world')

    const { text } = await supertest(server)
      .get(await driver.getUrl('bar'))
      .expect(404)

    assert.equal(text, 'File not found')
  })

  test('return error when trying to access a non existing file', async () => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await supertest(server)
      .get(await driver.getUrl('bar/foo.txt'))
      .expect(404)
  })

  test('serve private files using signed url', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')

    const { text, headers } = await supertest(server)
      .get(await driver.getSignedUrl('foo.txt'))
      .expect(200)

    assert.equal(text, 'hello world')
    assert.equal(headers['content-length'], 'hello world'.length)
    assert.equal(headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('use signed url content headers when defined', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', '{"hello": "world"}')

    const { body, headers } = await supertest(server)
      .get(
        await driver.getSignedUrl('foo.txt', {
          contentType: 'application/json',
          cacheControl: 'private',
          contentEncoding: 'utf-8',
          contentLanguage: 'en-in',
          contentDisposition: 'attachment',
        })
      )
      .expect(200)

    assert.deepEqual(body, { hello: 'world' })
    assert.equal(headers['content-length'], '{"hello": "world"}'.length)
    assert.equal(headers['content-type'], 'application/json')
    assert.equal(headers['content-disposition'], 'attachment')
    assert.equal(headers['content-encoding'], 'utf-8')
    assert.equal(headers['content-language'], 'en-in')
    assert.equal(headers['cache-control'], 'private')
  })

  test('do not use content headers on a public file with invalid signature', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', '{"hello": "world"}')

    const { text, headers } = await supertest(server)
      .get(`${await driver.getUrl('foo.txt')}?signature=foo&content-type=image/png`)
      .expect(401)

    assert.deepEqual(text, 'Access denied')
    assert.equal(headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('serve public files from the signed url', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const adonisServer = app.container.resolveBinding('Adonis/Core/Server')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    adonisServer.optimize()

    const server = createServer(adonisServer.handle.bind(adonisServer))
    await driver.put('foo.txt', 'hello world')

    const { text, headers } = await supertest(server)
      .get(await driver.getSignedUrl('foo.txt'))
      .expect(200)

    assert.equal(text, 'hello world')
    assert.property(headers, 'etag')
  })
})
