/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Disk, DriveManager } from 'flydrive'
import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ApplicationService } from '@adonisjs/core/types'

import { createFileServer } from '../src/file_server.js'
import type { DriveService, ServiceWithLocalServer, SignedURLOptions } from '../src/types.js'
import debug from '../src/debug.js'

/**
 * Extending the container with a custom service
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'drive.manager': DriveService
  }
}

/**
 * Drive Provider registers a singleton drive manager services
 * to the IoC container and wires up the routing to serve
 * files from the "fs" driver.
 */
export default class DriveProvider {
  /**
   * Collection of services using the "fs" driver and want
   * to serve files using the AdonisJS HTTP server.
   */
  #locallyServedServices: ServiceWithLocalServer[] = []

  constructor(protected app: ApplicationService) {}

  /**
   * Defines the template engine on the message class to
   * render templates
   */
  protected async registerViewHelpers(drive: DriveManager<any>) {
    if (this.app.usingEdgeJS) {
      const edge = await import('edge.js')
      debug('detected edge installation. Registering drive global helpers')

      edge.default.global('driveUrl', function (key: string, diskName?: string) {
        const disk = diskName ? drive.use(diskName) : drive.use()
        return disk.getUrl(key)
      })

      edge.default.global(
        'driveSignedUrl',
        function (
          key: string,
          diskNameOrOptions?: string | SignedURLOptions,
          signedUrlOptions?: SignedURLOptions
        ) {
          let diskName: string | undefined
          let options: SignedURLOptions | undefined = signedUrlOptions

          if (typeof diskNameOrOptions === 'string') {
            diskName = diskNameOrOptions
          } else if (diskNameOrOptions && !signedUrlOptions) {
            options = diskNameOrOptions
          }

          const disk = diskName ? drive.use(diskName) : drive.use()
          return disk.getSignedUrl(key, options)
        }
      )
    }
  }

  register() {
    this.app.container.singleton('drive.manager', async () => {
      /**
       * Resolving config from the "config/drive.ts" file and
       * expecting it to be a config provider.
       */
      const driveConfigProvider = this.app.config.get('drive')
      const config = await configProvider.resolve<{
        config: any
        locallyServed: ServiceWithLocalServer[]
      }>(this.app, driveConfigProvider)

      /**
       * Ensure the returned value is the output of the
       * config provider
       */
      if (!config) {
        throw new RuntimeException(
          'Invalid "config/drive.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      /**
       * Keep a reference of services to be served locally
       */
      this.#locallyServedServices = config.locallyServed
      return new DriveManager(config.config)
    })

    this.app.container.bind(Disk, async (resolver) => {
      const driveManager = await resolver.make('drive.manager')
      return driveManager.use()
    })
  }

  /**
   * The boot method resolves drive and router to register
   * the routes for the locally served services.
   *
   * The routes must be defined before the application has
   * started.
   */
  async boot() {
    const drive = await this.app.container.make('drive.manager')
    const router = await this.app.container.make('router')

    this.#locallyServedServices.forEach((service) => {
      debug(
        'configuring drive local file server for "%s", route "%s"',
        service.service,
        service.routePattern
      )
      router
        .get(service.routePattern, createFileServer(drive.use(service.service)))
        .as(service.routeName)
    })

    await this.registerViewHelpers(drive)
  }
}
