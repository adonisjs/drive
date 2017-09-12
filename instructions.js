'use strict'

/*
 * adonis-drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const path = require('path')

module.exports = async (cli) => {
  try {
    await cli.copy(
      path.join(__dirname, './examples/config.js'),
      path.join(cli.helpers.configPath(), 'drive.js')
    )
    await cli.command.completed('create', 'config/drive.js')
  } catch (error) {
    // ignore error
  }
}
