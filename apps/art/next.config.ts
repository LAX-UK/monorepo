import path from "node:path";
import { fileURLToPath } from "node:url";
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
    remotePatterns: imageRemoteHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  // UK spelling; the US routes stay reachable for bookmarks and old emails.
  async redirects() {
    return [
      { source: "/account/favorites", destination: "/account/favourites", permanent: true },
      { source: "/account/inquiries", destination: "/account/enquiries", permanent: true },
    ];
  },
};

export default nextConfig;
