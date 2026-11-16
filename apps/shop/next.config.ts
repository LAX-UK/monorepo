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
  webpack(config, { isServer, dev }) {
    if (!isServer && !dev) addEmptyStateChunk(config);
    return config;
  },
  async redirects() {
    return [
      { source: "/contact", destination: "/help#contact", permanent: false },
      { source: "/shipping", destination: "/delivery", permanent: false },
    ];
  },
  images: {
    // Uploads get a fresh UUID key and seed assets never change, so a cached optimisation stays valid.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: imageRemoteHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

/**
 * The shared kit empty state, its drawings and the status actions. The root layout already loads
 * them (marketing-ui's alert-link page renders the kit state) and every route `error.tsx`
 * renders them too. Each boundary is its own entry, and below webpack's 20 KB split threshold the
 * modules were copied into the layout chunk and again into each boundary's chunk. One forced chunk
 * ships them once (the same fix as Bid's `shell-routes` chunk in apps/web/next.config.ts).
 * Shop's own boundary pieces (the error state and the status actions) go with them.
 */
const EMPTY_STATE_MODULES = [
  /[\\/]packages[\\/]ui[\\/](?:dist|src)[\\/]lax[\\/](?:empty-state|empty-state-base)\.(?:js|tsx)$/,
  /[\\/]packages[\\/]ui[\\/](?:dist|src)[\\/]components[\\/]ui[\\/](?:lax-illustration|lax-drawings|lax-drawing-svg)\.(?:js|tsx?)$/,
  /[\\/]packages[\\/]marketing-ui[\\/](?:dist|src)[\\/]marketing-status-state\.(?:js|tsx)$/,
  // What they import that every page already loads with its frame: `cn` and the focus ring.
  /[\\/]packages[\\/]ui[\\/](?:dist|src)[\\/]lib[\\/]utils\.(?:js|ts)$/,
  /[\\/]packages[\\/]branding[\\/](?:dist|src)[\\/]marketing-chrome\.(?:js|ts)$/,
  /[\\/]apps[\\/]shop[\\/]src[\\/]components[\\/](?:shop-route-error-state|shop-status-state-actions)\.tsx$/,
];

function addEmptyStateChunk(config: { optimization?: { splitChunks?: unknown } }) {
  const splitChunks = config.optimization?.splitChunks;
  if (!splitChunks || typeof splitChunks !== "object") return;
  const groups = (splitChunks as { cacheGroups?: Record<string, unknown> }).cacheGroups;
  if (!groups) return;
  groups.laxEmptyState = {
    test: (module: { nameForCondition?: () => string | null }) =>
      EMPTY_STATE_MODULES.some((pattern) => pattern.test(module.nameForCondition?.() ?? "")),
    name: "lax-empty-state",
    chunks: "all",
    priority: 20,
    enforce: true,
  };
}

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
