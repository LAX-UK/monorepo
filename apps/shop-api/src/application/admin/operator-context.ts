export type ShopOperatorContext = {
  reason: string;
  host: string;
  osUser?: string;
  approvedBy?: string;
};

export function operatorContextAuditFields(
  context: ShopOperatorContext | undefined,
): Record<string, unknown> {
  if (!context) {
    return {};
  }
  return {
    operatorContext: {
      reason: context.reason,
      host: context.host,
      ...(context.osUser ? { osUser: context.osUser } : {}),
      ...(context.approvedBy ? { approvedBy: context.approvedBy } : {}),
    },
  };
}
