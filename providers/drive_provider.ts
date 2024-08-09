/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ApplicationService } from '@adonisjs/core/types'

import { Disk, DriveManager } from '../index.js'
import type { DriveService } from '../src/types.js'

/**
 * Extending the container with a custom service
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'drive.manager': DriveService
  }
}

export default class DriveProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('drive.manager', async () => {
      const driveConfigProvider = await this.app.config.get('drive')
      const config = await configProvider.resolve<any>(this.app, driveConfigProvider)

      if (!config) {
        throw new RuntimeException(
          'Invalid "config/drive.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      return new DriveManager(config)
    })

    this.app.container.bind(Disk, async (resolver) => {
      const driveManager = await resolver.make('drive.manager')
      return driveManager.use()
    })
  }
}
