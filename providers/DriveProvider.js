'use strict'

/*
 * adonis-drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const { ServiceProvider } = require('@adonisjs/fold')
const FlyDrive = require('@slynova/flydrive')
const DriveManager = require('../src/DriveManager')

class DriveProvider extends ServiceProvider {
  $registerManager () {
    this.app.singleton('Adonis/Addons/Drive', (app) => {
      const config = app.use('Adonis/Src/Config').get('drive')
      const flyDriverInstance = new FlyDrive(config)
      const { drivers } = DriveManager

      /**
       * Registering extended drivers with flydrive
       */
      Object.keys(drivers).forEach((driver) => {
        flyDriverInstance.extend(driver, drivers[driver])
      })

      return flyDriverInstance
    })

    this.app.alias('Adonis/Addons/Drive', 'Drive')
    this.app.manager('Adonis/Addons/Drive', DriveManager)
  }

  $extendDrivers () {
    const Drivers = require('@slynova/flydrive/src/Drivers')

    const pathMap = {
      local: '../src/Drivers/LocalFileSystem',
      s3: '../src/Drivers/AwsS3',
      spaces: '../src/Drivers/AwsS3'
    }

    for (const name of Object.keys(pathMap)) {
      this.app.extend('Adonis/Addons/Drive', name, () => new Proxy(function() {}, {
        construct (_, args) {
          const DriverClass = require(pathMap[name])(Drivers[name])
          return new DriverClass(...args)
        }
      }))
    }
  }

  $registerController () {
    this.app.bind('Adonis/Addons/Drive/StorageController', () => require('../src/Controllers/StorageController'))
  }
  
  register () {
    this.$registerManager()
    this.$registerController()
    this.$extendDrivers()
  }

  boot () {
    const Drive = this.app.use('Adonis/Addons/Drive')
    const { BriskRoute } = this.app.use('Adonis/Src/Route')

    BriskRoute.macro('storage', function (disk) {
      this.routePath += '/:path+'
  
      return this.setHandler(
        '@provider:Adonis/Addons/Drive/StorageController.download',
        ['GET', 'HEAD']
      ).middleware((ctx, next) => {
        ctx.$disk = Drive.disk(disk)
        return next()
      })
    })
  }
}

module.exports = DriveProvider
