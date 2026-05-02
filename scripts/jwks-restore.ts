import { createDecipheriv } from "node:crypto";
import process from "node:process";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const { Client } = pg;
type EnvName = "test" | "prod";

type SnapshotPayload = {
  env: EnvName;
  exportedAt: string;
  rows: Array<{
    kid: string;
    algorithm: string;
    public_jwk: unknown;
    private_jwk: unknown;
    status: string;
    created_at: string;
    rotated_at: string | null;
  }>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseEnv(): EnvName {
  const value = process.env.JWKS_SNAPSHOT_ENV ?? process.env.ENVIRONMENT ?? process.argv[2];
  if (value !== "test" && value !== "prod")
    throw new Error("JWKS environment must be test or prod");
  return value;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  const readable = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (!readable.transformToByteArray) throw new Error("S3 response body is not readable");
  return Buffer.from(await readable.transformToByteArray());
}

function decryptJson(input: Buffer, keyBase64: string): SnapshotPayload {
  const envelope = JSON.parse(input.toString("utf8")) as {
    iv: string;
    tag: string;
    ciphertext: string;
  };
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("JWKS snapshot key must decode to 32 bytes");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  const payload = JSON.parse(plaintext.toString("utf8")) as SnapshotPayload;
  if (!Array.isArray(payload.rows)) throw new Error("JWKS snapshot rows must be an array");
  return payload;
}

async function main() {
  const env = parseEnv();
  const bucket = process.env.STATE_BUCKET_NAME ?? "lax-tf-state";
  const region = process.env.DO_SPACES_REGION ?? "lon1";
  const prefix = `secrets-backup/jwks/${env}/`;
  const s3 = new S3Client({
    region,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    credentials: {
      accessKeyId: requireEnv("SPACES_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("SPACES_SECRET_ACCESS_KEY"),
    },
  });
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const latest = (listed.Contents ?? [])
    .filter((object) => object.Key)
    .sort((a, b) => String(a.Key).localeCompare(String(b.Key)))
    .at(-1);
  if (!latest?.Key) {
    console.log(`No JWKS snapshot found under s3://${bucket}/${prefix}; skipping restore.`);
    return;
  }
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: latest.Key }));
  const payload = decryptJson(
    await bodyToBuffer(object.Body),
    requireEnv(`JWKS_SNAPSHOT_KEY_${env.toUpperCase()}`),
  );
  if (payload.env !== env)
    throw new Error(`Snapshot env ${payload.env} does not match requested env ${env}`);
  if (process.argv.includes("--dry-run")) {
    console.log(`Would restore ${payload.rows.length} JWKS rows from ${latest.Key}.`);
    return;
  }
  const client = new Client({ connectionString: requireEnv("DATABASE_URL_OWNER") });
  await client.connect();
  await client.query("begin");
  try {
    for (const row of payload.rows) {
      await client.query(
        `insert into jwks_key (kid, algorithm, public_jwk, private_jwk, status, created_at, rotated_at)
        values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
        on conflict (kid) do update set algorithm = excluded.algorithm, public_jwk = excluded.public_jwk, private_jwk = excluded.private_jwk, status = excluded.status, created_at = excluded.created_at, rotated_at = excluded.rotated_at`,
        [
          row.kid,
          row.algorithm,
          JSON.stringify(row.public_jwk),
          JSON.stringify(row.private_jwk),
          row.status,
          row.created_at,
          row.rotated_at,
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  console.log(`Restored ${payload.rows.length} JWKS rows from s3://${bucket}/${latest.Key}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
