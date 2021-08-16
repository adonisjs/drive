/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

export const fs = new Filesystem(join(__dirname, '__app'))

export async function setupApp(providers?: string[]) {
  const app = new Application(fs.basePath, 'web', {
    providers: ['@adonisjs/encryption', '@adonisjs/http-server'].concat(providers || []),
  })
  await fs.add('.env', '')
  await fs.add(
    'config/app.ts',
    `
    export const appKey = 'verylongandrandom32charsecretkey'
    export const http = {
      trustProxy: () => true,
      cookie: {},
    }
  `
  )

  await fs.add(
    'config/drive.ts',
    `
    const driveConfig = {
      disk: 'local',
      disks: {
        local: {
          driver: 'local',
          root: '${join(fs.basePath, 'uploads')}',
          basePath: '/uploads',
          serveAssets: true,
          visibility: 'public'
        }
      }
    }

    export default driveConfig
  `
  )

  await app.setup()
  await app.registerProviders()
  await app.bootProviders()

  return app
}
