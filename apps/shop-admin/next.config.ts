import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@auction/ui", "@auction/staff-ui"],
  async redirects() {
    // The inbox replaced the read-only list; keep bookmarks and emailed links working.
    return [{ source: "/general-enquiries", destination: "/enquiries", permanent: true }];
  },
};

const hasSentry = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN);

const sentryBuildOptions = {
  org: resolveSentryOrg(),
  project: process.env.SENTRY_PROJECT ?? "lax-dev-admin",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
  automaticVercelMonitors: false,
  // Strip the SDK's debug logging from every bundle; it only prints with `debug: true`.
  webpack: { treeshake: { removeDebugLogging: true } },
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
};

export default hasSentry ? withSentryConfig(nextConfig, sentryBuildOptions) : nextConfig;
