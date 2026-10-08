#!/usr/bin/env node
import { appendFileSync } from "node:fs";

const URL_COMPONENT = {
  "https://test-api.lax.bid/health/ready": "api",
  "https://test.lax.bid/api/health/ready": "web",
  "https://test-auth.lax.bid/health/ready": "auth",
  "https://test-shop.lax.bid/health/ready": "shop",
  "https://test-shop-admin.lax.bid/health/ready": "shop-admin",
};

const SHOP_STACK_COMPONENTS = ["shop", "shop-api", "shop-identity"];

export function shopStackPinned(tagMap, targetSha) {
  return SHOP_STACK_COMPONENTS.some((component) => tagMap[component] === targetSha);
}

export function buildReadinessUrls({ tagMap, targetSha }) {
  const urls = new Set();
  for (const [url, component] of Object.entries(URL_COMPONENT)) {
    if (tagMap[component] === targetSha) {
      urls.add(url);
    }
  }
  if (shopStackPinned(tagMap, targetSha)) {
    urls.add("https://test-shop.lax.bid/health/ready");
  }
  if (tagMap["shop-admin"] === targetSha) {
    urls.add("https://test-shop-admin.lax.bid/health/ready");
  }
  return [...urls];
}

export function buildExpectedReleases({ tagMap, targetSha, readinessUrls }) {
  const urls = readinessUrls ?? buildReadinessUrls({ tagMap, targetSha });
  /** @type {Record<string, string>} */
  const expected = {};
  for (const url of urls) {
    const component = URL_COMPONENT[url];
    if (component && tagMap[component] === targetSha) {
      expected[url] = targetSha;
      continue;
    }
    if (url === "https://test-shop.lax.bid/health/ready" && shopStackPinned(tagMap, targetSha)) {
      expected[url] = targetSha;
      continue;
    }
    if (
      url === "https://test-shop-admin.lax.bid/health/ready" &&
      tagMap["shop-admin"] === targetSha
    ) {
      expected[url] = targetSha;
    }
  }
  return expected;
}

function main() {
  const targetSha = process.env.TARGET_SHA ?? "";
  const tagMap = JSON.parse(process.env.TAG_MAP ?? "{}");
  const mode = process.env.MODE ?? "expected-releases";
  if (mode === "readiness-urls") {
    const urls = buildReadinessUrls({ tagMap, targetSha });
    const json = JSON.stringify(urls);
    process.stdout.write(`${json}\n`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `urls=${json}\n`);
    }
    return;
  }
  const readinessUrls = process.env.READINESS_URLS
    ? JSON.parse(process.env.READINESS_URLS)
    : buildReadinessUrls({ tagMap, targetSha });
  const expected = buildExpectedReleases({ tagMap, targetSha, readinessUrls });
  const json = JSON.stringify(expected);
  process.stdout.write(`${json}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `json<<__EXPECTED_RELEASES__\n${json}\n__EXPECTED_RELEASES__\n`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
