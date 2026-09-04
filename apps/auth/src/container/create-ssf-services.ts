import type { IdentityDatabase } from "@auction/identity-db";
import {
  DrizzleSsfDeliveryRepository,
  DrizzleSsfSourceEventReader,
  DrizzleSsfStreamRepository,
} from "../infrastructure/drizzle-ssf.adapters.js";
import { HttpSsfDispatcher } from "../infrastructure/http-ssf.dispatcher.js";
import type { IdentityJwtSigner } from "../infrastructure/identity-jwt-signer.ports.js";
import { JoseSsfSigner } from "../infrastructure/jose-ssf.signer.js";
import { SsfDeliveryWorker } from "../services/ssf-delivery.worker.js";
import { SsfEventMapper } from "../services/ssf-event.mapper.js";
import { SsfStreamService } from "../services/ssf-stream.service.js";

export function createSsfServices(options: {
  db: IdentityDatabase;
  issuer: string;
  identityJwtSigner: IdentityJwtSigner;
  environment: "development" | "test" | "production";
}) {
  const streams = new DrizzleSsfStreamRepository(options.db);
  const deliveries = new DrizzleSsfDeliveryRepository(options.db);
  const signer = new JoseSsfSigner(options.identityJwtSigner);
  return {
    streams: new SsfStreamService(streams, deliveries, signer, options.issuer, options.environment),
    delivery: new SsfDeliveryWorker(
      streams,
      new DrizzleSsfSourceEventReader(options.db),
      deliveries,
      new SsfEventMapper(),
      signer,
      new HttpSsfDispatcher(),
      options.issuer,
    ),
  };
}
