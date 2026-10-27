# Manual npm release

Only `packages/core` (`@svg-path-studio/core`) is publishable. The repository root and browser app remain private. No automatic publishing workflow is configured.

## Before release

1. Confirm you control the `@svg-path-studio` npm scope and that the intended package name/version is available. If using a different scope, update the core name, the app's workspace dependency, documentation and lockfile together.
2. Confirm the release version in `packages/core/package.json` and commit/review your release changes yourself. The release version is `0.2.0`; bump it if that version has already been published.
3. From the repository root, install and validate:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm package:check
```

Run unit tests separately after obtaining permission under this project's agent instructions. The package check performs an npm pack dry run, checks export targets, declarations, README/license and the file allowlist, and rejects local runtime dependency protocols. It does not run unit tests or publish anything.

## Create and inspect the tarball

From the repository root:

```sh
cd packages/core
npm pack --dry-run
npm pack
```

`prepack` builds the library before packaging. The tarball contains compiled ESM, TypeScript declarations, source maps with embedded sources, README, LICENSE and package metadata. It does not contain the app or workspace dependencies. Install the tarball into a separate consumer project if you want to verify integration before publishing:

```sh
npm install /absolute/path/to/svg-path-studio-core-0.2.0.tgz
```

Use the actual filename printed by `npm pack` if the package name or version changed. Both imports are public:

```js
import { SpsPath, createPathEditor } from '@svg-path-studio/core';
import { createPathEditor as createHeadlessEditor } from '@svg-path-studio/core/headless';
```

## Publish manually when ready

From `packages/core`, after reviewing the tarball:

```sh
npm login
npm whoami
npm publish ./svg-path-studio-core-0.2.0.tgz --access public
```

Use your actual tarball filename. Complete npm's authentication/2FA prompts. Publishing the inspected tarball releases exactly those packaged files; do not publish from the repository root. No credentials belong in this repository. Package/scope ownership and registry availability must be checked by the publisher; they are not assumed by local validation.
