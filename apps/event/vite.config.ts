import { defineConfig } from "vite";

/** API routes only — static invitation art lives under public/events/. */
function isOnsiteEventApiRequest(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return (
    path === "/events" ||
    /^\/events\/pass\/[^/]+$/.test(path) ||
    /^\/events\/[^/]+\/(config|lookup|rsvp)(?:\?.*)?$/.test(url) ||
    /^\/events\/[^/]+\/pass\/[^/]+(?:\/qr\.svg)?(?:\?.*)?$/.test(url)
  );
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    port: 3003,
    strictPort: true,
    proxy: {
      "/events": {
        target: "http://localhost:3001",
        changeOrigin: true,
        bypass(req) {
          const path = req.url ?? "";
          if (isOnsiteEventApiRequest(path)) return;
          const filePath = path.split("?")[0] ?? path;
          return filePath;
        },
      },
      "/sales": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
