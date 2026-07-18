import type { NextConfig } from "next";
import { execSync } from "child_process";

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
    NEXT_PUBLIC_BUILD_SHA: process.env.GIT_SHA ?? getGitSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
};

export default nextConfig;
