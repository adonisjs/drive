/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export * from 'flydrive/types'

import type { DriveManager } from 'flydrive'
import type { ConfigProvider } from '@adonisjs/core/types'
import type { DriverContract, ObjectVisibility } from 'flydrive/types'

/**
 * Options accepted by the FSDriver registered by AdonisJS
 * using the config helpers.
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

  /**
   * Enable the flag if you want drive to register a route
   * to serve files.
   *
   * If you want to self implement the logic for serving
   * files then you can turn off this setting and register
   * a route + handler yourself.
   */
  serveFiles?: boolean

  /**
   * Define the route path to be used for serving files. A route
   * for this path will be registered all the URLs created
   * via "drive.getUrl" and "drive.getSignedUrl" will
   * include this route path.
   *
   * The `routeBasePath` must be defined when "serveFiles"
   * has been enabled.
   */
  routeBasePath?: string
}

/**
 * A list of disks inferred using the config defined inside
 * the user-land application
 */
export interface DriveDisks {}
export type InferDriveDisk<T extends ConfigProvider<Record<string, () => DriverContract>>> =
  Awaited<ReturnType<T['resolver']>>

/**
 * Drive service represents a singleton since of the DriveManager
 * configured using the "config/drive.ts" file.
 */
export interface DriveService
  extends DriveManager<
    DriveDisks extends Record<string, () => DriverContract> ? DriveDisks : never
  > {}
