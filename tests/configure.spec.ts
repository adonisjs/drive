/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'

import { BASE_URL } from './helpers.js'

test.group('Configure', (group) => {
  group.each.setup(({ context }) => {
    context.fs.baseUrl = new URL('./tmp/', BASE_URL)
    context.fs.basePath = fileURLToPath(context.fs.baseUrl)
  })

  group.each.disableTimeout()

  test('configure package with pre-defined services', async ({ fs, assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }
          return import(filePath)
        },
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, [
      '../../index.js',
      '--services=fs',
      '--services=s3',
    ])
    await command.exec()

    await assert.fileExists('.env')
    await assert.fileExists('adonisrc.ts')
    await assert.fileExists('config/drive.ts')

    await assert.fileContains('adonisrc.ts', '@adonisjs/drive/drive_provider')

    await assert.fileContains('config/drive.ts', 'defineConfig')
    await assert.fileContains('config/drive.ts', `declare module '@adonisjs/drive/types' {`)

    await assert.fileContains('.env', [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'S3_BUCKET',
    ])
    await assert.fileContains('start/env.ts', [
      'AWS_ACCESS_KEY_ID: Env.schema.string()',
      'AWS_SECRET_ACCESS_KEY: Env.schema.string()',
      'AWS_REGION: Env.schema.string()',
      'S3_BUCKET: Env.schema.string()',
    ])

    await assert.fileContains(
      'config/drive.ts',
      `
    fs: services.fs({
      location: app.makePath('storage'),
      visibility: 'public',
      serveFiles: true,
      routeBasePath: '/uploads',
    }),`
    )
    await assert.fileContains(
      'config/drive.ts',
      `
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
      region: env.get('AWS_REGION'),
      bucket: env.get('S3_BUCKET'),
      visibility: 'public',
    }),`
    )
  })

  test('prompt and configure services', async ({ fs, assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }
          return import(filePath)
        },
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, ['../../index.js'])
    command.prompt
      .trap('Select the storage services you want to use')
      .assertFails('', 'Please select one or more services')
      .assertPasses('fs')
      .chooseOption(1)

    await command.exec()

    await assert.fileExists('.env')
    await assert.fileExists('adonisrc.ts')
    await assert.fileExists('config/drive.ts')

    await assert.fileContains('adonisrc.ts', '@adonisjs/drive/drive_provider')

    await assert.fileContains('config/drive.ts', 'defineConfig')
    await assert.fileContains('config/drive.ts', `declare module '@adonisjs/drive/types' {`)

    await assert.fileContains('.env', [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'S3_BUCKET',
    ])
    await assert.fileContains('start/env.ts', [
      'AWS_ACCESS_KEY_ID: Env.schema.string()',
      'AWS_SECRET_ACCESS_KEY: Env.schema.string()',
      'AWS_REGION: Env.schema.string()',
      'S3_BUCKET: Env.schema.string()',
    ])

    await assert.fileContains(
      'config/drive.ts',
      `
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
      region: env.get('AWS_REGION'),
      bucket: env.get('S3_BUCKET'),
      visibility: 'public',
    }),`
    )
  })

  test('configure fs service', async ({ fs, assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }
          return import(filePath)
        },
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, ['../../index.js'])
    command.prompt.trap('Select the storage services you want to use').chooseOption(0)
    await command.exec()

    await assert.fileExists('.env')
    await assert.fileExists('adonisrc.ts')
    await assert.fileExists('config/drive.ts')

    await assert.fileContains('adonisrc.ts', '@adonisjs/drive/drive_provider')

    await assert.fileContains('config/drive.ts', 'defineConfig')
    await assert.fileContains('config/drive.ts', `declare module '@adonisjs/drive/types' {`)

    await assert.fileEquals('.env', '')
    await assert.fileEquals('start/env.ts', `export default Env.create(new URL('./'), {})\n`)

    await assert.fileContains('config/drive.ts', [
      `fs: services.fs({
      location: app.makePath('storage'),
      visibility: 'public',
      serveFiles: true,
      routeBasePath: '/uploads',
    }),`,
      `import app from '@adonisjs/core/services/app'`,
    ])
  })

  test('print error when trying to configure an unknown service', async ({ fs, assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }
          return import(filePath)
        },
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, ['../../index.js', '--services=foo'])
    await command.exec()

    command.assertFailed()
  })
})
