/**
 * Optional CI check: set CHECK_EMAIL_ASSETS=true (with CI=true) to verify hosted email PNGs return 200.
 * Uses EMAIL_ASSETS_BASE_URL or defaults to https://lax.bid.
 */

const base = (process.env.EMAIL_ASSETS_BASE_URL || "https://lax.bid").replace(/\/$/, "");

async function headOk(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (res.ok) return true;
  const get = await fetch(url, { method: "GET", redirect: "follow" });
  return get.ok;
}

async function main() {
  if (process.env.CI !== "true" || process.env.CHECK_EMAIL_ASSETS !== "true") {
    process.exit(0);
  }
  const urls = [`${base}/email/lax-logo.png`, `${base}/email/lax-logo@2x.png`];
  for (const url of urls) {
    const ok = await headOk(url);
    if (!ok) {
      console.error(`email asset check failed: ${url}`);
      process.exit(1);
    }
  }
  console.log("email asset check ok:", urls.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
