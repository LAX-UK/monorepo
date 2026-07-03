import type {
  IAmlMonitoringService,
  IScreeningProvider,
  IWatchlistScreeningWriter,
} from "./ports.js";

export type AmlMonitoringContext = {
  provider: IScreeningProvider;
  screeningWriter: IWatchlistScreeningWriter;
};

export function createAmlMonitoringContext(input: AmlMonitoringContext): AmlMonitoringContext {
  return input;
}

/** Enrol verified sessions into ongoing watchlist monitoring (best-effort). */
export class AmlMonitoringService implements IAmlMonitoringService {
  constructor(private readonly ctx: AmlMonitoringContext) {}

  isConfigured(): boolean {
    return this.ctx.provider.isConfigured();
  }

  async enableMonitoring(providerSessionId: string): Promise<void> {
    if (!this.ctx.provider.isConfigured()) return;
    await this.ctx.provider.enableOngoingMonitoring(providerSessionId);
    await this.ctx.screeningWriter.setMonitorStatus(providerSessionId, "monitored");
  }

  async tryEnableMonitoring(providerSessionId: string): Promise<void> {
    try {
      await this.enableMonitoring(providerSessionId);
    } catch {
      // Monitoring is non-critical to the screening decision.
    }
  }
}
