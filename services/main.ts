/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import type { DriveService } from '../src/types.js'

let drive: DriveService

/**
 * Returns a singleton instance of the DriveManager class from the
 * container.
 */
await app.booted(async () => {
  drive = await app.container.make('drive.manager')
})

export { drive as default }
