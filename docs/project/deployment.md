# Deployment & publishing

## GitHub Pages (the app)

1. Push the project to [`bookklik-technologies/svg-path-studio`](https://github.com/bookklik-technologies/svg-path-studio) with a `main` branch.
2. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
3. Run **Deploy to GitHub Pages** from the **Actions** tab, or push a new commit to `main`.

The workflow (`.github/workflows/pages.yml`) installs the pinned pnpm version from `package.json`, builds the core and app, and publishes `packages/app/dist` to <https://bookklik-technologies.github.io/svg-path-studio/>. The deployment URL also appears in the workflow's `github-pages` environment.

The app uses relative asset and service-worker URLs, so the same build supports a repository subpath, an `<owner>.github.io` repository, or a custom domain without changing the Vite `base`. The Pages workflow runs the production build; the CI workflow (`.github/workflows/ci.yml`) handles its own checks.

## GitHub Pages (this documentation site)

This site builds with VitePress:

```bash
pnpm docs:build    # output in docs/.vitepress/dist
pnpm preview       # serve the production build locally
```

To deploy under a subpath, set the `base` option in [`docs/.vitepress/config.mts`](https://github.com/bookklik-technologies/svg-path-studio/tree/main/docs/.vitepress/config.mts) and a `VitePress` deployment workflow can publish `docs/.vitepress/dist` the same way as the app workflow above.

## npm publishing — manual release

Only `packages/core` (`@bookklik/svg-path-studio`) is publishable. The repository root and browser app remain private. **No automatic publishing workflow is configured — nothing publishes automatically.**

### Before release

1. Confirm you control the `@bookklik` npm scope and that the intended package name/version is available.
2. Confirm the release version in `packages/core/package.json` and commit your release changes yourself.
3. From the repository root, install and validate:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm package:check
```

`package:check` performs an `npm pack` dry run, checks export targets, declarations, README/license, and the file allowlist, and rejects local runtime dependency protocols.

### Create and inspect the tarball

From the repository root:

```sh
cd packages/core
npm pack --dry-run
npm pack
```

`prepack` builds the library before packaging. The tarball contains compiled ESM, TypeScript declarations, source maps with embedded sources, README, LICENSE, and package metadata — it does not contain the app or workspace dependencies.

### Publish manually when ready

From `packages/core`, after reviewing the tarball:

```sh
npm login
npm whoami
npm publish ./bookklik-svg-path-studio-0.2.2.tgz --access public
```

Use your actual tarball filename. Package/scope ownership and registry availability must be checked by the publisher; they are not assumed by local validation. See [`PUBLISHING.md`](https://github.com/bookklik-technologies/svg-path-studio/blob/main/PUBLISHING.md) in the repository for the complete procedure.
