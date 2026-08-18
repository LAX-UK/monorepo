import { createHash } from "node:crypto";
import {
  OidcClientKind,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { eq, notInArray } from "drizzle-orm";
import { closeDb, createDb } from "../client.js";
import { oauthApplication } from "../schema/index.js";

function secretEnvName(clientId: RegisteredOidcClientId): string {
  return `OIDC_CLIENT_SECRET_${clientId.replaceAll("-", "_").toUpperCase()}`;
}

export function hashOidcClientSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url");
}

export function buildOidcClientMetadata(clientId: RegisteredOidcClientId): string {
  const client = REGISTERED_OIDC_CLIENTS[clientId];
  return JSON.stringify({
    allowedScopes: client.allowedScopes,
    allowedResources: client.allowedResources,
    pkceRequired: client.pkceRequired,
    postLogoutRedirectUris: client.postLogoutRedirectUris,
    backchannelLogoutUri: client.backchannelLogoutUri,
    backchannelLogoutSessionRequired: client.backchannelLogoutSessionRequired,
  });
}

export function assertBackchannelLogoutUriAllowed(
  uri: string | undefined,
  production: boolean,
): void {
  if (!uri) return;
  const parsed = new URL(uri);
  if (parsed.protocol === "https:") return;
  if (!production && parsed.protocol === "http:" && parsed.hostname === "localhost") return;
  throw new Error(
    "OIDC back-channel logout URI must use HTTPS (localhost HTTP is development-only)",
  );
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_AUTH ?? process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_AUTH or DATABASE_URL_OWNER is required");

  const db = createDb(url);
  try {
    const selectedIds = process.env.OIDC_CLIENT_IDS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === "production" && selectedIds?.length) {
      throw new Error("OIDC_CLIENT_IDS is not allowed in production; configure the full registry");
    }
    const clients = Object.values(REGISTERED_OIDC_CLIENTS).filter(
      (client) => !selectedIds?.length || selectedIds.includes(client.clientId),
    );
    for (const client of clients) {
      assertBackchannelLogoutUriAllowed(
        client.backchannelLogoutUri,
        process.env.NODE_ENV === "production",
      );
      const isConfidential = client.kind === OidcClientKind.Confidential;
      const envName = secretEnvName(client.clientId);
      const rawSecret = process.env[envName]?.trim();
      if (isConfidential && !rawSecret) {
        throw new Error(`${envName} is required for confidential client ${client.clientId}`);
      }

      const now = new Date();
      const values = {
        id: client.clientId,
        clientId: client.clientId,
        name: client.displayName,
        clientSecret: rawSecret ? hashOidcClientSecret(rawSecret) : null,
        redirectUrls: client.redirectUris.join(","),
        type: isConfidential ? "web" : "public",
        disabled: false,
        backchannelLogoutUri: client.backchannelLogoutUri ?? null,
        backchannelLogoutSessionRequired: client.backchannelLogoutSessionRequired ?? false,
        metadata: buildOidcClientMetadata(client.clientId),
        createdAt: now,
        updatedAt: now,
      };

      const [existing] = await db
        .select({ id: oauthApplication.id })
        .from(oauthApplication)
        .where(eq(oauthApplication.clientId, client.clientId))
        .limit(1);

      if (existing) {
        await db
          .update(oauthApplication)
          .set({
            name: values.name,
            clientSecret: values.clientSecret,
            redirectUrls: values.redirectUrls,
            type: values.type,
            disabled: values.disabled,
            backchannelLogoutUri: values.backchannelLogoutUri,
            backchannelLogoutSessionRequired: values.backchannelLogoutSessionRequired,
            metadata: values.metadata,
            updatedAt: now,
          })
          .where(eq(oauthApplication.id, existing.id));
      } else {
        await db.insert(oauthApplication).values(values);
      }

      console.log(`configured OIDC client ${client.clientId} (${client.kind})`);
    }

    // A full-registry run is authoritative. Disable orphaned clients instead of
    // deleting them so token/audit history remains intact. Scoped runs must not
    // affect clients outside OIDC_CLIENT_IDS.
    if (!selectedIds?.length) {
      const registeredIds = Object.values(REGISTERED_OIDC_CLIENTS).map((client) => client.clientId);
      const orphaned = await db
        .select({ clientId: oauthApplication.clientId })
        .from(oauthApplication)
        .where(notInArray(oauthApplication.clientId, registeredIds));
      if (orphaned.length > 0 && process.env.OIDC_DISABLE_UNREGISTERED !== "true") {
        throw new Error(
          `Unregistered OIDC clients require explicit retirement: ${orphaned
            .map((row) => row.clientId)
            .join(", ")}. Re-run with OIDC_DISABLE_UNREGISTERED=true after review.`,
        );
      }
      if (orphaned.length > 0) {
        await db
          .update(oauthApplication)
          .set({ disabled: true, updatedAt: new Date() })
          .where(notInArray(oauthApplication.clientId, registeredIds));
      }
    }
  } finally {
    await closeDb(db);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
