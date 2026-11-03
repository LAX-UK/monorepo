import type { Logger } from "pino";
import { S3MultipartArchiveStore, type SubjectExportArchiveStore } from "./archive-store.js";
import { ClientPairAuth, IdentityBearerAuth } from "./export-request-auth.js";
import { HttpIdentityExportClient, type SubjectExportPurgePort } from "./identity-export-client.js";
import { HttpProductExportSource } from "./product-export-source.js";
import { SubjectExportAssembler } from "./subject-export-assembler.js";
import type { SubjectExportConfig } from "./subject-export.config.js";

export type SubjectExportRuntime = {
  assembler: SubjectExportAssembler;
  ledger: SubjectExportPurgePort;
  store: SubjectExportArchiveStore;
};

/** Wires the real network and bucket to the job. Tests build the assembler from fakes instead. */
export function createSubjectExportRuntime(
  config: SubjectExportConfig,
  log: Logger,
): SubjectExportRuntime {
  const identityAuth = new IdentityBearerAuth({
    baseUrl: config.identityBaseUrl,
    clientId: config.identityClient.id,
    clientSecret: config.identityClient.secret,
  });
  const identity = new HttpIdentityExportClient({
    baseUrl: config.identityBaseUrl,
    auth: identityAuth,
  });
  const productAuth = new ClientPairAuth(config.productClient.id, config.productClient.secret);
  const store = S3MultipartArchiveStore.fromConfig(config.bucket);
  return {
    assembler: new SubjectExportAssembler({
      sources: {
        account: new HttpProductExportSource({
          product: "account",
          baseUrl: config.identityBaseUrl,
          auth: identityAuth,
        }),
        bid: new HttpProductExportSource({
          product: "bid",
          baseUrl: config.bidBaseUrl,
          auth: productAuth,
        }),
        shop: new HttpProductExportSource({
          product: "shop",
          baseUrl: config.shopBaseUrl,
          auth: productAuth,
        }),
      },
      progress: identity,
      store,
      log,
    }),
    ledger: identity,
    store,
  };
}
