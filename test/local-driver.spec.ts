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
import { Readable } from 'stream'

import { LocalDriver } from '../src/Drivers/Local'
import { LocalFileServer } from '../src/LocalFileServer'
import { setupApp, fs } from '../test-helpers'

const TEST_ROOT = join(fs.basePath, 'storage')

test.group('Local driver | put', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('write file to the destination', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')

    const contents = await driver.get('foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('create intermediate directories when missing', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('bar/baz/foo.txt', 'hello world')

    const contents = await driver.get('bar/baz/foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('overwrite destination when file already exists', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hi world')
    await driver.put('foo.txt', 'hello world')

    const contents = await driver.get('foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })
})

test.group('Local driver | putStream', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('write stream to a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    const stream = new Readable({
      read() {
        this.push('hello world')
        this.push(null)
      },
    })

    assert.isTrue(stream.readable)
    await driver.putStream('foo.txt', stream)
    assert.isFalse(stream.readable)

    const contents = await driver.get('foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('create intermediate directories when writing a stream to a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    const stream = new Readable({
      read() {
        this.push('hello world')
        this.push(null)
      },
    })

    assert.isTrue(stream.readable)
    await driver.putStream('bar/baz/foo.txt', stream)
    assert.isFalse(stream.readable)

    const contents = await driver.get('bar/baz/foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('overwrite existing file when stream to a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    const stream = new Readable({
      read() {
        this.push('hello world')
        this.push(null)
      },
    })

    assert.isTrue(stream.readable)
    await driver.put('foo.txt', 'hi world')
    await driver.putStream('foo.txt', stream)
    assert.isFalse(stream.readable)

    const contents = await driver.get('foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })
})

test.group('Local driver | exists', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('return true when a file exists', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('bar/baz/foo.txt', 'bar')
    assert.isTrue(await driver.exists('bar/baz/foo.txt'))
  })

  test("return false when a file doesn't exists", async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    assert.isFalse(await driver.exists('foo.txt'))
  })

  test("return false when a file parent directory doesn't exists", async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    assert.isFalse(await driver.exists('bar/baz/foo.txt'))
  })
})

test.group('Local driver | delete', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('remove file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('bar/baz/foo.txt', 'bar')
    await driver.delete('bar/baz/foo.txt')

    assert.isFalse(await driver.exists(join(TEST_ROOT, 'bar/baz/foo.txt')))
  })

  test('do not error when trying to remove a non-existing file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    await driver.delete('foo.txt')
    assert.isFalse(await driver.exists(join(TEST_ROOT, 'foo.txt')))
  })

  test("do not error when file parent directory doesn't exists", async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    await driver.delete('bar/baz/foo.txt')
    assert.isFalse(await driver.exists(join(TEST_ROOT, 'bar/baz/foo.txt')))
  })
})

test.group('Local driver | copy', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('copy file from within the disk root', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')
    await driver.copy('foo.txt', 'bar.txt')

    const contents = await driver.get('bar.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('create intermediate directories when copying a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')
    await driver.copy('foo.txt', 'baz/bar.txt')

    const contents = await driver.get('baz/bar.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test("return error when source doesn't exists", async ({ assert }) => {
    assert.plan(1)

    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    try {
      await driver.copy('foo.txt', 'bar.txt')
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_COPY_FILE: Cannot copy file from "foo.txt" to "bar.txt"'
      )
    }
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')
    await driver.put('bar.txt', 'hi world')
    await driver.copy('foo.txt', 'bar.txt')

    const contents = await driver.get('bar.txt')
    assert.equal(contents.toString(), 'hello world')
  })
})

