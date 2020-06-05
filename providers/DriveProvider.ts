/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { StorageManager } from '@slynova/flydrive'

/**
 * Provider to bind drive to the container
 */
export default class DriveProvider {
	public static needsApplication = true
	constructor(protected app: ApplicationContract) {}

	/**
	 * Register the drive binding
	 */
	public register() {
		this.app.container.singleton('Adonis/Addons/Drive', () => {
			const config = this.app.config.get('drive', {})
			return new StorageManager(config)
		})
	}
}
