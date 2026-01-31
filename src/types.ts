/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Re-export all types from flydrive core package.
 * This includes types like DriveManagerOptions, Disk, ObjectVisibility, etc.
 *
 * @see {@link https://github.com/flydrive-js/core} - FlyDrive documentation
 */
export * from 'flydrive/types'

import type { DriveManager } from 'flydrive'
import type { DriverContract, ObjectVisibility } from 'flydrive/types'
import type { ApplicationService, ConfigProvider } from '@adonisjs/core/types'

/**
 * Options accepted by the FSDriver registered by AdonisJS
 * using the config helpers.
 *
 * @example
 * ```js
 * const fsConfig = {
 *   location: new URL('./uploads', import.meta.url),
 *   visibility: 'public',
 *   serveFiles: true,
 *   routeBasePath: '/uploads',
 *   appUrl: 'https://example.com'
 * }
 * ```
 */
export type AdonisFSDriverOptions = {
  /**
   * Root location of the filesystem. The files will be
   * read and persisted to this location
   */
  location: URL | string

  /**
   * The default visibility of all the files. The FSDriver
   * does not use visbility to implement any logic, instead
   * it returns the value as it is via the "getMetaData"
   * method
   */
  visibility: ObjectVisibility

  /**
   * Application URL that someone enters in the browser
   * to visit your app. Define the "appUrl", if you want
   * to generate fully qualified URLs using Drive.
   *
   * Defaults to undefined
   */
  appUrl?: string
} & (
  | {
      /**
       * Enable the flag if you want drive to register a route
       * to serve files.
       *
       * If you want to self implement the logic for serving
       * files then you can turn off this setting and register
       * a route + handler yourself.
       */
      serveFiles: true

      /**
       * Define the route path to be used for serving files. A route
       * for this path will be registered all the URLs created
       * via "drive.getUrl" and "drive.getSignedUrl" will
       * include this route path.
       *
       * The `routeBasePath` must be defined when "serveFiles"
       * has been enabled.
       */
      routeBasePath: string
    }
  | {
      serveFiles?: false
      routeBasePath?: string
    }
)

/**
 * Service info that must be served via the AdonisJS
 * local HTTP server. Used to track which services need
 * routes registered for file serving.
 *
 * @example
 * ```js
 * const serviceInfo = {
 *   service: 'uploads',
 *   routeName: 'drive.uploads.serve',
 *   routePattern: '/uploads/*'
 * }
 * ```
 */
export type ServiceWithLocalServer = {
  /** The name of the drive service */
  service: string
  /** The route name used for URL generation */
  routeName: string
  /** The route pattern to match file requests */
  routePattern: string
}

/**
 * Representation of a factory function that returns
 * an instance of a driver. Used to create driver instances
 * on demand.
 *
 * @example
 * ```js
 * const driverFactory = () => new FSDriver({
 *   location: './uploads',
 *   visibility: 'public'
 * })
 * ```
 */
export type DriverFactory = () => DriverContract

/**
 * Service config provider is an extension of the config
 * provider and accepts the name of the disk service.
 * Used to configure services that need access to the
 * application instance during setup.
 *
 * @template Factory - The driver factory function type
 *
 * @example
 * ```js
 * const s3Provider = {
 *   type: 'provider',
 *   async resolver(name, app, locallyServed) {
 *     const env = app.container.make('env')
 *     return () => new S3Driver({
 *       credentials: {
 *         accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
 *         secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY')
 *       },
 *       region: env.get('AWS_REGION'),
 *       bucket: env.get('S3_BUCKET')
 *     })
 *   }
 * }
 * ```
 */
export type ServiceConfigProvider<Factory extends DriverFactory> = {
  /** Identifies this as a config provider */
  type: 'provider'
  /** Function that resolves the driver factory with application context */
  resolver: (
    /** The name of the service being configured */
    name: string,
    /** The AdonisJS application instance */
    app: ApplicationService,
    /** Array to track services that need local HTTP routes */
    locallyServed: ServiceWithLocalServer[]
  ) => Promise<Factory>
}

/**
 * A list of disks inferred using the config defined inside
 * the user-land application. This interface is extended via
 * declaration merging to provide type-safe disk names.
 *
 * @example
 * ```js
 * // In your config/drive.ts file
 * declare module '@adonisjs/drive/types' {
 *   interface DriveDisks {
 *     uploads: () => FSDriver
 *     s3: () => S3Driver
 *   }
 * }
 *
 * // Usage
 * const disk = drive.use('uploads') // Type-safe!
 * ```
 */
export interface DriveDisks {}

/**
 * Utility type that infers the disk services configuration
 * from a config provider type.
 *
 * @template T - The config provider type containing services
 */
export type InferDriveDisks<
  T extends ConfigProvider<{ config: { services: Record<string, DriverFactory> } }>,
> = Awaited<ReturnType<T['resolver']>>['config']['services']

/**
 * Drive service represents a singleton instance of the DriveManager
 * configured using the "config/drive.ts" file. This is the main
 * interface you interact with to access configured disks.
 *
 * @example
 * ```js
 * // Injecting drive service
 * export default class FileController {
 *   constructor(private drive: DriveService) {}
 *
 *   async upload({ request }) {
 *     const file = request.file('avatar')
 *     await this.drive.use().put(file.clientName, file.tmpPath)
 *   }
 * }
 * ```
 */
export interface DriveService extends DriveManager<
  DriveDisks extends Record<string, DriverFactory> ? DriveDisks : never
> {}
