/*
 * @adonisjs/drive
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { readFile } from 'node:fs/promises'
import { Disk, DriveManager } from 'flydrive'
import { configProvider } from '@adonisjs/core'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ApplicationService } from '@adonisjs/core/types'

import debug from '../src/debug.ts'
import { createFileServer } from '../src/file_server.ts'
import type {
  DriveDisks,
  DriveService,
  WriteOptions,
  SignedURLOptions,
  ServiceWithLocalServer,
} from '../src/types.ts'

/**
 * Extending the AdonisJS container with the drive manager service.
 * This allows the drive service to be resolved from the IoC container
 * using dependency injection.
 *
 * @example
 * ```js
 * // Inject drive manager in controllers/services
 * export default class FileController {
 *   constructor(@inject('drive.manager') private drive: DriveService) {}
 * }
 *
 * // Or resolve manually
 * const drive = await app.container.make('drive.manager')
 * ```
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'drive.manager': DriveService
  }
}

/**
 * Extending BodyParser MultipartFile with "moveToDisk" method
 * to move uploaded files from the local filesystem to a drive disk.
 * Supports both stream and buffer modes for different cloud providers.
 *
 * @example
 * ```js
 * // In route handlers or controllers
 * export default class UploadController {
 *   async store({ request }) {
 *     const file = request.file('document')
 *
 *     // Simple usage - move to default disk
 *     await file.moveToDisk('documents/report.pdf')
 *
 *     // With specific disk and options
 *     await file.moveToDisk('avatars/user.jpg', 'uploads', {
 *       moveAs: 'stream',
 *       contentType: 'image/jpeg'
 *     })
 *
 *     // Access the file URL after moving
 *     console.log(file.meta.url) // Generated URL
 *   }
 * }
 * ```
 */
declare module '@adonisjs/core/bodyparser' {
  interface MultipartFile {
    /**
     * Move user uploaded file from the tmp directory
     * to a Drive disk. File URL is automatically set in meta.url.
     *
     * @param key - The destination file path/key
     * @param disk - The disk name to use (optional, uses default if not specified)
     * @param options - Write options and move configuration
     * @param options.moveAs - Upload mode: 'stream' (default) or 'buffer'
     */
    moveToDisk(
      key: string,
      disk?: keyof DriveDisks,
      options?: WriteOptions & {
        /**
         * When using "stream", the file from the tmpPath will be read
         * as a stream and written to the cloud provider.
         *
         * Whereas, in case of "buffer", the entire file will be first
         * read into the memory and then sent to the cloud provider. Some
         * cloud providers like supabase cannot work with the "stream" option.
         */
        moveAs?: 'stream' | 'buffer'
      }
    ): Promise<void>
    /**
     * Move user uploaded file from the tmp directory
     * to a Drive disk using the default disk.
     *
     * @param key - The destination file path/key
     * @param options - Write options and move configuration
     * @param options.moveAs - Upload mode: 'stream' (default) or 'buffer'
     */
    moveToDisk(
      key: string,
      options?: WriteOptions & {
        /**
         * When using "stream", the file from the tmpPath will be read
         * as a stream and written to the cloud provider.
         *
         * Whereas, in case of "buffer", the entire file will be first
         * read into the memory and then sent to the cloud provider. Some
         * cloud providers like supabase cannot work with the "stream" option.
         */
        moveAs?: 'stream' | 'buffer'
      }
    ): Promise<void>
  }
}

/**
 * Drive Provider registers a singleton drive manager service
 * to the IoC container and wires up the routing to serve
 * files from the "fs" driver.
 *
 * @example
 * ```js
 * // Automatically registered by AdonisJS when package is installed
 * // Access drive service in your application:
 *
 * export default class FileController {
 *   async upload({ request }) {
 *     const drive = await app.container.make('drive.manager')
 *     const file = request.file('document')
 *
 *     await file.moveToDisk('documents/doc.pdf')
 *     return { url: file.meta.url }
 *   }
 * }
 * ```
 */
export default class DriveProvider {
  /**
   * Collection of services using the "fs" driver and want
   * to serve files using the AdonisJS HTTP server.
   */
  #locallyServedServices: ServiceWithLocalServer[] = []

  /**
   * Creates a new DriveProvider instance.
   *
   * @param app - The AdonisJS application service instance
   */
  constructor(protected app: ApplicationService) {}

  /**
   * Registers Edge.js template helpers for generating drive URLs.
   * Adds global helpers `driveUrl` and `driveSignedUrl` to Edge templates.
   *
   * @param drive - The drive manager instance
   *
   * @example
   * ```js
   * // In Edge templates after registration:
   * // Generate public URL
   * <img src="{{ driveUrl('profile/avatar.jpg') }}" />
   *
   * // Generate signed URL with expiration
   * <a href="{{ await driveSignedUrl('documents/secret.pdf', { expiresIn: '1h' }) }}">
   *   Download Document
   * </a>
   *
   * // Use specific disk
   * <img src="{{ driveUrl('thumb.jpg', 'thumbnails') }}" />
   * ```
   */
  protected async registerViewHelpers(drive: DriveManager<any>) {
    if (this.app.usingEdgeJS) {
      const edge = await import('edge.js')
      debug('detected edge installation. Registering drive global helpers')

      edge.default.global(
        'driveUrl',
        /**
         * Edge.js global helper to generate public URLs for files.
         *
         * @param key - The file key/path
         * @param diskName - Optional disk name, uses default if not specified
         */
        function (key: string, diskName?: string) {
          const disk = diskName ? drive.use(diskName) : drive.use()
          return disk.getUrl(key)
        }
      )

      edge.default.global(
        'driveSignedUrl',
        /**
         * Edge.js global helper to generate signed URLs for private files.
         *
         * @param key - The file key/path
         * @param diskNameOrOptions - Either disk name or signed URL options
         * @param signedUrlOptions - Signed URL options when first param is disk name
         */
        function (
          key: string,
          diskNameOrOptions?: string | SignedURLOptions,
          signedUrlOptions?: SignedURLOptions
        ) {
          let diskName: string | undefined
          let options: SignedURLOptions | undefined = signedUrlOptions

          if (typeof diskNameOrOptions === 'string') {
            diskName = diskNameOrOptions
          } else if (diskNameOrOptions && !signedUrlOptions) {
            options = diskNameOrOptions
          }

          const disk = diskName ? drive.use(diskName) : drive.use()
          return disk.getSignedUrl(key, options)
        }
      )
    }
  }

