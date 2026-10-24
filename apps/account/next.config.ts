import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { parseMediaOrigins } from "./src/lib/media-origins";
import { STRIPE_CONNECT_PATH, securityHeaders } from "./src/lib/security-headers";

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
    const base = {
      development: process.env.NODE_ENV === "development",
      // Evaluated at build time for the standalone output, so the media variables must be set then.
      imageOrigins: parseMediaOrigins(),
    };
    return [
      { source: "/:path*", headers: securityHeaders(base) },
      // Listed last so its policy replaces the one above on this page alone.
      {
        source: STRIPE_CONNECT_PATH,
        headers: securityHeaders({ ...base, stripeConnect: true }),
      },
    ];
  },
};

export default nextConfig;
