/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { DriversList } from '@ioc:Adonis/Core/Drive'

/**
 * Expected shape of the config accepted by the "driveConfig"
 * method
 */
type DriveConfig = {
  disks: {
    [name: string]: {
      [K in keyof DriversList]: DriversList[K]['config'] & { driver: K }
    }[keyof DriversList]
  }
}

/**
 * Define config for AdonisJS drive
 */
export function driveConfig<T extends DriveConfig & { disk: keyof T['disks'] }>(config: T): T {
  return config
}

/**
 * Pull disks from the config defined inside the "config/drive.ts"
 * file
 */
export type InferDisksFromConfig<T extends DriveConfig> = {
  [K in keyof T['disks']]: DriversList[T['disks'][K]['driver']]
}
