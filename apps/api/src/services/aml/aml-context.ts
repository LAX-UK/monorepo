import type { IDomainEventSink } from "../domain-event-sink.js";
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
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner;
  policy: IAmlDecisionPolicy;
  screeningWriter: IWatchlistScreeningWriter;
  screeningReader: IWatchlistScreeningReader;
  holdStore: IAmlHoldStore;
  events: IDomainEventSink;
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
