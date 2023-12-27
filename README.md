# AdonisJS package starter kit

> A boilerplate for creating AdonisJS packages

This repo provides you a starting point for creating AdonisJS packages. Ofcourse, you can create a package from scratch with your folder structure and workflow. However, using this starter kit can speed up the process, as you have fewer decisions to make.

## Setup

- Clone the repo on your computer, or use `giget` to download this repo with git history.
  ```sh
  npx giget@latest gh:adonisjs/pkg-starter-kit
  ```
- Install dependencies.
- Update the `package.json` file and define `name`, `description`, `keywords`, and `author` properties.
- The repo is configured with MIT license. Feel free to change that, if you are not publishing under the MIT license.

## Folder structure

The starter kit mimics the folder structure of the official packages. Feel free to rename files and folders as per your requirements.

```
├── providers
├── src
├── bin
├── stubs
├── configure.ts
├── index.ts
├── LICENSE.md
├── package.json
├── README.md
├── tsconfig.json
├── tsnode.esm.js
```

- The `configure.ts` file exports the `configure` hook to configure the package using the `node ace configure` command.
- The `index.ts` file is the main entrypoint of the package.
- The `tsnode.esm.js` file is used to run TypeScript code using Ts-node + SWC. Please read the code comment in this file to learn more.
- The `bin` directory contains the entrypoint file to run Japa tests.
- Learn more about [the `providers` directory](./providers/README.md).
- Learn more about [the `src` directory](./src/README.md).
- Learn more about [the `stubs` directory](./stubs/README.md).

### File system naming convention

We use `snake_case` naming conventions for the file system. The rule is enforced using ESLint. However, feel free to disable the rule and use your preferred naming conventions.

## Peer dependencies

The starter kit has a peer dependency on `@adonisjs/core@6`. Since you are creating a package for AdonisJS, you must make it against a specific version of the framework core.

If your package needs Lucid to be functional, you may install `@adonisjs/lucid` as a development dependency and add it to the list of `peerDependencies`.

As a rule of thumb, packages installed in the user application should be part of the `peerDependencies` of your package and not the main dependency.

For example, if you install `@adonisjs/core` as a main dependency, then essentially, you are importing a separate copy of `@adonisjs/core` and not sharing the one from the user application. Here is a great article explaining [peer dependencies](https://blog.bitsrc.io/understanding-peer-dependencies-in-javascript-dbdb4ab5a7be).

## Published files

Instead of publishing all the source code of your repo to npm, you must cherry-pick files and folders to publish only the required files.

The cherry-picking is done using the `files` property inside the `package.json` file. By default, we publish the following files and folders.

```json
{
  "files": ["build/src", "build/providers", "build/stubs", "build/index.d.ts", "build/index.js"]
}
```

If you create additional folders or files, mention them inside the `files` array.

## Exports

[Node.js Subpath exports](https://nodejs.org/api/packages.html#subpath-exports) allows you to define the exports of your package regardless of the folder structure. This starter kit defines the following exports.

```json
{
  "exports": {
    ".": "./build/index.js",
    "./types": "./build/src/types.js"
  }
}
```

- The dot `.` export is the main export.
- The `./types` exports all the types defined inside the `./build/src/types.js` file (the compiled output).

Feel free to change the exports as per your requirements.

## Testing

We configure the [Japa test runner](https://japa.dev/) with this starter kit. Japa is used in AdonisJS applications as well. Just run one of the following commands to execute tests.

- `npm run test`: This command will first lint the code using ESlint and then run tests and report the test coverage using [c8](https://github.com/bcoe/c8).
- `npm run quick:test`: Runs only the tests without linting or coverage reporting.

The starter kit also comes with a Github workflow file to run tests using Github Actions. The tests are executed against `Node.js 20.x` and `Node.js 21.x` versions on both Linux and Windows. Feel free to edit the workflow file in the `.github/workflows` directory.

## TypeScript workflow

- The starter kit uses [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) for compiling the TypeScript to JavaScript at the time of publishing the package.
- [TS-Node](https://typestrong.org/ts-node/) and [SWC](https://swc.rs/) are used to run tests without compiling the source code.
- The `tsconfig.json` file is extended from [`@adonisjs/tsconfig`](https://github.com/adonisjs/tooling-config/tree/main/packages/typescript-config) and uses `NodeNext` module system. Meaning the packages are written using ES modules.
- You can perform type checking without compiling the source code using `npm run typecheck` script.

Feel free to explore the `tsconfig.json` file for all the configured options.

## ESLint and Prettier setup

The starter kit configures ESLint and Prettier. The configuration for both is stored within the `package.json` file, and use our [shared config](https://github.com/adonisjs/tooling-config/tree/main/packages). Feel free to change the config, use custom plugins or remove both tools altogether.

## Using Stale bot

The [Stale bot](https://github.com/apps/stale) is a Github application that automatically marks issues and PRs as stale and closes after a certain duration of inactivity.

Feel free to delete `.github/stale.yml` and `.github/lock.yml` files if you decide not to use the Stale bot.
