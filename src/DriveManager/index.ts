/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { Manager } from '@poppinss/manager'
import { RouterContract } from '@ioc:Adonis/Core/Route'
import { Exception, ManagerConfigValidator } from '@poppinss/utils'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

import {
  DisksList,
  Visibility,
  DriveConfig,
  DriverContract,
  DriveFileStats,
  ContentHeaders,
  DriveFakeContract,
  LocalDriverConfig,
  DriveManagerContract,
  FakeImplementationCallback,
} from '@ioc:Adonis/Core/Drive'

/**
 * Drive manager exposes the API to resolve disks and extend by
 * adding custom drivers
 */
export class DriveManager
  extends Manager<
    ApplicationContract,
    DriverContract,
    DriverContract,
    { [P in keyof DisksList]: DisksList[P]['implementation'] }
  >
  implements DriveManagerContract
{
  /**
   * Find if drive is ready to be used
   */
  private isReady: boolean = false

  /**
   * The fake callback
   */
  private fakeCallback: FakeImplementationCallback = (_, disk, config) => {
    const { DriveFake } = require('../Fake')
    return new DriveFake(disk, config, this.router)
  }

  /**
   * Cache all disks instances
   */
  protected singleton = true

  /**
   * Reference to registered fakes
   */
  public fakes: Map<keyof DisksList, DriveFakeContract> = new Map()

  constructor(
    public application: ApplicationContract,
    public router: RouterContract,
    private config: DriveConfig
  ) {
    super(application)
    this.validateConfig()
  }

  /**
   * Validate config
   */
  private validateConfig() {
    if (!this.config) {
      return
    }

    const validator = new ManagerConfigValidator(this.config, 'drive', 'config/drive')
    validator.validateDefault('disk')
    validator.validateList('disks', 'disk')

    this.isReady = true
  }

  /**
   * Returns the default mapping name
   */
  protected getDefaultMappingName() {
    return this.config.disk
  }

  /**
   * Returns config for a given mapping
   */
  protected getMappingConfig(diskName: keyof DisksList) {
    return this.config.disks[diskName]
  }

  /**
   * Returns the name of the drive used by a given mapping
   */
  protected getMappingDriver(diskName: keyof DisksList): string | undefined {
    return this.getMappingConfig(diskName)?.driver
  }

  /**
   * Make instance of the local driver
   */
  protected createLocal(diskName: keyof DisksList, config: LocalDriverConfig) {
    const { LocalDriver } = require('../Drivers/Local')
    return new LocalDriver(diskName, config, this.router)
  }

  /**
   * Fake default or a named disk
   */
  public fake(disk?: keyof DisksList) {
    disk = disk || this.getDefaultMappingName()

    if (!this.fakes.has(disk)) {
      this.fakes.set(disk, this.fakeCallback(this, disk, this.getMappingConfig(disk)))
    }
  }

  /**
   * Restore the fake for the default or a named disk
   */
  public restore(disk?: keyof DisksList) {
    disk = disk || this.getDefaultMappingName()

    if (this.fakes.has(disk)) {
      this.fakes.delete(disk)
    }
  }

  /**
   * Restore all fakes1
   */
  public restoreAll() {
    this.fakes = new Map()
  }

  /**
   * Resolve instance for a disk
   */
  public use(disk?: keyof DisksList): any {
    if (!this.isReady) {
      throw new Exception(
        'Missing configuration for drive. Visit https://bit.ly/2WnR5j9 for setup instructions',
        500,
        'E_MISSING_DRIVE_CONFIG'
      )
    }

    disk = disk || this.getDefaultMappingName()
    if (this.fakes.has(disk)) {
      return this.fakes.get(disk)
    }

    return super.use(disk)
  }

  /**
   * Register a custom fake implementation
   */
  public setFakeImplementation(callback: FakeImplementationCallback) {
    this.fakeCallback = callback
  }

  /**
   * Returns the file contents as a buffer. The buffer return
   * value allows you to self choose the encoding when
   * converting the buffer to a string.
   */
  public async get(location: string): Promise<Buffer> {
    return this.use().get(location)
  }

  /**
   * Returns the file contents as a stream
   */
  public async getStream(location: string): Promise<NodeJS.ReadableStream> {
    return this.use().getStream(location)
  }

  /**
   * A boolean to find if the location path exists or not
   */
  public exists(location: string): Promise<boolean> {
    return this.use().exists(location)
  }

  /**
   * Returns the location path visibility
   */
  public async getVisibility(location: string): Promise<Visibility> {
    return this.use().getVisibility(location)
  }

  /**
   * Returns the location path stats
   */
  public async getStats(location: string): Promise<DriveFileStats> {
    return this.use().getStats(location)
  }

  /**
   * Returns a signed URL for a given location path
   */
  public getSignedUrl(
    location: string,
    options?: ContentHeaders & { expiresIn?: number | string }
  ): Promise<string> {
    return this.use().getSignedUrl(location, options)
  }

  /**
   * Returns a URL for a given location path
   */
  public getUrl(location: string): Promise<string> {
    return this.use().getUrl(location)
  }

  /**
   * Write string|buffer contents to a destination. The missing
   * intermediate directories will be created (if required).
   */
  public put(location: string, contents: Buffer | string): Promise<void> {
    return this.use().put(location, contents)
  }

  /**
   * Write a stream to a destination. The missing intermediate
   * directories will be created (if required).
   */
  public putStream(location: string, contents: NodeJS.ReadableStream): Promise<void> {
    return this.use().putStream(location, contents)
  }

  /**
   * Not supported
   */
  public setVisibility(location: string, visibility: Visibility): Promise<void> {
    return this.use().setVisibility(location, visibility)
  }

  /**
   * Remove a given location path
   */
  public delete(location: string): Promise<void> {
    return this.use().delete(location)
  }

  /**
   * Copy a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public copy(source: string, destination: string): Promise<void> {
    return this.use().copy(source, destination)
  }

  /**
   * Move a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public move(source: string, destination: string): Promise<void> {
    return this.use().move(source, destination)
  }
}
