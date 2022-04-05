/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { DisksList, FakeDriveContract, FakeDriverContract } from '@ioc:Adonis/Core/Drive'

/**
 * An implementation of the fake drive
 */
export class FakeDrive implements FakeDriveContract {
  /**
   * Reference to registered fakes
   */
  public fakes: Map<keyof DisksList, FakeDriverContract> = new Map()

  /**
   * Find a file for the given path exists. Searched
   * across all the faked disk
   */
  public async exists(path: string): Promise<boolean> {
    for (let [, fake] of this.fakes) {
      const exists = await fake.exists(path)
      if (exists) {
        return true
      }
    }

    return false
  }

  /**
   * Access the faked driver
   */
  public use(disk: keyof DisksList): FakeDriverContract {
    return this.fakes.get(disk)!
  }

  /**
   * Find if a disk has been faked
   */
  public isFaked(disk: keyof DisksList): boolean {
    return this.fakes.has(disk)
  }

  /**
   * Restore a fake
   */
  public restore(disk: keyof DisksList) {
    this.fakes.delete(disk)
  }
}
