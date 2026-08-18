import { verifyIdentityToken } from "@auction/identity-contracts/verify";

export type WsResourcePrincipal = {
  subject: string;
  sid?: string;
  role?: string;
  staffRole?: string;
};

async function verifyBidReadToken(
  input: {
    token: string;
    issuer: string;
    jwksUrl: string;
  },
  audience: "lax-ws" | "lax-bid-api",
): Promise<WsResourcePrincipal | null> {
  const verified = await verifyIdentityToken({ ...input, audience });
  if (!verified) return null;
  const scopes =
    typeof verified.payload.scope === "string"
      ? verified.payload.scope.split(/\s+/).filter(Boolean)
      : [];
  if (!scopes.includes("bid.read")) return null;
  return {
    subject: verified.subject,
    ...(typeof verified.payload.sid === "string" ? { sid: verified.payload.sid } : {}),
    ...(typeof verified.payload.role === "string" ? { role: verified.payload.role } : {}),
    ...(typeof verified.payload.staff_role === "string"
      ? { staffRole: verified.payload.staff_role }
      : {}),
  };
}

/** Verifies a direct WS resource token; Bid API tokens are not valid WS credentials. */
export function verifyWsResourceToken(input: {
  token: string;
  issuer: string;
  jwksUrl: string;
}): Promise<WsResourcePrincipal | null> {
  return verifyBidReadToken(input, "lax-ws");
}

/** Verifies the separate API credential used for fresh privilege resolution. */
export function verifyBidApiPrivilegeToken(input: {
  token: string;
  issuer: string;
  jwksUrl: string;
}): Promise<WsResourcePrincipal | null> {
  return verifyBidReadToken(input, "lax-bid-api");
}
