import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ development: process.env.NODE_ENV === "development" }),
      },
    ];
  },
};

export default nextConfig;
