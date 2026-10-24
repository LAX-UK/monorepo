import path from "node:path";
import { fileURLToPath } from "node:url";
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

export default nextConfig;
