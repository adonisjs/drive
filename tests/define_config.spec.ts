/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'

import { FSDriver } from '../drivers/fs/main.js'
import { S3Driver } from '../drivers/s3/main.js'
import { GCSDriver } from '../drivers/gcs/main.js'
import { createAppWithRouter, BASE_URL } from './helpers.js'
import { defineConfig, services } from '../src/define_config.js'

test.group('Define config', () => {
  test('configure fs driver', async ({ assert }) => {
    const provider = defineConfig({
      default: 'fs',
      services: {
        fs: services.fs({
          location: BASE_URL,
          visibility: 'public',
        }),
      },
    })

    const app = await createAppWithRouter()
    const config = await configProvider.resolve<any>(app, provider)
    assert.deepEqual(config.locallyServed, [])
    assert.containsSubset(config.config, {
      default: 'fs',
      services: {},
    })
    assert.exists(config.config.fakes)
    assert.equal(config.config.fakes.location, app.tmpPath('drive-fakes'))
    assert.isFunction(config.config.services.fs)
    assert.instanceOf(config.config.services.fs(), FSDriver)
  })

  test('throw error when serving files without route path', async ({ assert }) => {
    const provider = defineConfig({
      default: 'fs',
      services: {
        // @ts-expect-error
        fs: services.fs({
          location: BASE_URL,
          visibility: 'public',
          serveFiles: true,
        }),
      },
    })

    const app = await createAppWithRouter()
    await assert.rejects(
      () => configProvider.resolve<any>(app, provider),
      'Invalid drive config. Missing "routeBasePath" option in "services.fs" object'
    )
  })

  test('configure fs driver and serve files locally', async ({ assert }) => {
    const provider = defineConfig({
      default: 'fs',
      services: {
        fs: services.fs({
          location: BASE_URL,
          serveFiles: true,
          routeBasePath: 'uploads',
          visibility: 'public',
        }),
      },
    })

    const app = await createAppWithRouter()
    const config = await configProvider.resolve<any>(app, provider)
    assert.deepEqual(config.locallyServed, [
      {
        routeName: 'drive.fs.serve',
        routePattern: 'uploads/*',
        service: 'fs',
      },
    ])
    assert.containsSubset(config.config, {
      default: 'fs',
      services: {},
    })
    assert.isFunction(config.config.services.fs)
    assert.instanceOf(config.config.services.fs(), FSDriver)
  })

  test('configure s3 driver', async ({ assert }) => {
    const provider = defineConfig({
      default: 's3',
      services: {
        s3: services.s3({
          bucket: '',
          visibility: 'public',
        }),
      },
    })

    const app = await createAppWithRouter()
    const config = await configProvider.resolve<any>(app, provider)
    assert.containsSubset(config.config, {
      default: 's3',
      services: {},
    })
    assert.isFunction(config.config.services.s3)
    assert.instanceOf(config.config.services.s3(), S3Driver)
  })

  test('configure gcs driver', async ({ assert }) => {
    const provider = defineConfig({
      default: 'gcs',
      services: {
        gcs: services.gcs({
          bucket: '',
          visibility: 'public',
        }),
      },
    })

    const app = await createAppWithRouter()
    const config = await configProvider.resolve<any>(app, provider)
    assert.containsSubset(config.config, {
      default: 'gcs',
      services: {},
    })
    assert.isFunction(config.config.services.gcs)
    assert.instanceOf(config.config.services.gcs(), GCSDriver)
  })
})
