/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { promisify } from 'util'
import { pipeline } from 'stream'

export const pipelinePromise = promisify(pipeline)
