import type { Database } from "@auction/db";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import { AmlMonitoringService, createAmlMonitoringContext } from "./aml-monitoring.service.js";
import type {
  IAmlDecisionPolicy,
  IAmlHoldStore,
  IScreeningProvider,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
} from "./ports.js";

/** Shared AML service dependencies for ingest and review. */
export type AmlServiceDeps = {
  db: Database;
  policy: IAmlDecisionPolicy;
  screeningWriter: IWatchlistScreeningWriter;
  screeningReader: IWatchlistScreeningReader;
  holdStore: IAmlHoldStore;
  events: DomainEventPublisher;
  monitoring: AmlMonitoringService;
};

export function createAmlServiceDeps(
  input: Omit<AmlServiceDeps, "monitoring"> & { provider: IScreeningProvider },
): AmlServiceDeps {
  const monitoring = new AmlMonitoringService(
    createAmlMonitoringContext({
      provider: input.provider,
      screeningWriter: input.screeningWriter,
    }),
  );
  return { ...input, monitoring };
}
