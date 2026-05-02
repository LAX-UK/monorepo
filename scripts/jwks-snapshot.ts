import { createCipheriv, randomBytes } from "node:crypto";
import process from "node:process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const { Client } = pg;
type EnvName = "test" | "prod";

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

function encryptJson(payload: unknown, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("JWKS snapshot key must decode to 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    JSON.stringify({
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    }),
  );
}

async function main() {
  const env = parseEnv();
  const client = new Client({ connectionString: requireEnv("DATABASE_URL_OWNER") });
  await client.connect();
  const result = await client.query(
    "select kid, algorithm, public_jwk, private_jwk, status, created_at, rotated_at from jwks_key order by created_at asc",
  );
  await client.end();
  const encrypted = encryptJson(
    { env, exportedAt: new Date().toISOString(), rows: result.rows },
    requireEnv(`JWKS_SNAPSHOT_KEY_${env.toUpperCase()}`),
  );
  if (process.argv.includes("--verify")) {
    console.log(
      `Encrypted ${result.rows.length} JWKS rows for ${env}; upload skipped by --verify.`,
    );
    return;
  }
  const bucket = process.env.STATE_BUCKET_NAME ?? "lax-tf-state";
  const region = process.env.DO_SPACES_REGION ?? "lon1";
  const key = `secrets-backup/jwks/${env}/${new Date().toISOString().replaceAll(":", "-")}.json.enc`;
  const s3 = new S3Client({
    region,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    credentials: {
      accessKeyId: requireEnv("SPACES_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("SPACES_SECRET_ACCESS_KEY"),
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: encrypted,
      ContentType: "application/json",
    }),
  );
  console.log(`Uploaded JWKS snapshot to s3://${bucket}/${key}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
