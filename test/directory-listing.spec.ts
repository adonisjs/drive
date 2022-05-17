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

import { LocalDriver } from '../src/Drivers/Local'
import { DirectoryListing } from '../src/DirectoryListing'
import { setupApp, fs } from '../test-helpers'
import { DriveListItem } from '@ioc:Adonis/Core/Drive'

const TEST_ROOT = join(fs.basePath, 'storage')

test.group('Directory listing', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('directory listing is async iterable', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)
    const listing = new DirectoryListing(driver, async function* () {})

    assert.isFunction(listing[Symbol.asyncIterator])
    assert.isFunction(listing[Symbol.asyncIterator]().next)
  })

  test('execute listing function passed to constructor with this bound to driver instance', async ({
    assert,
  }) => {
    assert.plan(1)

    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      assert.strictEqual(this, driver)
    }

    const listing = new DirectoryListing(driver, list)

    await listing[Symbol.asyncIterator]().next()
  })

  test('iterate over items yielded from listing generator', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const first = { isFile: true, location: 'first', original: {} }
    const second = { isFile: true, location: 'second', original: {} }

    async function* list() {
      yield first
      yield second
    }

    const listing = new DirectoryListing(driver, list)
    const iterator = listing[Symbol.asyncIterator]()

    assert.deepEqual(await iterator.next(), { done: false, value: first })
    assert.deepEqual(await iterator.next(), { done: false, value: second })
    assert.deepEqual(await iterator.next(), { done: true, value: undefined })
  })

  test('toIterable returns async iterable', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const listing = new DirectoryListing(driver, async function* () {})
    const iterable = listing.toIterable()

    assert.isFunction(iterable[Symbol.asyncIterator])
    assert.isFunction(iterable[Symbol.asyncIterator]().next)
  })

  test('using toIterable is equivalent of asyncIterator', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'first', original: {} }
      yield { isFile: true, location: 'second', original: {} }
    }

    const listing = new DirectoryListing(driver, list)
    const iterator = listing[Symbol.asyncIterator]()
    const iterable = listing.toIterable()[Symbol.asyncIterator]()

    assert.deepEqual(await iterator.next(), await iterable.next())
    assert.deepEqual(await iterator.next(), await iterable.next())
    assert.deepEqual(await iterator.next(), await iterable.next())
  })

  test('convert directory listing to array', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const array = [
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'second', original: {} },
      { isFile: false, location: 'third', original: {} },
    ]

    async function* list() {
      yield* array
    }

    const listing = new DirectoryListing(driver, list)

    assert.deepEqual(await listing.toArray(), array)
  })
})

test.group('Directory listing | pipe', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('call pipe function with async iterable argument and driver as this', async ({ assert }) => {
    assert.plan(3)

    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* pipe(source) {
      assert.strictEqual(this, driver)
      assert.isFunction(source[Symbol.asyncIterator])
      assert.isFunction(source[Symbol.asyncIterator]().next)
    }

    const listing = new DirectoryListing(driver, async function* () {}).pipe(pipe)

    await listing[Symbol.asyncIterator]().next()
  })

  test('pipe returns cloned instance not affecting the original one', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'list', original: {} }
    }

    async function* pipe() {
      yield { isFile: true, location: 'pipe', original: {} }
    }

    const original = new DirectoryListing(driver, list)
    const piped = original.pipe(pipe)

    assert.instanceOf(piped, DirectoryListing)
    assert.notStrictEqual(piped, original)
    assert.deepEqual(await original.toArray(), [{ isFile: true, location: 'list', original: {} }])
    assert.deepEqual(await piped.toArray(), [{ isFile: true, location: 'pipe', original: {} }])
  })

  test('pipe directory listing items through transformation function', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const array = [
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'second', original: {} },
      { isFile: false, location: 'third', original: {} },
    ]

    async function* list() {
      yield* array
    }

    const chain: DriveListItem[] = []

    async function* pipe(source) {
      for await (const item of source) {
        chain.push(item)
        yield item
      }
    }

    const listing = new DirectoryListing(driver, list).pipe(pipe)

    assert.deepEqual(await listing.toArray(), array)
    assert.deepEqual(chain, array)
  })

  test('execute pipe chain in sequence', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'list', original: {} }
    }

    const chain: string[] = []

    async function* first(source) {
      yield* source
      chain.push('first')
      yield { isFile: true, location: 'first', original: {} }
    }

    async function* second(source) {
      yield* source
      chain.push('second')
      yield { isFile: true, location: 'second', original: {} }
    }

    async function* third(source) {
      yield* source
      chain.push('third')
      yield { isFile: true, location: 'third', original: {} }
    }

    const listing = new DirectoryListing(driver, list).pipe(first).pipe(second).pipe(third)

    assert.deepEqual(await listing.toArray(), [
      { isFile: true, location: 'list', original: {} },
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'second', original: {} },
      { isFile: true, location: 'third', original: {} },
    ])
    assert.deepEqual(chain, ['first', 'second', 'third'])
  })
})

