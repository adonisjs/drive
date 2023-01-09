/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join, sep, normalize } from 'path'
import { fs } from '../test-helpers'
import { PathPrefixer } from '../src/PathPrefixer'

const TEST_ROOT = join(fs.basePath, 'storage')

test.group('Path prefixer | prefix', () => {
  test('always end non-empty prefix with single slash: "{prefix}"')
    .with([
      { prefix: '/without/slash', expected: '/without/slash/' },
      { prefix: '/with/single/', expected: '/with/single/' },
      { prefix: '/with/multiple//', expected: '/with/multiple/' },
      { prefix: '/', expected: '/' },
      { prefix: 'dir', expected: 'dir/' },
    ])
    .run(async ({ assert }, { prefix, expected }) => {
      const prefixer = new PathPrefixer(prefix)
      assert.equal(prefixer.prefix, expected)
    })

  test('accept empty string as prefix', async ({ assert }) => {
    const prefixer = new PathPrefixer('')
    assert.equal(prefixer.prefix, '')
  })
})

test.group('Path prefixer | normalizePath', () => {
  test('normalize given path "{path}" to "{expected}"')
    .with([
      { path: '/', expected: '' },
      { path: '.', expected: '' },
      { path: './', expected: '' },
      { path: 'back/../to/root/../..', expected: '' },
      { path: './back/..', expected: '' },
      { path: '/start/slash', expected: 'start/slash' },
      { path: 'double//slash', expected: 'double/slash' },
      { path: '/start/slash/end/', expected: 'start/slash/end' },
    ])
    .run(async ({ assert }, { path, expected }) => {
      const prefixer = new PathPrefixer('')
      assert.equal(prefixer.normalizePath(path), expected)
    })

  test('{$i}. throw exception when detecting path traversal')
    .with(['..', '/./../some/dir', '/beyond/../..', 'beyond/root/../.././..'])
    .run(async ({ assert }, path) => {
      const prefixer = new PathPrefixer('')
      assert.throws(
        () => prefixer.normalizePath(path),
        `E_PATH_TRAVERSAL_DETECTED: Path traversal detected: "${path}"`
      )
    })
})

test.group('Path prefixer | prefixPath', () => {
  test('prefix path "{path}" with "{prefix}"')
    .with([
      { prefix: '', path: 'foo.txt', expected: 'foo.txt' },
      { prefix: '', path: '/foo.txt', expected: 'foo.txt' },
      { prefix: '/', path: 'foo.txt', expected: '/foo.txt' },
      { prefix: '/', path: '/foo.txt', expected: '/foo.txt' },
      { prefix: '/home/ruby184', path: 'dir/foo.txt', expected: '/home/ruby184/dir/foo.txt' },
      { prefix: 'dir', path: 'foo.txt', expected: 'dir/foo.txt' },
    ])
    .run(async ({ assert }, { prefix, path, expected }) => {
      const prefixer = new PathPrefixer(prefix)
      assert.equal(prefixer.prefixPath(path), expected)
    })

  test('prefixPath is the inverse of stripPrefix', async ({ assert }) => {
    const prefixer = new PathPrefixer('dir')
    assert.equal(prefixer.prefixPath(prefixer.stripPrefix('dir/foo.txt')), 'dir/foo.txt')
  })
})

test.group('Path prefixer | prefixDirectoryPath', () => {
  test('prefix directory path "{path}" with "{prefix}"')
    .with([
      { prefix: 'dir', path: 'subdir', expected: 'dir/subdir/' },
      { prefix: '/dir', path: '/subdir', expected: '/dir/subdir/' },
      { prefix: '', path: 'dir', expected: 'dir/' },
      { prefix: '', path: 'with-slash/', expected: 'with-slash/' },
      { prefix: '', path: '.', expected: '' },
      { prefix: '', path: '/', expected: '' },
      { prefix: '', path: './', expected: '' },
      { prefix: '/', path: '.', expected: '/' },
      { prefix: 'prefix', path: '.', expected: 'prefix/' },
    ])
    .run(async ({ assert }, { prefix, path, expected }) => {
      const prefixer = new PathPrefixer(prefix)
      assert.equal(prefixer.prefixDirectoryPath(path), expected)
    })
})

test.group('Path prefixer | stripPrefix', () => {
  test('strip prefix "{prefix}" from path "{path}"')
    .with([
      { prefix: TEST_ROOT, path: join(TEST_ROOT, 'dir'), expected: 'dir' },
      {
        prefix: TEST_ROOT,
        path: join(TEST_ROOT, 'dir', 'subdir', 'foo.txt'),
        expected: 'dir/subdir/foo.txt',
      },
      { prefix: TEST_ROOT, path: TEST_ROOT + sep, expected: '' },
    ])
    .run(async ({ assert }, { prefix, path, expected }) => {
      const prefixer = new PathPrefixer(prefix)
      assert.equal(prefixer.stripPrefix(path), expected)
    })

  test('throw exception when path has no common prefix', async ({ assert }) => {
    const prefixer = new PathPrefixer(TEST_ROOT)
    assert.throws(
      () => prefixer.stripPrefix(join(TEST_ROOT, '..', 'other')),
      `E_PATH_TRAVERSAL_DETECTED: Path traversal detected: "../other"`
    )
  })

  test('stripPrefix is the inverse of prefixPath', async ({ assert }) => {
    const prefixer = new PathPrefixer(TEST_ROOT)
    assert.equal(prefixer.stripPrefix(prefixer.prefixPath('dir/foo.txt')), 'dir/foo.txt')
  })
})

test.group('Path prefixer | withStrippedPrefix', () => {
  test('return new instance with stripped prefix of given path', async ({ assert }) => {
    const prefixer = new PathPrefixer(TEST_ROOT)
    const withStrippedPrefix = prefixer.withStrippedPrefix(join(TEST_ROOT, 'dir'))
    assert.instanceOf(withStrippedPrefix, PathPrefixer)
    assert.notStrictEqual(prefixer, withStrippedPrefix)
    assert.equal(withStrippedPrefix.prefix, 'dir/')
  })
})

test.group('Path prefixer | withPrefix', () => {
  test('return new instance with merged prefix', async ({ assert }) => {
    const prefixer = new PathPrefixer(TEST_ROOT)
    const withPrefix = prefixer.withPrefix('dir')
    assert.instanceOf(withPrefix, PathPrefixer)
    assert.notStrictEqual(prefixer, withPrefix)
    assert.equal(normalize(withPrefix.prefix), join(TEST_ROOT, 'dir') + sep)
  })
})

test.group('Path prefixer | fromPath', () => {
  test('create instance with given normalized path as prefix', async ({ assert }) => {
    const prefixer = PathPrefixer.fromPath(TEST_ROOT)
    assert.instanceOf(prefixer, PathPrefixer)
    assert.equal(normalize(prefixer.prefix), normalize(TEST_ROOT + sep))
  })
})
