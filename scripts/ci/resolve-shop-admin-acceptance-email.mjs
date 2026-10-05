#!/usr/bin/env node
import { deriveAcceptanceEmail } from "./provision-identity-acceptance-users.mjs";

const explicit = process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL?.trim();
if (explicit) {
  process.stdout.write(explicit);
  process.exit(0);
}

const source = process.env.IDENTITY_ACCEPTANCE_EMAIL?.trim();
if (!source) {
  console.error("SHOP_ADMIN_ACCEPTANCE_EMAIL or IDENTITY_ACCEPTANCE_EMAIL is required");
  process.exit(1);
}

process.stdout.write(deriveAcceptanceEmail(source, "shop-admin", ""));
