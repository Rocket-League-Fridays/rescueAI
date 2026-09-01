import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent /Hackathon has its own lockfile; without this Next traces from there
  // and Tailwind never loads this app's theme (bg-surface-base, etc.).
  outputFileTracingRoot: frontendRoot,
};

export default nextConfig;
