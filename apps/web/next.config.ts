import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSentryOrg } from "@auction/observability";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { laxAccountOrigin } from "./src/lib/lax-account-url";
import { LAX_MEDIA_HOSTS } from "./src/lib/media/bid-image-hosts";
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
      // LAX's own Spaces (production and test), never every Space. Fixed in code on purpose.
      ...LAX_MEDIA_HOSTS.map((hostname) => ({
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
    optimizePackageImports: [
      "lucide-react",
      "@auction/ui",
      "@auction/ui/lax",
      "@auction/ui/time",
      "@auction/marketing-ui",
      "@auction/staff-ui",
    ],
  },
  webpack(config, { isServer, dev }) {
    if (!isServer && !dev) {
      addShellRoutesChunk(config);
      addToShellRoutesChunk(config, "shellSession", SHELL_SESSION_MODULES);
      addToShellRoutesChunk(config, "routeError", ROUTE_ERROR_MODULES);
      addToShellRoutesChunk(config, "kitPrimitives", KIT_PRIMITIVE_MODULES);
    }
    return config;
  },
  async redirects() {
    return [
      ...PRIVATE_SALES_REDIRECTS,
      ...LEGACY_DASHBOARD_REDIRECTS,
      ...identitySettingsRedirects(laxAccountOrigin()),
    ];
  },
};

/**
 * The route map and marketing chrome helpers are imported by the root layout, so every page
 * already loads them. Below webpack's 20 KB split threshold they were otherwise copied into the
 * root layout and again into several shared chunks a page loads alongside it (account pages
 * carried three copies of `client-routes.ts`). One forced chunk ships them once.
 */
const SHELL_ROUTES_MODULE =
  /[\\/](?:apps[\\/]web[\\/]src[\\/]lib[\\/](?:navigation[\\/]client-routes|marketing[\\/]chrome)\.ts|packages[\\/]branding[\\/]dist[\\/]marketing-chrome\.js)$/;

function addShellRoutesChunk(config: { optimization?: { splitChunks?: unknown } }) {
  const splitChunks = config.optimization?.splitChunks;
  if (!splitChunks || typeof splitChunks !== "object") return;
  const groups = (splitChunks as { cacheGroups?: Record<string, unknown> }).cacheGroups;
  if (!groups) return;
  groups.shellRoutes = {
    test: (module: { nameForCondition?: () => string | null }) =>
      SHELL_ROUTES_MODULE.test(module.nameForCondition?.() ?? ""),
    name: "shell-routes",
    chunks: "all",
    priority: 20,
    enforce: true,
  };
}

/**
 * The session, consent, theme and bottom-bar modules the root layout and every group layout share
 * (auth session provider, consent context, theme cookie, the bottom tab bar and its button). They
 * sat in one shared chunk only while some page also used all of them: just over webpack's 20 KB
 * split threshold. When the lot page stopped reading the session in the browser (CO-7: the page is
 * cached, the viewer comes from `/api/lots/:id/me`), that chunk fell apart and the modules were
 * copied into the root layout and again into the group layouts' chunk, about 6 KB more on every
 * public page. The forced shell chunk ships them once, whatever the pages use.
 */
const SHELL_SESSION_MODULES = [
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/]auth[\\/](?:auth-broadcast|auth-session-provider|use-app-session)\.tsx?$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/]data[\\/]http[\\/]auth-session\.client\.ts$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/]analytics[\\/](?:consent[\\/](?:categories|context)|registry|is-enabled|providers[\\/]gtm)\.tsx?$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/]preferences[\\/](?:apply-theme-dom|resolve-theme|theme-cookie)\.ts$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/](?:layout[\\/]bottom-chrome|ui[\\/]idle-preload|ui[\\/]run-when-idle)\.ts$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]components[\\/]layout[\\/]signed-in-only\.tsx$/,
  /[\\/]packages[\\/]marketing-ui[\\/]dist[\\/](?:marketing-bottom-tab-bar|account-display-name|bottom-bar[\\/](?:bottom-slot|bottom-tab-config|bottom-toast-offset|use-bottom-bar-visibility))\.js$/,
  /[\\/]packages[\\/]ui[\\/]dist[\\/]components[\\/]ui[\\/](?:button|button-disabled-reason)\.js$/,
];

