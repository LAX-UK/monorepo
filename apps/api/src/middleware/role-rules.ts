/**
 * Registry of routes that must run {@link createRequireBuyerRole} after {@link createRequireAuth}.
 * Keep in sync with route modules; used for docs and static checks, not auto-wiring.
 */
export const buyerRoleProtectedOperations = [
  { method: "POST" as const, route: "bids/", description: "POST /bids" },
  { method: "POST" as const, route: "payments/", description: "POST /payments (create pending)" },
  { method: "POST" as const, route: "submissions/", description: "POST /submissions (draft)" },
  { method: "POST" as const, route: "submissions/:id/submit", description: "submit for review" },
  { method: "POST" as const, route: "submissions/:id/withdraw", description: "withdraw" },
  {
    method: "PATCH" as const,
    route: "submissions/:id",
    description: "seller branch only; platform administrators skip via requireBuyerRoleUnlessAdministrator",
  },
  { method: "POST" as const, route: "uploads/image", description: "submission image upload" },
] as const;
