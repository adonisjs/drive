/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import supertest from 'supertest'
import { test } from '@japa/runner'
import { createServer } from 'node:http'
import { createFileServer } from '../src/file_server.js'
import { createURLBuilder } from '../src/url_builder.js'
import { createDisk, createRouteHandler, createRouter, getFSDriverConfig } from './helpers.js'

test.group('File server | public files', () => {
  test('return 404 when file does not exist', async ({ assert }) => {
    const disk = createDisk()
    const fileServer = createFileServer(disk)

    const server = createServer(createRouteHandler('foo/bar.jpg', fileServer))

    const response = await supertest(server).get('/uploads/foo/bar.jpg')
    assert.equal(response.statusCode, 404)
    assert.include(response.text, 'no such file or directory')
  })

  test('return 401 when using invalid signature', async ({ assert }) => {
    const disk = createDisk()
    const fileServer = createFileServer(disk)

    const server = createServer(createRouteHandler('foo/bar.jpg', fileServer))

    const response = await supertest(server).get('/uploads/foo/bar.jpg?signature=foo')
    assert.equal(response.statusCode, 401)
    assert.include(response.text, 'Access denied')
  })

  test('serve file', async ({ assert }) => {
    const disk = createDisk()
    const fileServer = createFileServer(disk)

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get('/sample.jpg')
    assert.equal(response.statusCode, 200)
    assert.properties(response.headers, ['content-type', 'content-length', 'last-modified', 'etag'])
    assert.equal(response.headers['content-type'], 'image/jpeg')
    assert.equal(response.headers['content-length'], '51085')
  })
})

test.group('File server | private files', () => {
  test('return 401 when trying to access a private file without signature', async ({ assert }) => {
    const disk = createDisk({ visibility: 'private' as const })
    const fileServer = createFileServer(disk)

    const server = createServer(createRouteHandler('foo/bar.jpg', fileServer))

    const response = await supertest(server).get('/uploads/foo/bar.jpg')
    assert.equal(response.statusCode, 401)
    assert.include(response.text, 'Access denied')
  })

  test('return 401 when trying to access a private file with invalid signature', async ({
    assert,
  }) => {
    const disk = createDisk({ visibility: 'private' as const })
    const fileServer = createFileServer(disk)

    const server = createServer(createRouteHandler('foo/bar.jpg', fileServer))

    const response = await supertest(server).get('/uploads/foo/bar.jpg?signature=foo')
    assert.equal(response.statusCode, 401)
    assert.include(response.text, 'Access denied')
  })

  test('serve private file using valid signature', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {})

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get(URI)
    assert.equal(response.statusCode, 200)
    assert.properties(response.headers, ['content-type', 'content-length', 'last-modified', 'etag'])
    assert.equal(response.headers['content-type'], 'image/jpeg')
    assert.equal(response.headers['content-length'], '51085')
  })

  test('override file content length via signed URL', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {
      contentType: 'image/png',
    })

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get(URI)
    assert.equal(response.statusCode, 200)
    assert.properties(response.headers, ['content-type', 'content-length', 'last-modified', 'etag'])
    assert.equal(response.headers['content-type'], 'image/png')
    assert.equal(response.headers['content-length'], '51085')
  })

  test('override file cache-control header via signed URL', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {
      cacheControl: 'private,no-cache',
    })

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get(URI)
    assert.equal(response.statusCode, 200)
    assert.properties(response.headers, ['content-type', 'content-length', 'cache-control', 'etag'])
    assert.notProperty(response.headers, 'last-modified')
  })

  test('define all content headers via signed URL', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {
      contentDisposition: 'attachment',
      contentEncoding: 'utf-8',
      contentLanguage: 'en-in',
    })

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get(URI)
    assert.equal(response.statusCode, 200)
    assert.properties(response.headers, [
      'content-type',
      'content-disposition',
      'content-encoding',
      'content-language',
    ])
  })

  test('do not set content-length for HEAD requests', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {})

    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).head(URI)
    assert.equal(response.statusCode, 200)
    assert.notProperty(response.headers, 'content-length')
  })

  test('respond with 304 when cache is fresh', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)
    const { etag } = await disk.getMetaData('sample.jpg')

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {})
    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).head(URI).set('If-None-Match', etag)
    assert.equal(response.statusCode, 304)
  })

  test('respond with 304 for a get request when cache is fresh', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const config = getFSDriverConfig({ visibility: 'private' as const })
    const disk = createDisk(config)
    const fileServer = createFileServer(disk)
    const { etag } = await disk.getMetaData('sample.jpg')

    const router = createRouter()
    router.get('/uploads/*', () => {}).as(routeName)
    router.commit()

    const urlBuilder = createURLBuilder(router, config, routeName)
    const URI = await urlBuilder.generateSignedURL('sample.jpg', '', {})
    const server = createServer(createRouteHandler('sample.jpg', fileServer))

    const response = await supertest(server).get(URI).set('If-None-Match', etag)
    assert.equal(response.statusCode, 304)
  })
})
