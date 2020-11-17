import { join } from 'path'

import * as sinkStatic from '@adonisjs/sink'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

const DRIVERS_PROMPT_CHOICES = [
	{
		name: 'local' as const,
		message: 'Local File System',
	},
	{
		name: 's3' as const,
		message: 'Amazon S3',
	},
	{
		name: 'gcs' as const,
		message: 'Google Cloud Storage',
	},
]

function getDrivers(sink: typeof sinkStatic) {
	return sink
		.getPrompt()
		.multiple(
			'Which drivers are you going to use? (use "space" to select item)',
			DRIVERS_PROMPT_CHOICES,
			{
				validate(choices) {
					return choices && choices.length ? true : 'Select at least one driver to continue'
				},
			}
		)
}

/**
 * Returns absolute path to the stub relative from the templates
 * directory
 */
function getStub(...relativePaths: string[]) {
	return join(__dirname, 'templates', ...relativePaths)
}

/**
 * Instructions to be executed when setting up the package.
 */
export default async function instructions(
	projectRoot: string,
	app: ApplicationContract,
	sink: typeof sinkStatic
) {
	const drivers = await getDrivers(sink)

	const mustacheConfig = {
		primary: drivers[0],
		local: drivers.includes('local'),
		s3: drivers.includes('s3'),
		gcs: drivers.includes('gcs'),
	}

	const configPath = app.configPath('drive.ts')
	const driveConfig = new sink.files.MustacheFile(projectRoot, configPath, getStub('config.txt'))
	driveConfig.apply(mustacheConfig).commit()
	sink.logger.create(configPath)

	const contractPath = app.makePath(app.directoriesMap.get('contracts')!, 'drive.ts')
	const driveContract = new sink.files.MustacheFile(
		projectRoot,
		contractPath,
		getStub('contract.txt')
	)
	driveContract.apply(mustacheConfig).commit()
	sink.logger.create(contractPath)

	/**
	 * Setup .env file
	 */
	const env = new sink.files.EnvFile(projectRoot)
	env.set('DRIVE_DISK', drivers[0])

	if (drivers.includes('local')) {
		env.set('DRIVE_LOCAL_ROOT', 'files')
	}

	if (drivers.includes('s3')) {
		env.set('DRIVE_S3_BUCKET', '')
		env.set('DRIVE_S3_KEY', '')
		env.set('DRIVE_S3_SECRET', '')
	}

	if (drivers.includes('gcs')) {
		env.set('DRIVE_GCS_BUCKET', '')
	}

	env.commit()
	sink.logger.success('.env')

	/**
	 * Install required dependencies
	 */
	const pkg = new sink.files.PackageJsonFile(projectRoot)

	if (drivers.includes('s3')) {
		pkg.install('@slynova/flydrive-s3', undefined, false)
	}

	if (drivers.includes('gcs')) {
		pkg.install('@slynova/flydrive-gcs', undefined, false)
	}

	sink.logger.info(`Installing packages: ${pkg.getInstalls().list.join(', ')}...`)
	await pkg.commitAsync()
	sink.logger.success('Packages installed!')
}
