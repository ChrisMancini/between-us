# Automated Docker Image Publishing to GitHub Container Registry

The CI pipeline currently builds a Docker image on every PR as a build-sanity check but never pushes it anywhere. Tagging master and publishing the image to a container registry is done manually after each merge. This should be automated.

## Approach

Add a `publish.yml` workflow that triggers on every push to master. It reads the version from `package.json`, creates a git tag (`v1.2.3`), and builds and pushes the image to GitHub Container Registry (ghcr.io) tagged with both the exact version and `latest`.

The existing `docker` job in `ci.yml` is left untouched — it continues to serve as a fast build-sanity check on PRs.

## Considered Options

- **GitHub Container Registry (ghcr.io)** — chosen. Auth is handled automatically via the built-in `GITHUB_TOKEN`; no additional secrets required. Free and tightly integrated with the existing GitHub Actions setup.
- **Docker Hub** — requires creating a separate account and storing credentials as GitHub secrets (`DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`). Extra overhead for a personal project already fully on GitHub.
- **Private registry on NAS** — requires the NAS to be reachable from GitHub Actions runners. The NAS is local-only, so this is not viable.

## Decisions

| Decision | Choice |
|---|---|
| Registry | `ghcr.io` |
| Trigger | Push to master |
| Image name | `ghcr.io/chrismancini/between-us` |
| Docker tags | `v1.2.3` (from `package.json`) + `latest` |
| Git tag | Auto-created from `package.json` version |
| NAS deployment | Remains manual (NAS is not reachable from GitHub runners) |

The `version-check.yml` workflow already enforces that every PR bumps the version in `package.json` before merging. By the time something lands on master, the version is locked in — making it safe to auto-tag from `package.json` without risk of collision.

## Implementation

### 1. Add `publish.yml` workflow

**New file:** `.github/workflows/publish.yml`

Triggers on `push` to `master`. Requires two permissions:
- `contents: write` — to create and push the git tag
- `packages: write` — to push to ghcr.io

Steps:
1. Checkout
2. Read version: `node -p "require('./package.json').version"` → `$GITHUB_OUTPUT`
3. Create and push git tag `v{version}` (skip gracefully if the tag already exists — handles re-runs)
4. Log in to ghcr.io using `docker/login-action` with `GITHUB_TOKEN`
5. Build and push using `docker/build-push-action` with tags `ghcr.io/chrismancini/between-us:v{version}` and `ghcr.io/chrismancini/between-us:latest`

### 2. No changes to `ci.yml`

The existing `docker` job (PR build-sanity check) stays as-is.

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/publish.yml` | **New** — triggers on master push; tags and publishes Docker image |

## Verification

1. Merge a PR with a version bump to master
2. Confirm the `publish` workflow run succeeds in the Actions tab
3. Confirm the git tag `v{version}` appears in the repo's tags
4. Confirm the image appears under the repo's Packages on GitHub (`ghcr.io/chrismancini/between-us`)
5. On the NAS, run `docker pull ghcr.io/chrismancini/between-us:latest` and confirm it resolves
