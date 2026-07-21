#!/usr/bin/env node

// Deploy the between-us image to the NAS via SSH + Container Manager (Docker).
//
// Usage:
//   node deploy.mjs [container-name] [options]
//
// Arguments:
//   container-name   Name for the container (default: "between-us")
//
// Options:
//   -n, --nas <host>   SSH host alias, IP, or FQDN of the NAS (default: "nas")
//   -f, --force        Redeploy even if the pulled image is unchanged
//   -h, --help         Show this help and exit
//
// Examples:
//   node deploy.mjs                       # deploy, skipping if the image is unchanged
//   node deploy.mjs --force               # force a redeploy of the same image
//   node deploy.mjs staging -f            # force-deploy under the name "staging"
//   node deploy.mjs --nas 192.168.1.100   # deploy to a specific host

import { execSync } from "node:child_process";

const IMAGE = "ghcr.io/chrismancini/between-us:latest";
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Deploy the between-us image to the NAS.

Usage:
  node deploy.mjs [container-name] [options]

Arguments:
  container-name   Name for the container (default: "between-us")

Options:
  -n, --nas <host>   SSH host alias, IP, or FQDN of the NAS (default: "nas")
  -f, --force        Redeploy even if the pulled image is unchanged
  -h, --help         Show this help and exit

Examples:
  node deploy.mjs                       Deploy, skipping if the image is unchanged
  node deploy.mjs --force               Force a redeploy of the same image
  node deploy.mjs staging -f            Force-deploy under the name "staging"
  node deploy.mjs --nas 192.168.1.100   Deploy to a specific host
`);
  process.exit(0);
}

const FORCE = args.includes("--force") || args.includes("-f");

// Read a value flag in either "--nas host" or "--nas=host" form, consuming its
// token(s) so they aren't mistaken for the container-name positional.
function takeFlag(names) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    for (const name of names) {
      if (arg === name) {
        const value = args[i + 1];
        args.splice(i, 2);
        return value;
      }
      if (arg.startsWith(`${name}=`)) {
        args.splice(i, 1);
        return arg.slice(name.length + 1);
      }
    }
  }
  return undefined;
}

const NAS = takeFlag(["--nas", "-n"]) ?? "nas";
const CONTAINER = args.find((a) => !a.startsWith("-")) ?? "between-us";
const DOCKER = "sudo /volume1/@appstore/ContainerManager/usr/bin/docker";
const ENV_FILE = "/volume1/docker/between-us/.env";

function sshExec(command, opts = {}) {
  return execSync(`ssh ${NAS} "${command}"`, { stdio: "inherit", ...opts });
}

// Run a command over SSH and return its trimmed stdout (empty string on failure).
function sshCapture(command) {
  try {
    return execSync(`ssh ${NAS} "${command}"`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Resolve the local image ID on the NAS, or "" if the image isn't present.
function imageId() {
  return sshCapture(`${DOCKER} image inspect --format '{{.Id}}' ${IMAGE} 2>/dev/null`);
}

// ── 1. Verify SSH connectivity ───────────────────────────────────────────────
process.stdout.write("Connecting to NAS... ");
try {
  sshExec("echo ok", { stdio: "pipe" });
  console.log("connected.");
} catch {
  console.log("");
  console.error(`
  Error: Could not connect to NAS (SSH host: "${NAS}").

  Pass a different host with --nas <alias|ip|fqdn>, or add a "${NAS}" entry
  to ~/.ssh/config:

    Host ${NAS}
      HostName <your-nas-ip>       # e.g. 192.168.1.100
      User <your-dsm-username>     # your Synology DSM login

  Optional — set up passwordless login:
    ssh-keygen -t ed25519          # generate a key pair if you don't have one
    ssh-copy-id ${NAS}             # copy your public key to the NAS

  Make sure SSH is enabled on the NAS:
    DSM → Control Panel → Terminal & SNMP → Enable SSH service
`);
  process.exit(1);
}

// ── 2. Pull latest image ─────────────────────────────────────────────────────
const previousId = imageId();

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

// ── 2b. Skip the deploy when the pulled image is identical ───────────────────
const currentId = imageId();

if (!FORCE && previousId && currentId && previousId === currentId) {
  console.log(`\nImage unchanged (${currentId.slice(0, 19)}). Nothing to deploy.`);
  console.log("Pass --force to redeploy anyway.\n");
  process.exit(0);
}

// ── 3. Remove existing container (if any) and start a fresh one ─────────────
console.log(`\nDeploying ${CONTAINER}...`);
try {
  sshExec(`${DOCKER} stop ${CONTAINER} 2>/dev/null || true`, { stdio: "pipe" });
  sshExec(`${DOCKER} rm ${CONTAINER} 2>/dev/null || true`, { stdio: "pipe" });
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
  Error: Failed to start container "${CONTAINER}".

  Make sure ${ENV_FILE} exists on the NAS with:
    MONGODB_URI=mongodb://<nas-ip>:27017/between-us
    AUTH_SECRET=<your-secret>
    AUTH_TRUST_HOST=true
`);
  process.exit(1);
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log("\nDeployment complete.");
console.log(`Open http://${NAS}:3000 to verify.`);
console.log(
  `(If "${NAS}" is an SSH alias that doesn't resolve in a browser, use the NAS IP or FQDN instead.)\n`
);
