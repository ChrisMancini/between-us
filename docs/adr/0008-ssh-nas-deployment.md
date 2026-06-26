# SSH-Based NAS Deployment via ghcr.io Pull

`build.mjs` built a Docker image locally, exported it as a tar file, and gave instructions for manually transferring and importing it via the Synology Container Manager GUI — a multi-step process requiring ~5 minutes of GUI work per deploy.

With the image now published automatically to `ghcr.io` (see ADR-0006), the NAS can pull it directly over SSH. `deploy.mjs` replaces the old script: it SSHes into the NAS using a `~/.ssh/config` host alias (`Host nas`), runs `docker pull ghcr.io/chrismancini/between-us:latest`, and restarts the container — reducing a 5-step GUI workflow to a single command.

## Considered Options

- **Tar file export + GUI import** — the prior approach. Required a local Docker build, `docker save`, file transfer (network share or SCP), and GUI steps in Container Manager to overwrite the image and reset the container. No SSH needed, but no automation possible.
- **SSH + pull from ghcr.io** — chosen. The image is already on `ghcr.io` (public) after every master merge, so there is nothing to build locally. SSH gives the script direct control over `docker pull` and `docker restart`. The one-time setup cost is adding a `Host nas` block to `~/.ssh/config`.
- **Synology REST API** — Synology exposes an API that can trigger Container Manager actions without SSH. Not chosen: requires API key management, is poorly documented, and is more fragile across DSM versions than plain SSH + Docker CLI.
