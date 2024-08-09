/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { configProvider } from '@adonisjs/core'
import type { FSDriver } from 'flydrive/drivers/fs'
import type { ConfigProvider } from '@adonisjs/core/types'
import type { FSDriverOptions } from 'flydrive/drivers/fs/types'

import type { AdonisFSDriverOptions, DriverContract } from './types.js'

/**
 * Helper to remap known drive services to factory functions
 */
type ResolvedConfig<Services extends Record<string, () => DriverContract>> = {
  default: keyof Services
  services: {
    [K in keyof Services]: Services[K] extends ConfigProvider<infer A> ? A : Services[K]
  }
}

/**
 * Helper function to define configuration for FlyDrive
 */
export function defineConfig<Services extends Record<string, () => DriverContract>>(config: {
  default: keyof Services
  services: {
    [K in keyof Services]: ConfigProvider<Services[K]> | Services[K]
  }
}): ConfigProvider<ResolvedConfig<Services>> {
  return configProvider.create(async (app) => {
    const { services, default: defaultDisk } = config
    const servicesNames = Object.keys(services)
    const disks = {} as Record<string, () => DriverContract>

    for (let serviceName of servicesNames) {
      const disk = services[serviceName]
      if (typeof disk === 'function') {
        disks[serviceName] = disk
      } else {
        disks[serviceName] = await disk.resolver(app)
      }
    }

    return {
      default: defaultDisk,
      services: disks,
    } as ResolvedConfig<Services>
  })
}

export const services: {
  fs: (config: AdonisFSDriverOptions) => ConfigProvider<() => FSDriver>
} = {
  fs(config) {
    return configProvider.create(async (app) => {
      const fsConfig: FSDriverOptions = {
        visibility: config.visibility,
        location: config.location,
      }

      const { FSDriver } = await import('../drivers/fs/main.js')
      return () => new FSDriver(fsConfig)
    })
  },
}
