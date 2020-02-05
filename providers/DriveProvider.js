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
const { DriveManager, StorageManager } = require('../src/DriveManager')
const path = require('path')

class DriveProvider extends ServiceProvider {
  $registerManager () {
    this.app.singleton('Adonis/Addons/Drive', (app) => {
      const config = app.use('Adonis/Src/Config').get('drive')
      return new StorageManager(config)
    })

    this.app.alias('Adonis/Addons/Drive', 'Drive')
    this.app.manager('Adonis/Addons/Drive', DriveManager)
  }

  $registerControllers () {
    this.app.autoload(path.join(__dirname, '..', 'src', 'Controllers'), 'Adonis/Addons/Drive/Controllers')
  }
  
  register () {
    this.$registerManager()
    this.$registerControllers()
  }

  boot () {
    const Drive = this.app.use('Adonis/Addons/Drive')
    const { BriskRoute } = this.app.use('Adonis/Src/Route')

    BriskRoute.macro('download', function (disk) {
      this.routePath += '/:path+'
  
      return this.setHandler(
        '@provider:Adonis/Addons/Drive/Controllers/StorageController.download',
        ['GET', 'HEAD']
      ).middleware((ctx, next) => {
        ctx.$disk = Drive.disk(disk)
        return next()
      })
    })

    try {
      const uploadFiles = require('../src/Bindings/Request')
      const Request = this.app.use('Adonis/Src/Request')

      Request.macro('upload', function (files, disk = '') {
        return uploadFiles(this, Drive.disk(disk), files)
      })
    } catch (e) {}
  }
}

module.exports = DriveProvider