  /**
   * Extends BodyParser MultipartFile class with "moveToDisk"
   * method to move uploaded files from the local filesystem to
   * a drive disk. Supports both stream and buffer upload modes.
   *
   * @param drive - The drive manager instance
   *
   * @example
   * ```js
   * // In a controller after this extension is registered:
   * export default class UploadController {
   *   async store({ request }) {
   *     const avatar = request.file('avatar')
   *
   *     // Move to default disk
   *     await avatar.moveToDisk('avatars/user-123.jpg')
   *
   *     // Move to specific disk with options
   *     await avatar.moveToDisk('documents/file.pdf', 's3', {
   *       moveAs: 'buffer',
   *       contentType: 'application/pdf'
   *     })
   *
   *     // Access the generated URL
   *     return { url: avatar.meta.url }
   *   }
   * }
   * ```
   */
  protected async extendMultipartFile(drive: DriveManager<any>) {
    debug('Adding "MultipartFile.moveToDisk" method')

    MultipartFile.macro(
      'moveToDisk',
      /**
       * Moves an uploaded file from temp directory to a drive disk.
       *
       * @param this - The MultipartFile instance
       * @param key - The destination file key/path
       * @param diskNameOrOptions - Either disk name or write options
       * @param writeOptions - Write options when first param is disk name
       */
      async function (this: MultipartFile, key, diskNameOrOptions?, writeOptions?) {
        if (!this.tmpPath) {
          throw new RuntimeException(
            'property "tmpPath" must be set on the file before moving it',
            {
              status: 500,
              code: 'E_MISSING_FILE_TMP_PATH',
            }
          )
        }

        let diskName: string | undefined
        let options: WriteOptions & { moveAs?: 'stream' | 'buffer' } = {}

        if (typeof diskNameOrOptions === 'string') {
          diskName = diskNameOrOptions
          options = writeOptions ?? {}
        } else if (diskNameOrOptions && !writeOptions) {
          options = diskNameOrOptions
        } else if (writeOptions) {
          options = writeOptions
        }

        const moveAs = options.moveAs ?? 'stream'
        const disk = diskName ? drive.use(diskName) : drive.use()

        if (moveAs === 'stream') {
          await disk.moveFromFs(this.tmpPath, key, options)
        } else {
          await disk.put(key, await readFile(this.tmpPath!), options)
        }

        try {
          this.meta.url = await disk.getUrl(key)
        } catch {}

        this.markAsMoved(key, key)
      }
    )
  }

  /**
   * Registers the drive manager singleton and Disk binding
   * in the IoC container. This method is called during the
   * AdonisJS application registration phase.
   *
   * @example
   * ```js
   * // The registered services can be injected:
   * export default class FileService {
   *   constructor(
   *     @inject('drive.manager') private drive: DriveService,
   *     @inject(Disk) private defaultDisk: Disk
   *   ) {}
   * }
   * ```
   */
  register() {
    this.app.container.singleton('drive.manager', async () => {
      /**
       * Resolving config from the "config/drive.ts" file and
       * expecting it to be a config provider.
       */
      const driveConfigProvider = this.app.config.get('drive')
      const config = await configProvider.resolve<{
        config: any
        locallyServed: ServiceWithLocalServer[]
      }>(this.app, driveConfigProvider)

      /**
       * Ensure the returned value is the output of the
       * config provider
       */
      if (!config) {
        throw new RuntimeException(
          'Invalid "config/drive.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      /**
       * Keep a reference of services to be served locally
       */
      this.#locallyServedServices = config.locallyServed
      return new DriveManager(config.config)
    })

    this.app.container.bind(Disk, async (resolver) => {
      const driveManager = await resolver.make('drive.manager')
      return driveManager.use()
    })
  }

  /**
   * The boot method resolves drive and router to register
   * the routes for the locally served services. Also registers
   * view helpers and extends MultipartFile with drive methods.
   *
   * The routes must be defined before the application has
   * started. This method is called during the AdonisJS
   * application boot phase.
   *
   * @example
   * ```js
   * // After boot, these routes are automatically available:
   * // GET /uploads/* -> serves files from 'uploads' disk
   * // GET /documents/* -> serves files from 'documents' disk
   *
   * // View helpers are available in Edge templates:
   * // {{ driveUrl('file.jpg') }}
   * // {{ await driveSignedUrl('private.pdf', { expiresIn: '1h' }) }}
   *
   * // MultipartFile extension is available:
   * // await file.moveToDisk('uploads/document.pdf')
   * ```
   */
  async boot() {
    const drive = await this.app.container.make('drive.manager')
    const router = await this.app.container.make('router')

    this.#locallyServedServices.forEach((service) => {
      debug(
        'configuring drive local file server for "%s", route "%s"',
        service.service,
        service.routePattern
      )
      router
        .get(service.routePattern, createFileServer(drive.use(service.service)))
        .as(service.routeName)
    })

    await this.registerViewHelpers(drive)
    await this.extendMultipartFile(drive)
  }
}
