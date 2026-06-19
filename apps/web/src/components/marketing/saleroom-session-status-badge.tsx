import { DomainStatusBadge } from "@/components/ui/domain-status-badge";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { publicSaleroomSessionToRegistryStatus } from "@/lib/saleroom/saleroom-mobile-chrome";
import type { ComponentProps } from "react";

type Props = {
  status: PublicSaleroomSessionStatus["status"];
  size?: ComponentProps<typeof DomainStatusBadge>["size"];
  className?: string;
};

/** Public saleroom session status → registry `saleroomSession` badge. */
export function SaleroomSessionStatusBadge({ status, size = "sm", className }: Props) {
  return (
    <DomainStatusBadge
      domain="saleroomSession"
      status={publicSaleroomSessionToRegistryStatus(status)}
      size={size}
      {...(className ? { className } : {})}
    />
  );
}
