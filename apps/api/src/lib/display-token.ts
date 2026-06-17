import { createHash, randomBytes, randomInt } from "node:crypto";
import type {
  IDisplayTokenIssuer,
  IssuedDisplayToken,
} from "../services/interfaces/display-token-issuer.js";

const DEVICE_CODE_BYTES = 32;
const DISPLAY_TOKEN_BYTES = 32;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;

export class DisplayTokenIssuer implements IDisplayTokenIssuer {
  issueDeviceCode(): IssuedDisplayToken {
    const plainToken = randomBytes(DEVICE_CODE_BYTES).toString("base64url");
    return { plainToken, tokenHash: this.hash(plainToken) };
  }

  issueDisplayToken(): IssuedDisplayToken {
    const plainToken = randomBytes(DISPLAY_TOKEN_BYTES).toString("base64url");
    return { plainToken, tokenHash: this.hash(plainToken) };
  }

  hash(plainToken: string): string {
    return createHash("sha256").update(plainToken, "utf8").digest("hex");
  }

  issueUserCode(): string {
    let code = "";
    for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
      code += USER_CODE_ALPHABET[randomInt(0, USER_CODE_ALPHABET.length)] ?? "A";
    }
    return code;
  }
}
