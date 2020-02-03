'use strict'

const GE = require('@adonisjs/generic-exceptions')

class DriverNotSupported extends GE.RuntimeException {
  static driver (name) {
    const exception = new this(`Driver ${name} is not supported`, 400)

    exception.driver = name

    return exception
  }
}

class FileNotFound extends GE.RuntimeException {
  static file (err, path) {
    const exception = new this(`The file "${path}" doesn't exist`, 404, 'E_FILE_NOT_FOUND')

    exception.raw = err
    exception.file = path

    return exception
  }
}

class InvalidConfig extends GE.RuntimeException {
  static missingDiskName () {
    return new this('Make sure to define a default disk name inside config file', 500, 'E_INVALID_CONFIG')
  }

  static missingDiskConfig (name) {
    return new this(`Make sure to define config for ${name} disk`, 500, 'E_INVALID_CONFIG')
  }

  static missingDiskDriver (name) {
    return new this(`Make sure to define driver for ${name} disk`, 500, 'E_INVALID_CONFIG')
  }
}

class MethodNotSupported extends GE.RuntimeException {
  static method (name, driver) {
    const exception = new this(`Method ${name} is not supported for the driver ${driver}`, 400)

    exception.method = name
    exception.driver = driver

    return exception
  }
}

class UnknownException extends GE.RuntimeException {
  static invoke (err, code, path) {
    const exception = new this(`An unknown error happened with the file ${path}. Error code: ${code}`, 500, 'E_UNKNOWN')

    exception.raw = err
    exception.file = path

    return exception
  }
}

class PermissionMissing extends GE.RuntimeException {
  static invoke (err, path) {
    const exception = new this(`Missing permission for file ${path}\n${err.message}`, 500, 'E_PERMISSION_MISSING')

    exception.raw = err
    exception.file = path

    return exception 
	}
}

module.exports = {
  DriverNotSupported,
  FileNotFound,
  InvalidConfig,
  MethodNotSupported,
  PermissionMissing,
  UnknownException,
}
