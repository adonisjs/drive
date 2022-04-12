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
  import type { Volume as MemfsVolume } from 'memfs/lib/volume'
  import type { Dirent as MemfsDirent } from 'memfs/lib/Dirent'
  import { ManagerContract } from '@poppinss/manager'
  import { MacroableConstructorContract } from 'macroable'
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
   * List item returned by the drive drivers
   */
  export interface DriveListItem<T = any> {
    /**
     * Location of list item on disk which can be used in driver methods
     */
    location: string

    /**
     * Flag to know if item represents file or directory
     */
    isFile: boolean

    /**
     * Original list item returned from underlying driver
     */
    original: T
  }

  /**
   * Shape of the directory listing async iterable returned from list allowing to transform listing.
   * This can be iterated directly using for-await-of loop or it can be converted to array using toArray().
   */
  export interface DirectoryListingContract<Driver extends DriverContract, T>
    extends AsyncIterable<T> {
    /**
     * Reference to the driver for which the listing was created.
     */
    driver: Driver

    /**
     * Filter generated items of listing with the given predicate function.
     */
    filter(
      predicate: (item: T, index: number, driver: Driver) => Promise<boolean> | boolean
    ): DirectoryListingContract<Driver, T>

    /**
     * Transform generated items of listing with the given mapper function.
     */
    map<M>(
      mapper: (item: T, index: number, driver: Driver) => Promise<M> | M
    ): DirectoryListingContract<Driver, M>

    /**
     * Add a piping chain function which gets the current async iterable and returns
     * new async iterable with modified directory listing output.
     * Function this is bound to instance of driver for which the listing is generated.
     * This allows using async generator functions and reference the driver methods easily.
     */
    pipe<U>(
      fn: (this: Driver, source: AsyncIterable<T>) => AsyncIterable<U>
    ): DirectoryListingContract<Driver, U>

    /**
     * Get the final async iterable after passing directory listing through chain of piping functions modifying the output.
     */
    toIterable(): AsyncIterable<T>

    /**
     * Convert directory listing to array.
     */
    toArray(): Promise<T[]>
  }

  /**
   * Shape of the directory listing constructor, we export the constructor for others to add macros and getters to the class.
   */
  export interface DirectoryListingConstructorContract
    extends MacroableConstructorContract<DirectoryListingContract<DriverContract, DriveListItem>> {
    new (
      driver: DriverContract,
      listing: (this: DriverContract) => AsyncGenerator<DriveListItem>
    ): DirectoryListingContract<DriverContract, DriveListItem>
  }

  /**
   * Shape of the generic driver
   */
  export interface DriverContract<T extends DriveListItem = DriveListItem> {
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

    /**
     * Return a listing directory iterator for given location.
     */
    list(location: string): DirectoryListingContract<this, T>
  }

  /**
   * List item returned from fake disk driver
   */
  export interface FakeDriveListItem extends DriveListItem<MemfsDirent> {}

  /**
   * Shape of the fake implementation for the driver. Any custom implementation
   * must adhere to it.
   */
  export interface FakeDriverContract extends DriverContract<FakeDriveListItem> {
    /**
     * The name is static
     */
    name: 'fake'

    /**
     * Reference to the underlying adapter. Which is memfs
     */
    adapter: MemfsVolume

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
     * Base path is always required when "serveFiles = true"
     */
    serveFiles?: boolean
    basePath?: string
  }

  /**
   * List item returned from local disk driver
   */
  export interface LocalDriveListItem extends DriveListItem<fsExtra.Dirent> {}

  /**
   * Shape of the local disk driver
   */
  export interface LocalDriverContract extends DriverContract<LocalDriveListItem> {
    name: 'local'

    /**
     * Reference to the underlying adapter. Which is fs-extra
     */
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
   * Fake drive
   */
  export interface FakeDriveContract {
    /**
     * Access to the fake instances created so far
     */
    fakes: Map<keyof DisksList, FakeDriverContract>

    /**
     * Find if a fake file exists
     */
    exists(path: string): Promise<boolean>

    /**
     * Find if the disk is faked
     */
    isFaked(disk: keyof DisksList): boolean

    /**
     * Returns the fake implementation for a given
     * disk
     */
    use(disk: keyof DisksList): FakeDriverContract

    /**
     * Restore a fake
     */
    restore(disk: keyof DisksList): void
  }

  /**
   * Shape of the fake implementation callback
   */
  export type FakeImplementationCallback = (
    manager: DriveManagerContract,
    mappingName: keyof DisksList,
    config: any
  ) => FakeDriverContract

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
     * Exposing DirectoryListing constructor to be extended from outside
     */
    DirectoryListing: DirectoryListingConstructorContract

    /**
     * Access to the fake instances created so far.
     * @deprecated
     */
    fakes: Map<keyof DisksList, FakeDriverContract>

    /**
     * Fake the default or a named disk
     */
    fake(disk?: keyof DisksList): FakeDriveContract

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
