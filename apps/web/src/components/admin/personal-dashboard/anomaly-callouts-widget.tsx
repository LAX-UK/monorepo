import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";

type Props = {
  anomalies: readonly AdminAnomaly[];
};

export function AnomalyCalloutsWidget({ anomalies }: Props) {
  return <AdminAnomalyBanner anomalies={anomalies} storageKey="home" className="mb-0" />;
}
