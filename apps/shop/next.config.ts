import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Image hosts are fixed at build time; shop-api serves uploaded media from the lax-media CDN.
const MEDIA_CDN_HOST = "lax-media.lon1.cdn.digitaloceanspaces.com";
const imageRemoteHosts = [
  ...new Set([
    MEDIA_CDN_HOST,
    ...(process.env.SHOP_IMAGE_REMOTE_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@auction/ui", "@auction/marketing-ui", "@auction/shop-portal"],
  images: {
    // Uploads get a fresh UUID key and seed assets never change, so a cached optimisation stays valid.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: imageRemoteHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

const hasSentry = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN_SHOP);

const sentryBuildOptions = {
  org: resolveSentryOrg(),
  project: process.env.SENTRY_PROJECT ?? "lax-dev-shop",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
  disableLogger: true,
  automaticVercelMonitors: false,
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
};

export default hasSentry ? withSentryConfig(nextConfig, sentryBuildOptions) : nextConfig;