/**
 * What the root error boundary renders (the route error page: copy, illustration, typography and
 * its error report), which every page loads with its frame. The group error boundaries render the
 * same page; they shared one chunk only while the button sat in it too, and with the button in
 * the shell chunk it fell under the split threshold and was copied into each boundary. The forced
 * shell chunk ships it once.
 */
const ROUTE_ERROR_MODULES = [
  /[\\/]apps[\\/]web[\\/]src[\\/]components[\\/]app[\\/]app-route-error\.tsx$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]components[\\/](?:illustrations[\\/]empty-state-illustrations|ui[\\/]typography|marketing[\\/]marketing-section-subheading)\.tsx$/,
  /[\\/]apps[\\/]web[\\/]src[\\/]lib[\\/](?:auth[\\/]session-lookup-error|observability[\\/]use-report-route-error|ui[\\/]empty-state-copy)\.ts$/,
  /[\\/]packages[\\/]ui[\\/]dist[\\/]components[\\/](?:typography|ui[\\/]lax-illustration)\.js$/,
];

/**
 * The kit primitives the root layout renders on every page: the LAX button and its variants, both
 * tooltips, the density context, the shared LAX class strings and `cn`. The account frame and the
 * account error boundaries render them too, and they shared one chunk with those only while the
 * rest of that chunk kept it over the 20 KB split threshold. When the overlay motion took dead
 * animation classes out of the kit, the chunks regrouped and these modules were copied into the
 * account frame and each error boundary again (3 to 9 KB more on account pages). The forced shell
 * chunk ships them once.
 */
const KIT_PRIMITIVE_MODULES = [
  /[\\/]packages[\\/]ui[\\/]dist[\\/]lax[\\/](?:button|button-variants|density|styles|tooltip)\.js$/,
  /[\\/]packages[\\/]ui[\\/]dist[\\/](?:components[\\/]ui[\\/]tooltip|lib[\\/]utils)\.js$/,
];

/**
 * Puts the modules `patterns` match in the forced `shell-routes` chunk too. One chunk, not one per
 * group: every page loads it with the root layout anyway, and each extra start-up chunk counts
 * against webpack's initial request limit, which (when a page reaches it) makes webpack copy
 * shared modules into the page's own chunk instead.
 */
function addToShellRoutesChunk(
  config: { optimization?: { splitChunks?: unknown } },
  key: string,
  patterns: RegExp[],
) {
  const splitChunks = config.optimization?.splitChunks;
  if (!splitChunks || typeof splitChunks !== "object") return;
  const groups = (splitChunks as { cacheGroups?: Record<string, unknown> }).cacheGroups;
  if (!groups) return;
  groups[key] = {
    test: (module: { nameForCondition?: () => string | null }) =>
      patterns.some((pattern) => pattern.test(module.nameForCondition?.() ?? "")),
    name: "shell-routes",
    chunks: "all",
    priority: 20,
    enforce: true,
  };
}

// Skip Sentry webpack plugin locally when no DSN is configured.
const hasSentry = Boolean(process.env.SENTRY_DSN_WEB || process.env.NEXT_PUBLIC_SENTRY_DSN_WEB);

const sentryBuildOptions = {
  org: resolveSentryOrg(),
  project: process.env.SENTRY_PROJECT ?? "lax-dev-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
  automaticVercelMonitors: false,
  webpack: {
    // Strip the SDK's debug logging from every bundle (`__SENTRY_DEBUG__ = false`); it only
    // prints with `debug: true`, which no build sets. Tracing code stays: the account and staff
    // areas keep browser tracing (see `src/lib/observability/sentry-client-options.ts`).
    treeshake: { removeDebugLogging: true },
  },
  // CI size-measurement builds (ROUTE_JS_SIZE_BUILD=1, see docs/engineering/route-js-budgets.md)
  // get one fixed release name instead of the commit SHA, so the release string inlined in the
  // client bundle is the same for a PR and its base. Deploy builds never set the flag.
  ...(process.env.ROUTE_JS_SIZE_BUILD === "1" ? { release: { name: "route-js-size-build" } } : {}),
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
