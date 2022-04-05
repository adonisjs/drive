/*
 * @adonisjs/core
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'path'
import { setupApp, fs } from '../test-helpers'
import { DriveManager } from '../src/DriveManager'

test.group('Drive Manager', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make instance of the local driver', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    assert.isFalse(await drive.use('local').exists('foo.txt'))
  })

  test('run operations using the default disk', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)

    await drive.put('foo.txt', 'hello world')

    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')
    assert.isTrue(await drive.exists('foo.txt'))

    await drive.copy('foo.txt', 'bar.txt')
    assert.equal((await drive.get('bar.txt')).toString(), 'hello world')

    await drive.move('bar.txt', 'baz.txt')
    assert.isTrue(await drive.exists('baz.txt'))
    assert.isFalse(await drive.exists('bar.txt'))

    await drive.delete('baz.txt')
    assert.isFalse(await drive.exists('baz.txt'))

    const stats = await drive.getStats('foo.txt')
    assert.equal(stats.isFile, true)
    assert.equal(stats.size, 'hello world'.length)

    assert.equal(await drive.getVisibility('foo.txt'), 'public')
  })

  test('extend drive to add a custom driver', async ({ assert }) => {
    assert.plan(2)
    const app = await setupApp()

    const config = {
      disk: 's3' as const,
      disks: {
        s3: {
          driver: 's3' as const,
        },
      },
    } as any

    class DummyS3 {
      public put(filePath: string, contents: any) {
        assert.equal(filePath, 'foo.txt')
        assert.equal(contents, 'hello world')
      }
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.extend('s3', () => new DummyS3() as any)

    await drive.put('foo.txt', 'hello world')
  })

  test('fake the default disk', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.fake()
    assert.equal(drive.use().name, 'fake')

    await drive.put('foo.txt', 'hello world')
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'foo.txt')))

    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')
    assert.isTrue(await drive.exists('foo.txt'))

    await drive.copy('foo.txt', 'bar.txt')
    assert.equal((await drive.get('bar.txt')).toString(), 'hello world')
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'bar.txt')))

    await drive.move('bar.txt', 'baz.txt')
    assert.isTrue(await drive.exists('baz.txt'))
    assert.isFalse(await drive.exists('bar.txt'))
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'baz.txt')))

    await drive.delete('baz.txt')
    assert.isFalse(await drive.exists('baz.txt'))

    const stats = await drive.getStats('foo.txt')
    assert.equal(stats.isFile, true)
    assert.equal(stats.size, 'hello world'.length)

    assert.equal(await drive.getVisibility('foo.txt'), 'public')
  })

  test('faking a disk should not impact the other disk', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
        assets: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.fake()

    await drive.put('foo.txt', 'hello world')
    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')
    assert.isFalse(await drive.use('assets' as any).exists('foo.txt'))

    assert.equal(drive.use().name, 'fake')
    assert.equal(drive.use('assets' as any).name, 'local')
  })

  test('restore a fake', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
        assets: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.fake()

    await drive.put('foo.txt', 'hello world')
    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')

    drive.restore()
    assert.equal(drive.use().name, 'local')
    assert.isFalse(await drive.exists('foo.txt'))
  })

  test('restore all fakes', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
        assets: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.fake()

    await drive.put('foo.txt', 'hello world')
    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')

    drive.restoreAll()
    assert.equal(drive.use().name, 'local')
    assert.isFalse(await drive.exists('foo.txt'))
  })

  test('overwrite existing file when using fakes', async ({ assert }) => {
    const app = await setupApp()

    const config = {
      disk: 'local' as const,
      disks: {
        local: {
          driver: 'local' as const,
          root: join(fs.basePath, 'storage'),
          basePath: '/uploads',
          visibility: 'public' as const,
        },
      },
    }

    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const drive = new DriveManager(app, router, logger, config)
    drive.fake()
    assert.equal(drive.use().name, 'fake')

    await drive.put('foo.txt', 'hello world')
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'foo.txt')))

    assert.equal((await drive.get('foo.txt')).toString(), 'hello world')
    assert.isTrue(await drive.exists('foo.txt'))

    /**
     * Overwrite existing file
     */
    await drive.put('foo.txt', 'hi world')
    assert.equal((await drive.get('foo.txt')).toString(), 'hi world')

    await drive.copy('foo.txt', 'bar.txt')
    assert.equal((await drive.get('bar.txt')).toString(), 'hi world')
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'bar.txt')))

    await drive.move('bar.txt', 'baz.txt')
    assert.isTrue(await drive.exists('baz.txt'))
    assert.isFalse(await drive.exists('bar.txt'))
    assert.isFalse(await fs.fsExtra.pathExists(join(fs.basePath, 'storage', 'baz.txt')))

    await drive.move('foo.txt', 'baz.txt')
    assert.isTrue(await drive.exists('baz.txt'))
    assert.isFalse(await drive.exists('foo.txt'))

    await drive.delete('baz.txt')
    assert.isFalse(await drive.exists('baz.txt'))
  })
})
