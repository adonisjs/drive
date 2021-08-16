/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Drive' {
  import * as fsExtra from 'fs-extra'
  import { ManagerContract } from '@poppinss/manager'
  import { ApplicationContract } from '@ioc:Adonis/Core/Application'

  /**
   * Content options for files
   */
  export type ContentHeaders = {
    contentType?: string
    contentLanguage?: string
    contentEncoding?: string
    contentDisposition?: string
    cacheControl?: string
  }

  /**
   * Options for writing, moving and copying
   * files
   */
  export type WriteOptions = {
    visibility?: string
  } & ContentHeaders &
    Record<string, any>

  /**
   * Available visibilities
   */
  export type Visibility = 'public' | 'private'

  /**
   * Stats returned by the drive drivers
   */
  export type DriveFileStats = {
    size: number
    modified: Date
    isFile: boolean
    etag?: string
  }

  /**
   * Shape of the generic driver
   */
  export interface DriverContract {
    /**
     * Name of the driver
     */
    name: string

    /**
     * A boolean to find if the location path exists or not
     */
    exists(location: string): Promise<boolean>

    /**
     * Returns the file contents as a buffer.
     */
    get(location: string): Promise<Buffer>

    /**
     * Returns the file contents as a stream
     */
    getStream(location: string): Promise<NodeJS.ReadableStream>

    /**
     * Returns the location path visibility
     */
    getVisibility(location: string): Promise<Visibility>

    /**
     * Returns the location path stats
     */
    getStats(location: string): Promise<DriveFileStats>

    /**
     * Returns a signed URL for a given location path
     */
    getSignedUrl(
      location: string,
      options?: ContentHeaders & { expiresIn?: string | number }
    ): Promise<string>

    /**
     * Returns a URL for a given location path
     */
    getUrl(location: string): Promise<string>

    /**
     * Write string|buffer contents to a destination. The missing
     * intermediate directories will be created (if required).
     */
    put(location: string, contents: Buffer | string, options?: WriteOptions): Promise<void>

    /**
     * Write a stream to a destination. The missing intermediate
     * directories will be created (if required).
     */
    putStream(
      location: string,
      contents: NodeJS.ReadableStream,
      options?: WriteOptions
    ): Promise<void>

    /**
     * Update the visibility of the file
     */
    setVisibility(location: string, visibility: Visibility): Promise<void>

    /**
     * Remove a given location path
     */
    delete(location: string): Promise<void>

    /**
     * Copy a given location path from the source to the desination.
     * The missing intermediate directories will be created (if required)
     */
    copy(source: string, destination: string, options?: WriteOptions): Promise<void>

    /**
     * Move a given location path from the source to the desination.
     * The missing intermediate directories will be created (if required)
     */
    move(source: string, destination: string, options?: WriteOptions): Promise<void>
  }

  /**
   * Shape of the fake implementation for the driver. Any custom implementation
   * must adhere to it.
   */
  export interface DriveFakeContract extends DriverContract {
    /**
     * The name is static
     */
    name: 'fake'

    /**
     * The disk its faking
     */
    disk: keyof DisksList

    /**
     * Make path to a given file location
     */
    makePath(location: string): string
  }

  /**
   * Config accepted by the local disk driver
   */
  export type LocalDriverConfig = {
    driver: 'local'
    visibility: Visibility
    root: string

    /**
     * Base path is always required when "serveAssets = true"
     */
    serveAssets?: boolean
    basePath?: string
  }

  /**
   * Shape of the local disk driver
   */
  export interface LocalDriverContract extends DriverContract {
    name: 'local'
    adapter: typeof fsExtra

    /**
     * Make path to a given file location
     */
    makePath(location: string): string
  }

  /**
   * A list of disks registered in the user land
   */
  export interface DisksList {}

  /**
   * The config accepted by Drive
   * @type {Object}
   */
  export type DriveConfig = {
    disk: keyof DisksList
    disks: { [P in keyof DisksList]: DisksList[P]['config'] }
  }

  /**
   * Shape of the fake implementation callback
   */
  export type FakeImplementationCallback = (
    manager: DriveManagerContract,
    mappingName: keyof DisksList,
    config: any
  ) => DriveFakeContract

  /**
   * Drive manager to manage disk instances
   */
  export interface DriveManagerContract
    extends ManagerContract<
        ApplicationContract,
        DriverContract,
        DriverContract,
        { [P in keyof DisksList]: DisksList[P]['implementation'] }
      >,
      Omit<DriverContract, 'name'> {
    /**
     * Access to the fake instances created so far
     */
    fakes: Map<keyof DisksList, DriveFakeContract>

    /**
     * Fake the default or a named disk
     */
    fake(disk?: keyof DisksList): void

    /**
     * Restore fake for the default or a named disk
     */
    restore(disk?: keyof DisksList): void

    /**
     * Restore all fakes
     */
    restoreAll(): void

    /**
     * Define a custom fake implementation. An instance of it
     * will be created anytime a fake is created
     */
    setFakeImplementation(callback: FakeImplementationCallback): void
  }

  const Drive: DriveManagerContract
  export default Drive
}