test.group('Directory listing | filter', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('execute filter function for every list item', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const array = [
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'second', original: {} },
      { isFile: false, location: 'third', original: {} },
    ]

    async function* list() {
      yield* array
    }

    const items: [DriveListItem, number, LocalDriver][] = []

    const filter = (item, index, dr) => {
      items.push([item, index, dr])
      return true
    }

    const listing = new DirectoryListing(driver, list).filter(filter)

    assert.deepEqual(await listing.toArray(), array)
    assert.deepEqual(items, [
      [array[0], 0, driver],
      [array[1], 1, driver],
      [array[2], 2, driver],
    ])
  })

  test('filter directory listing items', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'first', original: {} }
      yield { isFile: true, location: 'filtered', original: {} }
      yield { isFile: true, location: 'filtered', original: {} }
      yield { isFile: true, location: 'last', original: {} }
      yield { isFile: true, location: 'filtered', original: {} }
    }

    const listing = new DirectoryListing(driver, list).filter(
      (item) => item.location !== 'filtered'
    )

    assert.deepEqual(await listing.toArray(), [
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'last', original: {} },
    ])
  })

  test('filter returns cloned instance not affecting the original one', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'original', original: {} }
    }

    const original = new DirectoryListing(driver, list)
    const filtered = original.filter(() => false)

    assert.instanceOf(filtered, DirectoryListing)
    assert.notStrictEqual(filtered, original)
    assert.deepEqual(await original.toArray(), [
      { isFile: true, location: 'original', original: {} },
    ])
    assert.deepEqual(await filtered.toArray(), [])
  })
})

test.group('Directory listing | map', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('transform directory list items with mapper function', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    const array = [
      { isFile: true, location: 'first', original: {} },
      { isFile: true, location: 'second', original: {} },
      { isFile: false, location: 'third', original: {} },
    ]

    async function* list() {
      yield* array
    }

    const map = (item, index, dr) => [item, index, dr]
    const listing = new DirectoryListing(driver, list).map(map)

    assert.deepEqual(await listing.toArray(), [
      [array[0], 0, driver],
      [array[1], 1, driver],
      [array[2], 2, driver],
    ])
  })

  test('map returns cloned instance not affecting the original one', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }
    const driver = new LocalDriver('local', config, router)

    async function* list() {
      yield { isFile: true, location: 'original', original: {} }
    }

    const original = new DirectoryListing(driver, list)
    const mapped = original.map(() => 'map')

    assert.instanceOf(mapped, DirectoryListing)
    assert.notStrictEqual(mapped, original)
    assert.deepEqual(await original.toArray(), [
      { isFile: true, location: 'original', original: {} },
    ])
    assert.deepEqual(await mapped.toArray(), ['map'])
  })
})

