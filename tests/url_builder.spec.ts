/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { createURLBuilder } from '../src/url_builder.js'
import { createRouter, getFSDriverConfig } from './helpers.js'

test.group('URL Builder', () => {
  test('create file URL using the URL builder', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const router = createRouter()
    const config = getFSDriverConfig()

    router.get(`${config.routeBasePath}/*`, () => {}).as(routeName)
    router.commit()

    const fileServer = createURLBuilder(router, config, routeName)
    assert.equal(
      await fileServer.generateURL('posts/1/cover.jpg', ''),
      '/uploads/posts/1/cover.jpg'
    )
  })

  test('append app URL to the file URL', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const router = createRouter()
    const config = getFSDriverConfig({ appUrl: 'http://localhost:3333' })

    router.get(`${config.routeBasePath}/*`, () => {}).as(routeName)
    router.commit()

    const fileServer = createURLBuilder(router, config, routeName)
    assert.equal(
      await fileServer.generateURL('posts/1/cover.jpg', ''),
      'http://localhost:3333/uploads/posts/1/cover.jpg'
    )
  })

  test('create signed URL using the URL builder', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const router = createRouter()
    const config = getFSDriverConfig({ appUrl: 'http://localhost:3333' })

    router.get(`${config.routeBasePath}/*`, () => {}).as(routeName)
    router.commit()

    const fileServer = createURLBuilder(router, config, routeName)
    const generatedURL = new URL(await fileServer.generateSignedURL('posts/1/cover.jpg', '', {}))
    assert.isTrue(generatedURL.searchParams.has('signature'))
  })

  test('create signed URL with response headers', async ({ assert }) => {
    const routeName = 'drive.fs.serve'
    const router = createRouter()
    const config = getFSDriverConfig({ appUrl: 'http://localhost:3333' })

    router.get(`${config.routeBasePath}/*`, () => {}).as(routeName)
    router.commit()

    const fileServer = createURLBuilder(router, config, routeName)
    const generatedURL = new URL(
      await fileServer.generateSignedURL('posts/1/cover.jpg', '', {
        contentDisposition: 'attachment',
        contentType: 'image/jpg',
        contentLanguage: 'en-in',
        cacheControl: 'no-cache',
      })
    )

    assert.isTrue(generatedURL.searchParams.has('signature'))
    assert.equal(generatedURL.searchParams.get('contentDisposition'), 'attachment')
    assert.equal(generatedURL.searchParams.get('contentLanguage'), 'en-in')
    assert.equal(generatedURL.searchParams.get('cacheControl'), 'no-cache')
    assert.equal(generatedURL.searchParams.get('contentType'), 'image/jpg')
  })
})
