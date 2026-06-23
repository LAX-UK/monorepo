# DigitalOcean Spaces (S3) media loss

## Symptom

- Images 403/404; uploads fail; CDN `media.lax.bid` errors; `S3_*` env misconfigured.
- **Auction-day photos only** (`uploads/pending/sale-day/*`) return 403 while lot/cover images work — bucket policy prefix whitelist missing `uploads/pending/sale-day` (see `infra/terraform/modules/digitalocean-spaces/main.tf` `public_image_prefixes`; must match `sale_day` in `apps/api/src/services/upload.policy.ts`).

## Diagnosis

1. **Bucket CORS** — Terraform `digitalocean-spaces` module; browser PUT failures often CORS (e.g. missing `Cache-Control` in `allowed_headers` when presigned uploads require it).
2. **Keys** — `S3_ACCESS_KEY_ID` / `SECRET` rotated? Spaces panel → API keys.
3. **Object existence** — `aws s3 ls s3://lax-media/...` with endpoint `https://lon1.digitaloceanspaces.com`.

## Resolution

- **Missing public prefix (e.g. sale-day 403)** — add prefix to `public_image_prefixes` in Terraform, apply `persistent/prod` via GitHub Actions workflow **Terraform apply prod** (`layer=persistent`, confirmation `APPLY-PROD`), then flush CDN cache (DO control panel or `doctl compute cdn flush <cdn-endpoint-id>`) so cached 403s clear.
- **Wrong ACL / public base URL** — fix `S3_PUBLIC_BASE_URL` to match CDN hostname in Terraform locals.
- **Accidental delete** — restore from **object versioning** if enabled; else restore from last **Postgres + media backup** (re-upload assets from design archive).
- **Full bucket loss** — disaster: rebuild from git-tracked marketing assets + DB `image` rows; expect partial data loss for user uploads.

## Escalation

- DO support with bucket name + timestamps.

## Related

- [Postgres backup restore](./postgres-backup-restore.md)
