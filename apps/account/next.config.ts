import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
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

const hasSentry = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN_ACCOUNT);

const sentryBuildOptions = {
  org: resolveSentryOrg(),
  project: process.env.SENTRY_PROJECT ?? "lax-dev-account",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
  automaticVercelMonitors: false,
  // Strip the SDK's debug logging from every bundle; it only prints with `debug: true`.
  webpack: { treeshake: { removeDebugLogging: true } },
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
};

export default hasSentry ? withSentryConfig(nextConfig, sentryBuildOptions) : nextConfig;
