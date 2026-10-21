import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@auction/ui", "@auction/marketing-ui"],
  // Account only needs a few icons from the marketing-ui barrel; without this the whole
  // barrel (header, carousel, smooth scroll) lands in every page's client bundle.
  experimental: { optimizePackageImports: ["@auction/marketing-ui"] },
};

export default nextConfig;
