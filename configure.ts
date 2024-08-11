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
    dependencies: [],
  },
  s3: {
    name: 'AWS S3',
    env: [
      { name: 'AWS_ACCESS_KEY_ID', value: '', schema: 'Env.schema.string()' },
      { name: 'AWS_SECRET_ACCESS_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'AWS_REGION', value: '', schema: 'Env.schema.string()' },
      { name: 'S3_BUCKET', value: '', schema: 'Env.schema.string()' },
    ],
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  },
  spaces: {
    name: 'Digital Ocean Spaces',
    env: [
      { name: 'SPACES_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'SPACES_SECRET', value: '', schema: 'Env.schema.string()' },
      { name: 'SPACES_REGION', value: '', schema: 'Env.schema.string()' },
      { name: 'SPACES_BUCKET', value: '', schema: 'Env.schema.string()' },
      {
        name: 'SPACES_ENDPOINT',
        value: `https://\${SPACES_REGION}.digitaloceanspaces.com`,
        schema: 'Env.schema.string()',
      },
    ],
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  },
  r2: {
    name: 'Cloudflare R2',
    env: [
      { name: 'R2_KEY', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_SECRET', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_BUCKET', value: '', schema: 'Env.schema.string()' },
      { name: 'R2_ENDPOINT', value: '', schema: 'Env.schema.string()' },
    ],
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  },
  gcs: {
    name: 'Google Cloud Storage',
    env: [
      { name: 'GCS_KEY', value: 'file://./gcs_key.json', schema: 'Env.schema.string()' },
      { name: 'GCS_BUCKET', value: '', schema: 'Env.schema.string()' },
    ],
    dependencies: ['@google-cloud/storage'],
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
   * Should dependencies be installed
   */
  let shouldInstallPackages: boolean | undefined = command.parsedFlags.install

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
    services.reduce<Record<string, string>>(
      (result, service) => {
        STORAGE_SERVICES[service].env.forEach((envVariable) => {
          result[envVariable.name] = envVariable.value
        })
        return result
      },
      {
        DRIVE_DISK: services[0],
      }
    )
  )

  /**
   * Define env variables validation for the selected services
   */
  await codemods.defineEnvValidations({
    leadingComment: 'Variables for configuring the drive package',
    variables: services.reduce<Record<string, string>>(
      (result, service) => {
        STORAGE_SERVICES[service].env.forEach((envVariable) => {
          result[envVariable.name] = envVariable.schema
        })
        return result
      },
      {
        DRIVE_DISK: `Env.schema.enum(['${services.join("', '")}' as const])`,
      }
    ),
  })

  /**
   * Create a flat collection of dependencies to install
   * based upon the configured services.
   */
  const pkgsToInstall = services
    .flatMap((service) => STORAGE_SERVICES[service].dependencies)
    .map((pkg) => {
      return { name: pkg, isDevDependency: false }
    })
  if (!pkgsToInstall.length) {
    return
  }

  /**
   * Prompt to install additional services
   */
  if (!shouldInstallPackages) {
    shouldInstallPackages = await command.prompt.confirm(
      'Do you want to install additional packages required by "@adonisjs/drive"?'
    )
  }

  if (shouldInstallPackages) {
    await codemods.installPackages(pkgsToInstall)
  } else {
    await codemods.listPackagesToInstall(pkgsToInstall)
  }
}
