/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { DisksList, DriveConfig } from '@ioc:Adonis/Core/Drive'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

/**
 * Registers drive with the IoC container
 */
export default class DriveProvider {
  constructor(protected app: ApplicationContract) {}

  /**
   * Register drive with the container
   */
  protected registerDrive() {
    this.app.container.singleton('Adonis/Core/Drive', () => {
      const { DriveManager } = require('../src/DriveManager')
      const Router = this.app.container.resolveBinding('Adonis/Core/Route')
      const Config = this.app.container.resolveBinding('Adonis/Core/Config')

      return new DriveManager(this.app, Router, Config.get('drive', {}))
    })
  }

  /**
   * Register routes for disks using "local" driver.
   */
  protected defineDriveRoutes() {
    this.app.container.withBindings(
      ['Adonis/Core/Config', 'Adonis/Core/Route', 'Adonis/Core/Drive'],
      (Config, Router, Drive) => {
        const driveConfig: DriveConfig = Config.get('drive', {})
        const { LocalFileServer } = require('../src/LocalFileServer')

        Object.keys(driveConfig.disks).forEach((diskName: keyof DisksList) => {
          const diskConfig = driveConfig.disks[diskName]
          if (diskConfig.driver === 'local' && diskConfig.serveAssets) {
            new LocalFileServer(diskName, diskConfig, Drive.use(diskName), Router).registerRoute()
          }
        })
      }
    )
  }

  /**
   * Registering all required bindings to the container
   */
  public register() {
    this.registerDrive()
  }

  /**
   * Register drive routes
   */
  public boot() {
    this.defineDriveRoutes()
  }
}
