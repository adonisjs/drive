/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Addons/Drive' {
	import { StorageManager } from '@slynova/flydrive'

	/**
	 * A list of typed disks defined in the user land using
	 * the contracts file
	 */
	export interface DriveDisksList {}

	/**
	 * Define the config properties on this interface and they will appear
	 * everywhere.
	 */
	export interface DriveConfig {
		default: keyof DriveDisksList
		disks: { [P in keyof DriveDisksList]: DriveDisksList[P] }
	}

	const Drive: StorageManager
	export default Drive
}
