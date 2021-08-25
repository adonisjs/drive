// require('@adonisjs/require-ts/build/register')
require('ts-node').register({
  transpileOnly: true,
})

const { configure } = require('japa')

configure({
  files: ['test/**/*.spec.ts'],
})