test.group('Directory listing | recursive', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('should recursively call driver list method until item is not file', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const contents = {
      initial: [
        { isFile: true, location: 'initial-leaf', original: {} },
        { isFile: false, location: 'first', original: {} },
      ],
      first: [
        { isFile: true, location: 'first-leaf', original: {} },
        { isFile: false, location: 'second', original: {} },
      ],
      second: [{ isFile: true, location: 'second-leaf', original: {} }],
    }

    const listed: string[] = []

    class Driver extends LocalDriver {
      public list(location: string) {
        listed.push(location)

        return new DirectoryListing(this, async function* () {
          if (contents[location]) {
            yield* contents[location]
          }
        })
      }
    }

    const driver = new Driver('local', config, router)

    assert.deepEqual(await driver.list('initial').recursive().toArray(), [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: true, location: 'first-leaf', original: {} },
      { isFile: true, location: 'second-leaf', original: {} },
    ])
    assert.deepEqual(listed, ['initial', 'first', 'second'])
  })

  test('yield directory as leaf when it is empty', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const contents = {
      initial: [
        { isFile: true, location: 'initial-leaf', original: {} },
        { isFile: false, location: 'first', original: {} },
      ],
      first: [
        { isFile: true, location: 'first-leaf', original: {} },
        { isFile: false, location: 'second', original: {} },
      ],
      second: [],
    }

    const listed: string[] = []

    class Driver extends LocalDriver {
      public list(location: string) {
        listed.push(location)

        return new DirectoryListing(this, async function* () {
          if (contents[location]) {
            yield* contents[location]
          }
        })
      }
    }

    const driver = new Driver('local', config, router)

    assert.deepEqual(await driver.list('initial').recursive().toArray(), [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: true, location: 'first-leaf', original: {} },
      { isFile: false, location: 'second', original: {} },
    ])
    assert.deepEqual(listed, ['initial', 'first', 'second'])
  })

  test('should apply pipe chain before recursively calling list', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const contents = {
      initial: [
        { isFile: true, location: 'initial-leaf', original: {} },
        { isFile: false, location: 'first', original: {} },
      ],
      first: [
        { isFile: true, location: 'first-leaf', original: {} },
        { isFile: false, location: 'second', original: {} },
      ],
      second: [{ isFile: true, location: 'second-leaf', original: {} }],
    }

    class Driver extends LocalDriver {
      public list(location: string) {
        return new DirectoryListing(this, async function* () {
          if (contents[location]) {
            yield* contents[location]
          }
        })
      }
    }

    const driver = new Driver('local', config, router)
    const items: DriveListItem[] = []

    async function* pipe(source) {
      for await (const item of source) {
        items.push(item)
        yield item
      }
    }

    assert.deepEqual(await driver.list('initial').pipe(pipe).recursive().toArray(), [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: true, location: 'first-leaf', original: {} },
      { isFile: true, location: 'second-leaf', original: {} },
    ])
    assert.deepEqual(items, [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: false, location: 'first', original: {} },
      { isFile: true, location: 'first-leaf', original: {} },
      { isFile: false, location: 'second', original: {} },
      { isFile: true, location: 'second-leaf', original: {} },
    ])
  })

  test('call next function to determine location for next level of recursion', async ({
    assert,
  }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const contents = {
      initial: [
        { isFile: true, location: 'initial-leaf', original: {} },
        { isFile: false, location: 'first', original: {} },
      ],
      first: [
        { isFile: true, location: 'first-leaf', original: {} },
        { isFile: false, location: 'second', original: {} },
      ],
      second: [{ isFile: true, location: 'second-leaf', original: {} }],
      third: [{ isFile: false, location: 'back', original: {} }],
      back: [],
    }
    const goto = { first: 'third', back: 'second' }

    const listed: string[] = []
    const items: DriveListItem[] = []

    class Driver extends LocalDriver {
      public list(location: string) {
        listed.push(location)

        return new DirectoryListing(this, async function* () {
          if (contents[location]) {
            yield* contents[location]
          }
        })
      }
    }

    const next = (item) => {
      items.push(item)
      return goto[item.location] || null
    }

    const driver = new Driver('local', config, router)

    assert.deepEqual(await driver.list('initial').recursive(next).toArray(), [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: true, location: 'second-leaf', original: {} },
    ])
    assert.deepEqual(listed, ['initial', 'third', 'second'])
    assert.deepEqual(items, [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: false, location: 'first', original: {} },
      { isFile: false, location: 'back', original: {} },
      { isFile: true, location: 'second-leaf', original: {} },
    ])
  })

  test('call next with depth argument', async ({ assert }) => {
    const app = await setupApp()
    const router = app.container.resolveBinding('Adonis/Core/Route')
    const config = { driver: 'local' as const, root: TEST_ROOT, visibility: 'public' as const }

    const contents = {
      initial: [
        { isFile: true, location: 'initial-leaf', original: {} },
        { isFile: false, location: 'first', original: {} },
      ],
      first: [
        { isFile: true, location: 'first-leaf', original: {} },
        { isFile: false, location: 'second', original: {} },
      ],
      second: [{ isFile: false, location: 'third', original: {} }],
      third: [{ isFile: true, location: 'third-leaf', original: {} }],
    }

    const items: [DriveListItem, number][] = []

    class Driver extends LocalDriver {
      public list(location: string) {
        return new DirectoryListing(this, async function* () {
          if (contents[location]) {
            yield* contents[location]
          }
        })
      }
    }

    const next = (item: DriveListItem, depth: number) => {
      items.push([item, depth])
      return item.isFile ? null : item.location
    }

    const driver = new Driver('local', config, router)

    assert.deepEqual(await driver.list('initial').recursive(next).toArray(), [
      { isFile: true, location: 'initial-leaf', original: {} },
      { isFile: true, location: 'first-leaf', original: {} },
      { isFile: true, location: 'third-leaf', original: {} },
    ])
    assert.deepEqual(items, [
      [{ isFile: true, location: 'initial-leaf', original: {} }, 0],
      [{ isFile: false, location: 'first', original: {} }, 0],
      [{ isFile: true, location: 'first-leaf', original: {} }, 1],
      [{ isFile: false, location: 'second', original: {} }, 1],
      [{ isFile: false, location: 'third', original: {} }, 2],
      [{ isFile: true, location: 'third-leaf', original: {} }, 3],
    ])
  })
})
