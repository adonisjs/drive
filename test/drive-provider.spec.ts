/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { join } from 'path'
import { DriveManager } from '../src/DriveManager'
import { fs, setupApp } from '../test-helpers'

test.group('Drive Provider', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('register drive provider', async (assert) => {
    const app = await setupApp([join(__dirname, '../providers/DriveProvider')])
    assert.instanceOf(app.container.use('Adonis/Core/Drive'), DriveManager)
  })

  test('register route for serving files from local disk', async (assert) => {
    const app = await setupApp([join(__dirname, '../providers/DriveProvider')])
    const router = app.container.use('Adonis/Core/Route')
    router.commit()
    const routes = router.toJSON()

    assert.lengthOf(routes.root, 1)
    assert.equal(routes.root[0].pattern, '/uploads/*')
    assert.equal(routes.root[0].name, 'drive.local.serve')
    assert.deepEqual(routes.root[0].methods, ['HEAD', 'GET'])
  })
})
