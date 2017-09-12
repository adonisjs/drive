## Registering provider

Make sure to register the provider inside `start/app.js` file.

```js
const providers = [
  '@adonisjs/drive/providers/DriveProvider'
]
```

That's all! Now you can use the provider by pulling it from IoC container

```js
const Drive = use('Drive')

await Drive.get('relative-path-to-file')

// defined disk
await Drive.disk('s3').get('file-name')
```

## Config

The config file is saved as `config/drive.js`. Make sure to tweak it as per your needs.

## Env variables

The `s3` driver relies on following Env variables.

```
S3_KEY =
S3_SECRET =
S3_BUCKET =
S3_REGION = 
```
