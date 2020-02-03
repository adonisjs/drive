'use strict'

const CE = require('../Exceptions')

const pathMap = {
  local: './LocalFileSystem',
  s3: './AwsS3',
  spaces: './AwsS3',
}

const proxyHandler = {
  get (_, name) {
    const path = pathMap[name]

    if (path === undefined) {
      throw CE.DriverNotSupported.driver(name)
    }

    return require(pathMap[name])
  },
}

module.exports = new Proxy({}, proxyHandler)
