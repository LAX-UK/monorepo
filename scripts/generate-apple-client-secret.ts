import { SignJWT, importPKCS8 } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const MAX_APPLE_SECRET_TTL_SECONDS = 60 * 60 * 24 * 180;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n").trim();
}

async function main() {
  const teamId = readRequiredEnv("APPLE_TEAM_ID");
  const keyId = readRequiredEnv("APPLE_KEY_ID");
  const clientId = readRequiredEnv("APPLE_CLIENT_ID");
  const privateKey = normalizePrivateKey(readRequiredEnv("APPLE_PRIVATE_KEY"));
  const now = Math.floor(Date.now() / 1000);
  const signingKey = await importPKCS8(privateKey, "ES256");

  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_APPLE_SECRET_TTL_SECONDS)
    .sign(signingKey);

  process.stdout.write(`${clientSecret}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Failed to generate Apple client secret: ${message}\n`);
  process.stderr.write(
    "Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, and APPLE_PRIVATE_KEY before running.\n",
  );
  process.exitCode = 1;
});
