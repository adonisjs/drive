'use strict'

/*
 * adonis-drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

class DriveManager {
  constructor () {
    this.drivers = {}
  }

  /**
   * Extend by adding a new driver
   *
   * @method extend
   *
   * @param  {String} name
   * @param  {Class} implementation
   *
   * @chainable
   */
  extend (name, implementation) {
    this.drivers[name] = implementation
    return this
  }
}

module.exports = new DriveManager()
