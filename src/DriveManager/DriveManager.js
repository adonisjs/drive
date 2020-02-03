'use strict'

const Storage = require('./Storage')
const Drivers = require('../Drivers')

class DriveManager {
  constructor () {
    this._drivers = {}
  }

  extend (name, implementation) {
    this._drivers[name] = implementation
  }

  getDriver (config) {
    const Driver = this._drivers[config.driver] || Drivers[config.driver]

    return new Storage(new Driver(config))
  }
}

module.exports = new DriveManager()