test.group('Local driver | move', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('move file from within the disk root', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')
    await driver.move('foo.txt', 'bar.txt')

    const contents = await driver.get('bar.txt')
    assert.equal(contents.toString(), 'hello world')
    assert.isFalse(await driver.exists('foo.txt'))
  })

  test('create intermediate directories when moving a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')
    await driver.move('foo.txt', 'baz/bar.txt')

    const contents = await driver.get('baz/bar.txt')
    assert.equal(contents.toString(), 'hello world')
    assert.isFalse(await driver.exists('foo.txt'))
  })

  test("return error when source doesn't exists", async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    try {
      await driver.move('foo.txt', 'baz/bar.txt')
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_MOVE_FILE: Cannot move file from "foo.txt" to "baz/bar.txt"'
      )
    }
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    await driver.put('foo.txt', 'hello world')
    await driver.put('baz/bar.txt', 'hi world')

    await driver.move('foo.txt', 'baz/bar.txt')

    const contents = await driver.get('baz/bar.txt')
    assert.equal(contents.toString(), 'hello world')
  })
})

test.group('Local driver | get', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get file contents', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')

    const contents = await driver.get('foo.txt')
    assert.equal(contents.toString(), 'hello world')
  })

  test('get file contents as a stream', async ({ assert }, done) => {
    assert.plan(1)

    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')

    const stream = await driver.getStream('foo.txt')
    stream.on('data', (chunk) => {
      assert.equal(chunk, 'hello world')
      done()
    })
  }).waitForDone()

  test("return error when file doesn't exists", async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    try {
      await driver.get('foo.txt')
    } catch (error) {
      assert.equal(error.message, 'E_CANNOT_READ_FILE: Cannot read file from location "foo.txt"')
    }
  })
})

test.group('Local driver | getStats', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get file stats', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)
    await driver.put('foo.txt', 'hello world')

    const stats = await driver.getStats('foo.txt')
    assert.equal(stats.size, 11)
    assert.instanceOf(stats.modified, Date)
  })

  test('return error when file is missing', async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    try {
      await driver.getStats('foo.txt')
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_GET_METADATA: Unable to retrieve the "stats" for file at location "foo.txt"'
      )
    }
  })
})

test.group('Local driver | getUrl', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get url to a given file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    router.commit()

    const url = await driver.getUrl('foo.txt')
    assert.equal(url, '/uploads/foo.txt')
  })
})

test.group('Local driver | getVisibility', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('return disk visibility for a file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    assert.equal(await driver.getVisibility('foo.txt'), 'public')
  })
})

test.group('Local driver | setVisibility', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('setVisibility should result in noop', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'public' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    await driver.setVisibility('foo.txt', 'private')
    assert.equal(await driver.getVisibility('foo.txt'), 'public')
  })
})

test.group('Local driver | getSignedUrl', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get signed url to a given file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    const config = {
      driver: 'local' as const,
      root: TEST_ROOT,
      visibility: 'private' as const,
      serveFiles: true,
      basePath: '/uploads',
    }

    const driver = new LocalDriver('local', config, router)
    new LocalFileServer('local', config, driver, router, logger).registerRoute()
    router.commit()

    const url = await driver.getSignedUrl('foo.txt')
    assert.match(url, /\/uploads\/foo\.txt\?signature=.*/)
  })
})

