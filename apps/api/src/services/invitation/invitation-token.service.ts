import { createHash, randomBytes } from "node:crypto";

export class InvitationTokenService {
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("base64url");
    return { rawToken, tokenHash: this.hashToken(rawToken) };
  }

  addDays(from: Date, days: number): Date {
    const next = new Date(from);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }
}
