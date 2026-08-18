import { type JWK, SignJWT, importJWK } from "jose";
import type { SsfSigner } from "../services/ssf.ports.js";

type SigningJwk = { id: string; privateKey: string; alg?: string | undefined };

export class JoseSsfSigner implements SsfSigner {
  constructor(private readonly jwks: { getActiveSigningJwk(): Promise<SigningJwk | null> }) {}

  async sign(input: Parameters<SsfSigner["sign"]>[0]) {
    const signingKey = await this.jwks.getActiveSigningJwk();
    if (!signingKey || (signingKey.alg ?? "RS256") !== "RS256") {
      throw new Error("active_rs256_signing_key_required");
    }
    const key = await importJWK(JSON.parse(signingKey.privateKey) as JWK, "RS256");
    const token = await new SignJWT({
      ...(input.txn ? { txn: input.txn } : {}),
      sub_id: { format: "opaque", id: input.subjectId },
      events: { [input.eventType]: input.event },
    })
      .setProtectedHeader({ alg: "RS256", kid: signingKey.id, typ: "secevent+jwt" })
      .setIssuer(input.issuer)
      .setAudience(input.audience)
      .setIssuedAt(input.issuedAt)
      .setJti(input.jti)
      .sign(key);
    return { token, signingKid: signingKey.id };
  }
}
