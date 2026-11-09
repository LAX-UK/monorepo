import { type KeyObject, createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

/**
 * A software WebAuthn authenticator for tests: an ES256 key that makes "none" attestations and
 * signs assertions, so a passkey ceremony can run against the real Better Auth handler without a
 * browser. It can be told to leave out the user-verified flag, to speak for another origin or
 * relying party, and to be a synced (backed-up) or device-bound credential.
 */

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

/** Just enough CBOR for a COSE key and an attestation object. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number): Buffer => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
  };
  if (typeof value === "number") {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (typeof value === "string") {
    const text = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, text.length), text]);
  }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map) {
    return Buffer.concat([
      head(5, value.size),
      ...[...value.entries()].flatMap(([k, v]) => [cbor(k), cbor(v)]),
    ]);
  }
  throw new Error("unsupported CBOR value");
}

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_BE = 0x08;
const FLAG_BS = 0x10;
const FLAG_AT = 0x40;

export type CeremonyOptions = {
  /** The origin the browser would report; the issuer must refuse any other. */
  origin: string;
  /** The relying party the device would use; the issuer must refuse any other. */
  rpID: string;
  /** Whether the device checked the person (face, fingerprint, screen lock). */
  userVerified?: boolean;
};

export class SoftwareAuthenticator {
  readonly credentialId = randomBytes(16);
  private readonly privateKey: KeyObject;
  private readonly publicJwk: { x: string; y: string };
  private counter = 0;

  constructor(
    private readonly options: {
      synced?: boolean;
      aaguid?: Buffer;
      /**
       * `increment` counts each sign-in, as a device-bound key does. `zero` always says zero, as
       * synced passkeys do (the counter cannot be kept in step across devices).
       */
      counter?: "increment" | "zero";
      /** The user handle the device returns when it signs in (the account it was made for). */
      userHandle?: string;
    } = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    this.publicJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  }

  get id(): string {
    return b64url(this.credentialId);
  }

  private flags(userVerified: boolean, attested: boolean): number {
    return (
      FLAG_UP |
      (userVerified ? FLAG_UV : 0) |
      (attested ? FLAG_AT : 0) |
      (this.options.synced ? FLAG_BE | FLAG_BS : 0)
    );
  }

  private counterBytes(): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(this.counter, 0);
    return buffer;
  }

  /** The browser's answer to a creation challenge. */
  register(challenge: string, ceremony: CeremonyOptions) {
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: "webauthn.create",
        challenge,
        origin: ceremony.origin,
        crossOrigin: false,
      }),
    );
    const cose = cbor(
      new Map<number, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(this.publicJwk.x, "base64url")],
        [-3, Buffer.from(this.publicJwk.y, "base64url")],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length, 0);
    const authData = Buffer.concat([
      createHash("sha256").update(ceremony.rpID).digest(),
      Buffer.from([this.flags(ceremony.userVerified !== false, true)]),
      this.counterBytes(),
      this.options.aaguid ?? Buffer.alloc(16),
      idLength,
      this.credentialId,
      cose,
    ]);
    const attestationObject = cbor(
      new Map<string, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(clientDataJSON),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
    };
  }

  /** A clone of this authenticator's key that has fallen behind: it answers with `counter` next. */
  rewindTo(counter: number): void {
    this.counter = counter - 1;
  }

  /** The browser's answer to a sign-in challenge. */
  assert(challenge: string, ceremony: CeremonyOptions) {
    if (this.options.counter !== "zero") this.counter += 1;
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge,
        origin: ceremony.origin,
        crossOrigin: false,
      }),
    );
    const authData = Buffer.concat([
      createHash("sha256").update(ceremony.rpID).digest(),
      Buffer.from([this.flags(ceremony.userVerified !== false, false)]),
      this.counterBytes(),
    ]);
    const signature = sign(
      "sha256",
      Buffer.concat([authData, createHash("sha256").update(clientDataJSON).digest()]),
      this.privateKey,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
        userHandle: this.options.userHandle ? b64url(Buffer.from(this.options.userHandle)) : null,
      },
      clientExtensionResults: {},
    };
  }
}
