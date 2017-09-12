'use strict'

/*
 * adonis-drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const test = require('japa')
const { Config } = require('@adonisjs/sink')
const { ioc } = require('@adonisjs/fold')

const DriveManager = require('../src/DriveManager')
const DriveProvider = require('../providers/DriveProvider')

test.group('DriveManager', () => {
  test('extend by adding a new driver', (assert) => {
    class Foo {}
    DriveManager.extend('foo', new Foo())
    assert.instanceOf(DriveManager.drivers.foo, Foo)
  })

  test('pass drivers to flydriver when binding is fetched', (assert) => {
    class Foo {}
    ioc.bind('Adonis/Src/Config', () => {
      const config = new Config()
      config.set('drive', { })
      return config
    })
    DriveManager.extend('foo', Foo)
    const provider = new DriveProvider(ioc)
    provider.register()
    const drive = ioc.use('Drive')
    assert.deepEqual(drive._drivers.foo, Foo)
  })

  test('interact with filesystem using local driver', async (assert) => {
    class Foo {}
    ioc.bind('Adonis/Src/Config', () => {
      const config = new Config()
      config.set('drive', {
        default: 'local',

        disks: {
          local: {
            driver: 'local',
            root: __dirname
          }
        }
      })
      return config
    })
    DriveManager.extend('foo', Foo)
    const provider = new DriveProvider(ioc)
    provider.register()
    const drive = ioc.use('Drive')
    const exits = await drive.exists('foo')
    assert.isFalse(exits)
  })
})
