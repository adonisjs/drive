/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'

/**
 * List of available storage services
 */
const STORAGE_SERVICES = {
  fs: {
    name: 'Local filesystem',
    env: [],
  },
  s3: {
    name: 'AWS S3',
    env: [
      { name: 'AWS_ACCESS_KEY_ID', value: '', schema: 'Env.schema.string()' },
      { name: 'AWS_SECRET_ACCESS_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'AWS_REGION', value: '', schema: 'Env.schema.string()' },
      { name: 'S3_BUCKET', value: '', schema: 'Env.schema.string()' },
    ],
  },
  do: {
    name: 'Digital Ocean Spaces',
    env: [
      { name: 'DO_ACCESS_KEY_ID', value: '', schema: 'Env.schema.string()' },
      { name: 'DO_SECRET_ACCESS_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'DO_REGION', value: '', schema: 'Env.schema.string()' },
      { name: 'DO_BUCKET', value: '', schema: 'Env.schema.string()' },
      {
        name: 'DO_ENDPOINT',
        value: `https://\${DO_REGION}.digitaloceanspaces.com`,
        schema: 'Env.schema.string()',
      },
    ],
  },
  r2: {
    name: 'Cloudflare R2',
    env: [
      { name: 'R2_ACCESS_KEY_ID', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_SECRET_ACCESS_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_BUCKET', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_ENDPOINT', value: '', schema: 'Env.schema.string()' },
    ],
  },
  gcs: {
    name: 'Google Cloud Storage',
    env: [
      { name: 'GCS_KEY', value: 'file://./gcs_key.json', schema: 'Env.schema.string()' },
      { name: 'GCS_BUCKET', value: '', schema: 'Env.schema.string()' },
    ],
  },
}

/**
 * List of known services
 */
const SERVICES_NAMES = Object.keys(STORAGE_SERVICES) as (keyof typeof STORAGE_SERVICES)[]

export async function configure(command: ConfigureCommand) {
  /**
   * Read services from the "--services" CLI flag
   */
  let selectedServices:
    | keyof typeof STORAGE_SERVICES
    | (keyof typeof STORAGE_SERVICES)[]
    | undefined = command.parsedFlags.services

  /**
   * Display prompt when no services are specified
   * via the CLI flag.
   */
  if (!selectedServices) {
    selectedServices = await command.prompt.multiple(
      'Select the storage services you want to use',
      SERVICES_NAMES.map((service) => {
        return {
          name: service,
          message: STORAGE_SERVICES[service].name,
        }
      }),
      {
        validate(values) {
          return !values || !values.length ? 'Please select one or more services' : true
        },
      }
    )
  }

  /**
   * Normalized list of services
   */
  const services = typeof selectedServices === 'string' ? [selectedServices] : selectedServices!

  const unknownServices = services.find((service) => !SERVICES_NAMES.includes(service))
  if (unknownServices) {
    command.exitCode = 1
    command.logger.logError(
      `Invalid service "${unknownServices}". Supported services are: ${string.sentence(
        SERVICES_NAMES
      )}`
    )
    return
  }

  const codemods = await command.createCodemods()

  /**
   * Publish config file
   */
  await codemods.makeUsingStub(stubsRoot, 'config/drive.stub', {
    services,
  })

  /**
   * Publish provider
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@adonisjs/drive/drive_provider')
  })

  /**
   * Define env variables for the selected services
   */
  await codemods.defineEnvVariables(
    services.reduce<Record<string, string>>((result, service) => {
      STORAGE_SERVICES[service].env.forEach((envVariable) => {
        result[envVariable.name] = envVariable.value
      })
      return result
    }, {})
  )

  /**
   * Define env variables validation for the selected services
   */
  await codemods.defineEnvValidations({
    leadingComment: 'Variables for configuring the drive package',
    variables: services.reduce<Record<string, string>>((result, service) => {
      STORAGE_SERVICES[service].env.forEach((envVariable) => {
        result[envVariable.name] = envVariable.schema
      })
      return result
    }, {}),
  })
}
