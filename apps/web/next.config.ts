import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { laxAccountOrigin } from "./src/lib/lax-account-url";
import { bidMediaImageHosts } from "./src/lib/media/bid-image-hosts";
import {
  LEGACY_DASHBOARD_REDIRECTS,
  identitySettingsRedirects,
} from "./src/lib/navigation/legacy-dashboard-redirects";
import { PRIVATE_SALES_REDIRECTS } from "./src/lib/navigation/private-sales-redirects";

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
  transpilePackages: [
    "@auction/api",
    "@auction/marketing-ui",
    "@auction/staff-ui",
    "@auction/types",
    "@auction/ui",
  ],
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
        source: "/verify-identity/:path*",
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
    // Tailwind breakpoints + 2x retina ceiling; omit 2048/3840 (no container that wide).
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 384],
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
      // LAX's own Spaces (production and test) and the public media address, never every Space.
      ...bidMediaImageHosts(process.env).map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/**",
      })),
      {
        protocol: "https",
        hostname: "media.lax.bid",
        pathname: "/**",
      },
      // Public-domain pictures used by the test environment's demo catalogue.
      {
        protocol: "https",
        hostname: "images.metmuseum.org",
        pathname: "/CRDImages/**",
      },
      {
        protocol: "https",
        hostname: "openaccess-cdn.clevelandart.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "test.lax.bid",
        pathname: "/demo/**",
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
      ...PRIVATE_SALES_REDIRECTS,
      ...LEGACY_DASHBOARD_REDIRECTS,
      ...identitySettingsRedirects(laxAccountOrigin()),
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

const finalConfig = hasSentry ? withSentryConfig(nextConfig, sentryBuildOptions) : nextConfig;

/**
 * `ANALYZE=true next build` writes the bundle report (`ANALYZE_MODE=json` for stats, otherwise
 * the interactive treemap). The analyzer is required only then, so a normal build and every
 * runtime never load it, and the config stays a plain object that tests can read.
 */
function withBundleAnalyzer(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") return config;
  const analyzer = createRequire(import.meta.url)("@next/bundle-analyzer") as (options: {
    enabled: boolean;
    analyzerMode: "json" | "static";
    openAnalyzer: boolean;
  }) => (config: NextConfig) => NextConfig;
  return analyzer({
    enabled: true,
    analyzerMode: process.env.ANALYZE_MODE === "json" ? "json" : "static",
    openAnalyzer: false,
  })(config);
}

export default withBundleAnalyzer(finalConfig);
