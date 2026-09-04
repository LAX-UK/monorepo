import type { SsfSigner } from "../services/ssf.ports.js";
import type { IdentityJwtSigner } from "./identity-jwt-signer.ports.js";

export class JoseSsfSigner implements SsfSigner {
  constructor(private readonly signer: IdentityJwtSigner) {}

  async sign(input: Parameters<SsfSigner["sign"]>[0]) {
    const { token, kid } = await this.signer.sign({
      typ: "secevent+jwt",
      issuer: input.issuer,
      audience: input.audience,
      issuedAt: input.issuedAt,
      jwtId: input.jti,
      claims: {
        ...(input.txn ? { txn: input.txn } : {}),
        sub_id: { format: "opaque", id: input.subjectId },
        events: { [input.eventType]: input.event },
      },
    });
    return { token, signingKid: kid };
  }
}