test.group('Local driver | list', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  const files = ['foo.txt', 'bar/baz/foo.txt', 'foo/bar.js', 'dir/a.txt', 'dir/b.js', 'dir/c.png']

  test('list directory contents in "{path}"')
    .with([
      { path: '.', contents: { 'foo.txt': true, 'bar': false, 'foo': false, 'dir': false } },
      { path: 'dir', contents: { 'dir/a.txt': true, 'dir/b.js': true, 'dir/c.png': true } },
      { path: 'bar/baz', contents: { 'bar/baz/foo.txt': true } },
    ])
    .run(async ({ assert }, { path, contents }) => {
      const app = await setupApp()
      const router = app.container.resolveBinding('Adonis/Core/Route')
      const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
      const driver = new LocalDriver('local', config, router)

      await Promise.all(files.map((file) => driver.put(file, file)))
      const list = await driver.list(path).toArray()

      assert.containsSubset(
        list,
        Object.entries(contents).map(([location, isFile]) => ({ location, isFile }))
      )
    })

  test('list directory contents recursively in "{path}"')
    .with([
      {
        path: '.',
        contents: {
          'foo.txt': true,
          'bar/baz/foo.txt': true,
          'foo/bar.js': true,
          'dir/a.txt': true,
          'dir/b.js': true,
          'dir/c.png': true,
        },
      },
      { path: 'dir', contents: { 'dir/a.txt': true, 'dir/b.js': true, 'dir/c.png': true } },
      { path: 'bar', contents: { 'bar/baz/foo.txt': true } },
    ])
    .run(async ({ assert }, { path, contents }) => {
      const app = await setupApp()
      const router = app.container.resolveBinding('Adonis/Core/Route')
      const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
      const driver = new LocalDriver('local', config, router)

      await Promise.all(files.map((file) => driver.put(file, file)))
      const list = await driver.list(path).recursive().toArray()

      assert.containsSubset(
        list,
        Object.entries(contents).map(([location, isFile]) => ({ location, isFile }))
      )
    })

  test('list only files in "{path}" directory using filter')
    .with([
      { path: '.', contents: ['foo.txt'] },
      { path: 'dir', contents: ['dir/a.txt', 'dir/b.js', 'dir/c.png'] },
      { path: 'bar', contents: [] },
    ])
    .run(async ({ assert }, { path, contents }) => {
      const app = await setupApp()
      const router = app.container.resolveBinding('Adonis/Core/Route')
      const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
      const driver = new LocalDriver('local', config, router)

      await Promise.all(files.map((file) => driver.put(file, file)))
      const list = await driver
        .list(path)
        .filter(({ isFile }) => isFile)
        .toArray()

      assert.containsSubset(
        list,
        contents.map((location) => ({ location, isFile: true }))
      )
    })

  test('transform contents of "{path}" directory using map')
    .with([
      { path: '.', contents: ['~foo.txt', '~bar', '~foo', '~dir'] },
      { path: 'dir', contents: ['~dir/a.txt', '~dir/b.js', '~dir/c.png'] },
      { path: 'bar/baz', contents: ['~bar/baz/foo.txt'] },
    ])
    .run(async ({ assert }, { path, contents }) => {
      const app = await setupApp()
      const router = app.container.resolveBinding('Adonis/Core/Route')
      const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
      const driver = new LocalDriver('local', config, router)

      await Promise.all(files.map((file) => driver.put(file, file)))
      const list = await driver
        .list(path)
        .map(({ location }) => `~${location}`)
        .toArray()

      assert.sameMembers(list, contents)
    })

  test('pipe contents of "{path}" directory through transformer')
    .with([
      {
        path: '.',
        contents: [
          ['foo.txt', true],
          ['bar', false],
          ['foo', false],
          ['dir', false],
        ],
      },
      {
        path: 'dir',
        contents: [
          ['dir/a.txt', true],
          ['dir/b.js', true],
          ['dir/c.png', true],
        ],
      },
      { path: 'bar/baz', contents: [['bar/baz/foo.txt', true]] },
      { path: 'bar', contents: [['bar/baz', false]] },
    ])
    .run(async ({ assert }, { path, contents }) => {
      const app = await setupApp()
      const router = app.container.resolveBinding('Adonis/Core/Route')
      const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
      const driver = new LocalDriver('local', config, router)

      await Promise.all(files.map((file) => driver.put(file, file)))

      async function* pipe(source) {
        for await (const item of source) {
          yield [item.location, item.isFile]
        }
      }

      const list = await driver.list(path).pipe(pipe).toArray()

      assert.sameDeepMembers(list, contents)
    })

  test('return error when directory does not exist', async ({ assert }) => {
    assert.plan(1)
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const driver = new LocalDriver('local', config, router)

    try {
      await driver.list('foo').toArray()
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_LIST_DIRECTORY: Cannot list directory contents of location "foo"'
      )
    }
  })
})
