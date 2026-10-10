# Release process

## Versioning

WriteBetter follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **PATCH**: bug fixes only.
- **MINOR**: new features that don't change existing behaviour.
- **MAJOR**: changes users must adapt to, such as a new permission (which makes Chrome disable the extension until the user approves it).

The version lives in one place, `package.json`. The manifest takes its version from there at build time.

## Commands

| Command                  | What it does                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `npm run verify`         | Format, lint, types, unit/component/integration tests, build, build validation |
| `npm run test:e2e`       | Builds the editor test pages, then runs every end-to-end test in Chromium      |
| `npm run package`        | Zips `dist/` (without source maps) into `writebetter-<version>.zip`            |
| `npm run verify:package` | Opens the zip and checks its contents against `dist/`                          |
| `npm run check:version`  | package.json, lockfile, CHANGELOG and tag all agree                            |
| `npm run release:notes`  | Prints this version's CHANGELOG section                                        |
| `npm run sbom`           | Writes `writebetter-sbom.cdx.json` (CycloneDX) for the bundled packages        |

## Gates

Every pull request and every push to `main` runs [CI](../.github/workflows/ci.yml). All jobs must pass to merge:

1. **Quality**: Prettier, ESLint, TypeScript, Vitest with coverage thresholds.
2. **Build**: production build, `validate:build` (manifest, permissions, CSP, secrets, network surface, size), package, `verify:package`.
3. **End-to-end**: every Playwright test in Chromium, including accessibility scans and real editor libraries. Any error from an extension page fails a test.
4. **Audit**: `npm audit --audit-level=high` and `npm audit signatures`.

## Making a release

1. Start from an up-to-date `main` with CI green.
2. Run the manual checks in [test-cases.md](test-cases.md) (real Chrome, real sites, screen reader) against `npm run build` output, and record the results there.
3. On a release branch:
   - set `"version"` in `package.json`, then run `npm install` to update the lockfile;
   - in `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and add a fresh empty `## [Unreleased]` above it;
   - run `npm run check:version` and `npm run verify`.
4. Open a PR, let CI pass, merge.
5. Tag the merge commit and push the tag:
   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. The [release workflow](../.github/workflows/release.yml) re-runs every CI gate, checks the version against the tag, builds, validates and packages, then publishes a GitHub release with the zip, `SHA256SUMS.txt`, the SBOM and the CHANGELOG section as notes.

## Publishing to the Chrome Web Store

This is deliberately **manual**: no workflow holds Web Store credentials, and nothing reaches users without a person choosing to publish.

1. Download the zip from the GitHub release and check it against `SHA256SUMS.txt`.
2. Load it unpacked in Chrome once more (`chrome://extensions`, Developer mode, Load unpacked on the extracted folder) and run the core journey.
3. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), upload the zip. Review the permission justifications and the privacy disclosures against [privacy.md](privacy.md) and [security.md](security.md).
4. Submit for review. Consider a staged rollout for anything beyond a small fix.

## Recovery

| Problem                                   | What to do                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release workflow failed before publishing | Nothing was published. Fix on a branch, merge, delete the tag (`git push --delete origin vX.Y.Z`; `git tag -d vX.Y.Z`), re-tag.                                  |
| Bad version published as a GitHub release | Mark the GitHub release as a pre-release or delete it; publish a new PATCH version. Never re-use a version number.                                               |
| Bad version live on the Chrome Web Store  | Roll back in the Developer Dashboard to the previous package if available; otherwise publish a PATCH with the fix. Chrome updates installed copies within hours. |
| A dependency is found to be compromised   | Pin to the last good version, rebuild, release a PATCH; check `npm audit signatures` and the SBOM of affected releases.                                          |
