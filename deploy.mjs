#!/usr/bin/env node

import { execSync } from "node:child_process";

const IMAGE = "ghcr.io/chrismancini/between-us:latest";
const CONTAINER = process.argv[2] ?? "ghcr-io-chrismancini-between-us";
const NAS = "nas";
const DOCKER = "sudo /volume1/@appstore/ContainerManager/usr/bin/docker";
const ENV_FILE = "/volume1/docker/between-us/.env";

function sshExec(command, opts = {}) {
  return execSync(`ssh ${NAS} "${command}"`, { stdio: "inherit", ...opts });
}

// ── 1. Verify SSH connectivity ───────────────────────────────────────────────
process.stdout.write("Connecting to NAS... ");
try {
  sshExec("echo ok", { stdio: "pipe" });
  console.log("connected.");
} catch {
  console.log("");
  console.error(`
  Error: Could not connect to NAS (SSH host alias: "nas").

  Add a "nas" entry to ~/.ssh/config:

    Host nas
      HostName <your-nas-ip>       # e.g. 192.168.1.100
      User <your-dsm-username>     # your Synology DSM login

  Optional — set up passwordless login:
    ssh-keygen -t ed25519          # generate a key pair if you don't have one
    ssh-copy-id nas                # copy your public key to the NAS

  Make sure SSH is enabled on the NAS:
    DSM → Control Panel → Terminal & SNMP → Enable SSH service
`);
  process.exit(1);
}

// ── 2. Pull latest image ─────────────────────────────────────────────────────
console.log(`\nPulling ${IMAGE}...`);
try {
  sshExec(`${DOCKER} pull ${IMAGE}`);
} catch {
  console.error(`
  Error: Failed to pull "${IMAGE}".

  Possible causes:
  - NAS has no internet access
  - Container Manager is not installed or the docker binary moved from ${DOCKER}
  - ghcr.io is temporarily unavailable
`);
  process.exit(1);
}

// ── 3. Recreate container with new image ─────────────────────────────────────
console.log(`\nRecreating ${CONTAINER}...`);
try {
  sshExec(`${DOCKER} stop ${CONTAINER}`);
  sshExec(`${DOCKER} rm ${CONTAINER}`);
  sshExec(
    `${DOCKER} run -d` +
      ` --name ${CONTAINER}` +
      ` -p 3000:3000` +
      ` --restart always` +
      ` --env-file ${ENV_FILE}` +
      ` ${IMAGE}`
  );
} catch {
  console.error(`
  Error: Failed to recreate container "${CONTAINER}".

  If this is a first-time setup, the container does not exist yet.
  See the "Deploying to Synology NAS" section in README.md for initial setup.

  Make sure ${ENV_FILE} exists on the NAS with:
    MONGODB_URI=mongodb://<nas-ip>:27017/between-us
    AUTH_SECRET=<your-secret>
    AUTH_TRUST_HOST=true
`);
  process.exit(1);
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log("\nDeployment complete.");
console.log("Open http://<nas-ip>:3000 to verify.\n");
