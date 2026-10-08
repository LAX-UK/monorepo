#!/usr/bin/env node
import { appendFileSync } from "node:fs";

const URL_COMPONENT = {
  "https://test-api.lax.bid/health/ready": "api",
  "https://test.lax.bid/api/health/ready": "web",
  "https://test-auth.lax.bid/health/ready": "auth",
  "https://test-shop.lax.bid/health/ready": "shop",
};

export function buildExpectedReleases({ tagMap, targetSha, readinessUrls }) {
  const urls = readinessUrls ?? Object.keys(URL_COMPONENT);
  /** @type {Record<string, string>} */
  const expected = {};
  for (const url of urls) {
    const component = URL_COMPONENT[url];
    if (!component) continue;
    if (tagMap[component] === targetSha) {
      expected[url] = targetSha;
    }
  }
  return expected;
}

function main() {
  const targetSha = process.env.TARGET_SHA ?? "";
  const tagMap = JSON.parse(process.env.TAG_MAP ?? "{}");
  const readinessUrls = process.env.READINESS_URLS
    ? JSON.parse(process.env.READINESS_URLS)
    : undefined;
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
