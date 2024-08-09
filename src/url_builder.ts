/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Router } from '@adonisjs/core/http'
import type { AdonisFSDriverOptions } from './types.js'
import type { FSDriverOptions } from '../drivers/fs/types.js'

/**
 * Creates the URL builder for the flydrive "fs" driver.
 */
export function createURLBuilder(
  router: Router,
  config: AdonisFSDriverOptions,
  routeName: string
): Exclude<Required<FSDriverOptions['urlBuilder']>, undefined> {
  const prefixUrl = config.appUrl || ''

  return {
    async generateURL(key) {
      return router
        .builder()
        .params({ '*': key.split('/') })
        .prefixUrl(prefixUrl)
        .make(routeName)
    },
    async generateSignedURL(key, _, options) {
      const { expiresIn, ...headers } = options
      return router
        .builder()
        .qs(headers)
        .params({ '*': key.split('/') })
        .prefixUrl(prefixUrl)
        .makeSigned(routeName, {
          expiresIn,
        })
    },
  }
}
