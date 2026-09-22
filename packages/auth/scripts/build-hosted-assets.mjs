#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist/hosted-auth/assets");
const src = join(root, "src/hosted-auth/browser");

mkdirSync(outdir, { recursive: true });

const entries = {
  "hosted-auth-runtime": join(src, "runtime.entry.ts"),
  "hosted-login": join(src, "login.entry.ts"),
  "hosted-sign-up": join(src, "sign-up.entry.ts"),
  "hosted-forgot-password": join(src, "forgot-password.entry.ts"),
  "hosted-reset-password": join(src, "reset-password.entry.ts"),
  "hosted-two-factor": join(src, "two-factor.entry.ts"),
  "hosted-verify-email": join(src, "verify-email.entry.ts"),
  "hosted-resend-verification": join(src, "resend-verification.entry.ts"),
  "hosted-magic-link": join(src, "magic-link.entry.ts"),
  "hosted-phone": join(src, "phone.entry.ts"),
  "oidc-consent": join(src, "consent.entry.ts"),
};

await esbuild.build({
  entryPoints: entries,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  outdir,
  entryNames: "[name]",
  absWorkingDir: root,
  logLevel: "info",
  legalComments: "none",
});
