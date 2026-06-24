# Plan: Automated Docker Publish Workflow

## Context

Publishing to ghcr.io and creating git tags after each master merge is currently done manually. ADR-0006 documents the decision to automate this via a new `publish.yml` workflow. The existing `version-check.yml` already enforces a version bump on every PR, so the version in `package.json` is always fresh when code lands on master.

---

## Implementation

### New file: `.github/workflows/publish.yml`

**Trigger:** `push` to `master`

**Permissions:**
```yaml
permissions:
  contents: write   # create + push the git tag and release
  packages: write   # push to ghcr.io
```

**Steps:**

1. **Checkout** — `actions/checkout@v5` (matches ci.yml pattern); `fetch-depth: 0` to ensure full history is available for release note generation

2. **Read version** — extract from `package.json` and write to `$GITHUB_OUTPUT`
   ```bash
   echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT
   ```

3. **Create GitHub Release** — `softprops/action-gh-release@v2` with:
   - `tag_name: v${{ steps.version.outputs.version }}` — creates the git tag and the GitHub Release in one step
   - `generate_release_notes: true` — auto-generates the "What's Changed" section from PRs merged since the previous release (same behavior as the current manual flow)
   - Handles re-runs gracefully (no-ops if the release already exists)

4. **Log in to ghcr.io** — `docker/login-action@v3` using `secrets.GITHUB_TOKEN`

5. **Set up Docker Buildx** — `docker/setup-buildx-action@v3` (required by build-push-action)

6. **Build and push** — `docker/build-push-action@v6` with:
   - `push: true`
   - Tags: `ghcr.io/chrismancini/between-us:v${{ steps.version.outputs.version }}` and `ghcr.io/chrismancini/between-us:latest`

**No changes to `ci.yml`** — the existing `docker` job (PR build-sanity check) is untouched.

---

## Verification

1. Merge a PR with a version bump to master.
2. Confirm the `Publish Docker Image` workflow run succeeds in the Actions tab.
3. Confirm a GitHub Release with a "What's Changed" section appears under the repo's Releases.
4. Confirm the git tag (e.g., `v1.10.0`) appears under the repo's Tags on GitHub.
5. Confirm the image appears under the repo's Packages (`ghcr.io/chrismancini/between-us`).
6. On the NAS, run `docker pull ghcr.io/chrismancini/between-us:latest` to confirm it resolves.
