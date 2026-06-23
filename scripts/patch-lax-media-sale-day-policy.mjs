#!/usr/bin/env node
/**
 * One-off: add uploads/pending/sale-day to lax-media public-read bucket policy.
 *
 * Requires Spaces S3 credentials (same as Terraform backend / MEDIA_SPACES_*):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Usage:
 *   node scripts/patch-lax-media-sale-day-policy.mjs
 *   node scripts/patch-lax-media-sale-day-policy.mjs --dry-run
 */
import { GetBucketPolicyCommand, PutBucketPolicyCommand, S3Client } from "@aws-sdk/client-s3";

const BUCKET = "lax-media";
const REGION = "lon1";
const ENDPOINT = `https://${REGION}.digitaloceanspaces.com`;
const NEW_PREFIX = "uploads/pending/sale-day";
const dryRun = process.argv.includes("--dry-run");

const accessKeyId =
  process.env.AWS_ACCESS_KEY_ID ?? process.env.MEDIA_SPACES_ACCESS_KEY_ID ?? "";
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY ?? process.env.MEDIA_SPACES_SECRET_ACCESS_KEY ?? "";

const client = new S3Client({
  region: "us-east-1",
  endpoint: ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

function ensureSaleDayPrefix(policy) {
  const resource = `arn:aws:s3:::${BUCKET}/${NEW_PREFIX}/*`;
  const stmt = policy.Statement?.find((s) => s.Sid === "PublicReadImagePrefixes");
  if (!stmt) throw new Error("PublicReadImagePrefixes statement not found");
  const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
  if (resources.includes(resource)) {
    return { policy, changed: false };
  }
  stmt.Resource = [...resources, resource];
  return { policy, changed: true };
}

async function main() {
  if (!accessKeyId || !secretAccessKey) {
    console.error(
      "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or MEDIA_SPACES_ACCESS_KEY_ID / MEDIA_SPACES_SECRET_ACCESS_KEY).",
    );
    process.exit(1);
  }

  const current = await client.send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
  const policy = JSON.parse(current.Policy ?? "{}");
  const { policy: next, changed } = ensureSaleDayPrefix(policy);

  if (!changed) {
    console.log(`Policy already includes ${NEW_PREFIX}; nothing to do.`);
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify(next, null, 2));
    return;
  }

  await client.send(
    new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(next) }),
  );
  console.log(`Added public read for ${NEW_PREFIX} on ${BUCKET}.`);
  console.log("Flush CDN: doctl compute cdn flush 0f93453a-e8e0-4ed7-a540-0f3ee7049457");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
