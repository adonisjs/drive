/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'
import { RuntimeException } from '@adonisjs/core/exceptions'

import type { S3Driver } from 'flydrive/drivers/s3'
import type { FSDriver } from 'flydrive/drivers/fs'
import type { GCSDriver } from 'flydrive/drivers/gcs'
import type { FSDriverOptions } from 'flydrive/drivers/fs/types'
import type { S3DriverOptions } from 'flydrive/drivers/s3/types'
import type { GCSDriverOptions } from 'flydrive/drivers/gcs/types'

import debug from './debug.ts'
import { createURLBuilder } from './url_builder.ts'
import type {
  DriverFactory,
  AdonisFSDriverOptions,
  ServiceConfigProvider,
  ServiceWithLocalServer,
  DriveManagerOptions,
} from './types.ts'

/**
 * Helper to remap known drive services to factory functions
 */
type ResolvedConfig<Services extends Record<string, DriverFactory>> = {
  config: {
    default: keyof Services
    fakes: DriveManagerOptions<Services>['fakes']
    services: {
      [K in keyof Services]: Services[K] extends ServiceConfigProvider<infer A> ? A : Services[K]
    }
  }
  locallyServed: ServiceWithLocalServer[]
}

/**
 * Helper function to define configuration for FlyDrive
 *
 * @param config - The drive configuration object
 * @param config.default - The name of the default disk to use
 * @param config.fakes - Configuration for fake disk used during testing
 * @param config.services - Object defining all available disk services
 *
 * @example
 * ```js
 * const driveConfig = defineConfig({
 *   default: 'uploads',
 *   services: {
 *     uploads: services.fs({
 *       location: new URL('./uploads', import.meta.url),
 *       visibility: 'public',
 *       serveFiles: true,
 *       routeBasePath: '/uploads'
 *     }),
 *     s3: services.s3({
 *       credentials: {
 *         accessKeyId: env.get('S3_ACCESS_KEY_ID'),
 *         secretAccessKey: env.get('S3_SECRET_ACCESS_KEY')
 *       },
 *       region: env.get('S3_REGION'),
 *       bucket: env.get('S3_BUCKET')
 *     })
 *   }
 * })
 * ```
 */
export function defineConfig<Services extends Record<string, DriverFactory>>(config: {
  default: keyof Services
  fakes?: DriveManagerOptions<Services>['fakes']
  services: {
    [K in keyof Services]: ServiceConfigProvider<Services[K]> | Services[K]
  }
}): ConfigProvider<ResolvedConfig<Services>> {
  return configProvider.create(async (app) => {
    const { services, fakes, default: defaultDisk } = config
    const servicesNames = Object.keys(services)

    /**
     * Configured disks
     */
    const disks = {} as Record<string, DriverFactory>

    /**
     * A collection of services with their routes that must
     * be served locally using the AdonisJS HTTP server.
     */
    const locallyServed: ServiceWithLocalServer[] = []

    /**
     * Looping over services and resolving their config providers
     * to get factory functions
     */
    for (let serviceName of servicesNames) {
      const disk = services[serviceName]
      if (typeof disk === 'function') {
        disks[serviceName] = disk
      } else {
        disks[serviceName] = await disk.resolver(serviceName, app, locallyServed)
      }
    }

    return {
      config: {
        default: defaultDisk,
        fakes: {
          location: app.tmpPath('drive-fakes'),
          urlBuilder: {
            async generateURL(key, _) {
              return `/drive/fakes/${key}`
            },
            async generateSignedURL(key, _, __) {
              return `/drive/fakes/signed/${key}`
            },
          },
          ...fakes,
        },
        services: disks,
      },
      locallyServed,
    } as ResolvedConfig<Services>
  })
}

/**
 * Config helpers to register file storage services within the
 * config file.
 *
 * @example
 * ```js
 * // Using in drive config
 * {
 *   services: {
 *     local: services.fs({
 *       location: './uploads',
 *       visibility: 'public',
 *       serveFiles: true,
 *       routeBasePath: '/uploads'
 *     }),
 *     cloud: services.s3({
 *       credentials: { accessKeyId: '...', secretAccessKey: '...' },
 *       region: 'us-east-1',
 *       bucket: 'my-bucket'
 *     })
 *   }
 * }
 * ```
 */
export const services: {
  /**
   * Configure the "fs" driver to store files on the
   * local filesystem and serve files using the
   * AdonisJS HTTP server
   */
  fs: (config: AdonisFSDriverOptions) => ServiceConfigProvider<() => FSDriver>

  /**
   * Configure the "s3" driver to store files inside
   * a S3 bucket and serve files using S3 directly
   * or a CDN.
   */
  s3: (config: S3DriverOptions) => ServiceConfigProvider<() => S3Driver>

  /**
   * Configure the "gcs" driver to store files inside
   * a GCS bucket and serve files using GCS directly.
   */
  gcs: (config: GCSDriverOptions) => ServiceConfigProvider<() => GCSDriver>
} = {
  /**
   * Configure the filesystem driver for local file storage.
   *
   * @param config - Configuration options for the filesystem driver
   */
  fs(config) {
    return {
      type: 'provider',
      /**
       * Resolves the filesystem driver with proper configuration.
       *
       * @param name - The name of the service
       * @param app - The AdonisJS application instance
       * @param locallyServed - Array to track locally served routes
       */
      async resolver(name, app, locallyServed) {
        debug('configuring fs service')

        /**
         * Ensure route base path is provided when serving files
         */
        if (config.serveFiles && !config.routeBasePath) {
          throw new RuntimeException(
            `Invalid drive config. Missing "routeBasePath" option in "services.${name}" object`
          )
        }

        const routeName = `drive.${name}.serve`
        const fsConfig: FSDriverOptions = {
          visibility: config.visibility,
          location: config.location,
        }

        /**
         * Assign URL builder when serving files.
         */
        if (config.serveFiles) {
          const router = await app.container.make('router')
          fsConfig.urlBuilder = createURLBuilder(router, config, routeName)
          locallyServed.push({
            service: name,
            routeName,
            routePattern: `${config.routeBasePath.replace(/\/$/, '')}/*`,
          })
        }

        const { FSDriver } = await import('flydrive/drivers/fs')
        return () => new FSDriver(fsConfig)
      },
    }
  },
  /**
   * Configure the S3 driver for cloud file storage.
   *
   * @param config - Configuration options for the S3 driver
   */
  s3(config) {
    return {
      type: 'provider',
      /**
       * Resolves the S3 driver with proper configuration.
       */
      async resolver() {
        debug('configuring s3 service')
        const { S3Driver } = await import('flydrive/drivers/s3')
        return () => new S3Driver(config)
      },
    }
  },
  /**
   * Configure the Google Cloud Storage driver for cloud file storage.
   *
   * @param config - Configuration options for the GCS driver
   */
  gcs(config) {
    return {
      type: 'provider',
      /**
       * Resolves the GCS driver with proper configuration.
       */
      async resolver() {
        debug('configuring gcs service')
        const { GCSDriver } = await import('flydrive/drivers/gcs')
        return () => new GCSDriver(config)
      },
    }
  },
}
