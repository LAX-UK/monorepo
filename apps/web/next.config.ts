import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Turnstile config-drift guard: when captcha is declared required for this deployment,
// a missing site key would render no widget while the API rejects every signup. Fail
// the build instead of shipping a silently broken registration flow.
if (
  process.env.NEXT_PUBLIC_TURNSTILE_REQUIRED === "1" &&
  !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
) {
  throw new Error(
    "NEXT_PUBLIC_TURNSTILE_REQUIRED=1 but NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset — " +
      "captcha widgets cannot render and the API will reject all sign-ups. " +
      "Set the site key (or unset NEXT_PUBLIC_TURNSTILE_REQUIRED).",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@auction/api", "@auction/types", "@auction/ui"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/dashboard/verify-identity/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self)",
          },
        ],
      },
      {
        source: "/onboarding/organisation/step/identity",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self)",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.digitaloceanspaces.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lax-media.lon1.cdn.digitaloceanspaces.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.lax.bid",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "test-media.lax.bid",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@auction/ui"],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/artist-follow",
        destination: "/dashboard/watchlist?section=artists",
        permanent: false,
      },
    ];
  },
};

// Skip Sentry webpack plugin locally when no DSN is configured.
const hasSentry = Boolean(process.env.SENTRY_DSN_WEB || process.env.NEXT_PUBLIC_SENTRY_DSN_WEB);

const sentryBuildOptions = {
  org: resolveSentryOrg(),
  project: process.env.SENTRY_PROJECT ?? "lax-dev-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
  disableLogger: true,
  automaticVercelMonitors: false,
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
};

export default hasSentry ? withSentryConfig(nextConfig, sentryBuildOptions) : nextConfig;
