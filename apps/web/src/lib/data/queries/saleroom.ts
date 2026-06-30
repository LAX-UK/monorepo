import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { queryOptions } from "@tanstack/react-query";

export const saleroomKeys = {
  all: ["saleroom"] as const,
  status: (saleId: string) => [...saleroomKeys.all, "status", saleId] as const,
};

export function saleroomStatusQueryOptions(saleId: string) {
  return queryOptions({
    queryKey: saleroomKeys.status(saleId),
    queryFn: async (): Promise<PublicSaleroomSessionStatus | null> => fetchSaleroomStatus(saleId),
    enabled: Boolean(saleId),
  });
}
