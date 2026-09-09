import { BullMQOtel } from "bullmq-otel";

let telemetry: BullMQOtel | undefined;

/** Shared BullMQ OpenTelemetry adapter (no-op when disabled). */
export function getBullMqTelemetry(serviceName: string): BullMQOtel | undefined {
  if (process.env.BULLMQ_OTEL_ENABLED === "false") return undefined;
  if (!telemetry) {
    telemetry = new BullMQOtel({
      tracerName: serviceName,
      meterName: serviceName,
      enableMetrics: true,
    });
  }
  return telemetry;
}
