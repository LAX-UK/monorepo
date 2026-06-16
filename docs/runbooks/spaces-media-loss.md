# DigitalOcean Spaces (S3) media loss

## Symptom

- Images 403/404; uploads fail; CDN `media.lax.bid` errors; `S3_*` env misconfigured.

## Diagnosis

1. **Bucket CORS** — Terraform `digitalocean-spaces` module; browser PUT failures often CORS (e.g. missing `Cache-Control` in `allowed_headers` when presigned uploads require it).
2. **Keys** — `S3_ACCESS_KEY_ID` / `SECRET` rotated? Spaces panel → API keys.
3. **Object existence** — `aws s3 ls s3://lax-media/...` with endpoint `https://lon1.digitaloceanspaces.com`.

## Resolution

- **Wrong ACL / public base URL** — fix `S3_PUBLIC_BASE_URL` to match CDN hostname in Terraform locals.
- **Accidental delete** — restore from **object versioning** if enabled; else restore from last **Postgres + media backup** (re-upload assets from design archive).
- **Full bucket loss** — disaster: rebuild from git-tracked marketing assets + DB `image` rows; expect partial data loss for user uploads.

## Escalation

- DO support with bucket name + timestamps.

## Related

- [Postgres backup restore](./postgres-backup-restore.md)
