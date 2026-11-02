# Download my data: worker job, bucket and operations

How a person's personal data copy ("Download my data") is assembled, stored, expired and supported. The request, step-up and audit live in Identity (`apps/auth`); the readers live in Identity, Bid (`apps/api`) and Shop (`apps/shop-api`); this runbook covers the worker (`apps/worker/src/subject-export`) and the infrastructure it needs.

## Flow

1. Identity records the request and writes `subject.data_export_requested` to its outbox, in one transaction.
2. The worker's Identity outbox relay copies the event into the domain event log and, inside the same transaction, queues a `subject-data-export` job named `assemble`. The job id is `subject-data-export__{exportId}`, so relaying the same event twice queues one job. If the queue is down the relay batch rolls back and is relayed again.
3. The job gets an OAuth token from Identity (`/internal/oauth/token`, scope `subject_export`), then for each product in turn (Account from Identity, then Bid, then Shop) reads the manifest and pages every category with the cursor. Bid and Shop take the export client pair in headers plus `x-identity-client-scope: subject_export`.
4. Records stream into per-category JSON files on local temp disk. Signed file links found in a record are fetched to disk and the link is replaced in the JSON by the file's path in the ZIP (`{ included: true, path, sha256, ... }`).
5. After each product the job reports `product_collected` to Identity, with category counts and schema versions only.
6. When every product is in, the job writes the ZIP (top folder `lax-data-{date}/`): the data files, the uploaded files under `{product}/files/{category}/`, `README.txt` (generated from the contract's category and field descriptions), `Your LAX data.html` and `manifest.json` (size and SHA-256 of every file).
7. The ZIP is uploaded by multipart upload to `subject-exports/{exportId}/lax-data-{date}.zip`, and the job reports `ready` with size, SHA-256 and the object key. Identity sets the 7-day expiry and sends the ready email.
8. The temp directory is removed in a `finally`.

## Limits and failure rules

| Rule | Value |
|---|---|
| Queue concurrency | 2 |
| One attempt | 30 minutes, then it is a transient failure |
| ZIP size | 2 GB of uncompressed content. A 64 MB reserve is kept for the documents and the data files still to come. Uploaded files that would pass it are not fetched or are dropped, and are listed in the JSON with `"included": false`, a reason and an "ask us" message. The data files themselves are never dropped: if they alone pass the cap the request fails (`export_too_large`) and goes to a person. |
| Temp disk | Up to about twice the cap (the staged files and the ZIP). Size the worker's disk for that. |
| Retries | A product that does not answer is retried with exponential backoff for up to 72 hours (13 attempts from 63 seconds put the last one at about 71.7 hours). |
| After 72 hours | The job reports `delayed` for that product, stops, and lands in Failed jobs in Bid admin. Nothing is uploaded: a partial copy never ships. |
| Unrecoverable | A product answering 400 or 422, an answer outside the contract, a paging loop, or a copy over the cap: reported `failed` at once, and listed in Failed jobs with the payload masked (ids only). |

A product answering anything else (5xx, 429, 401, 403, 404, no answer) counts as not answering, because most of those are a deployment or configuration problem that is fixed within the window. A category the worker does not know yet (a product deployed ahead of the worker) is retried until the worker is deployed.

Retrying a job from Failed jobs starts a new 72-hour window. A request already `failed` in Identity ignores later reports, so retry only `delayed` ones.

Worker logs carry the export id, the attempt, the product and an error code. They never carry the person's id or any record content.

## Expiry and purge

Identity sets `object_purge_requested_at` when a copy expires or the person deletes it. A repeatable `purge-objects` job (hourly, one attempt) asks Identity for the pending list (`GET /internal/identity/subject-exports/purge-pending`), deletes each object, and confirms it (`POST /internal/identity/subject-exports/{exportId}/purged`), which sets `object_purged_at`. A key outside `subject-exports/{exportId}/` is refused. A copy that cannot be deleted stays pending and is retried at the next run.

The purge job uses HTTP only. The worker's database role is untouched by this feature: it reads no Identity table for it.

## Configuration

Set all of the worker values or none. Partly set, the worker refuses to start. With none set, the queue still exists so requests wait, but no consumer starts and nothing is collected.

| Variable | On | Purpose |
|---|---|---|
| `IDENTITY_INTERNAL_BASE_URL` | worker | Where the worker reaches Identity |
| `API_INTERNAL_BASE_URL` | worker | Bid (already used by cron) |
| `SHOP_API_INTERNAL_BASE_URL` | worker | Shop |
| `SUBJECT_EXPORT_MACHINE_CLIENT_ID` / `_SECRET` | worker, `apps/auth` | OAuth client for the `subject_export` scope on Identity (secret at least 32 characters) |
| `IDENTITY_SUBJECT_EXPORT_CLIENT_ID` / `_SECRET` | worker, `apps/api`, `apps/shop-api` | The pair Bid and Shop check with the scope header (secret at least 32 characters) |
| `SUBJECT_EXPORT_BUCKET`, `SUBJECT_EXPORT_REGION`, `SUBJECT_EXPORT_ENDPOINT` (optional) | worker, `apps/auth` | The private export bucket |
| `SUBJECT_EXPORT_WRITE_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | worker only | Write and delete keys for the bucket |
| `SUBJECT_EXPORT_READ_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | `apps/auth` only | Read-only keys; Identity only signs 5-minute downloads |

Least privilege: the worker can write and delete in the bucket and cannot sign a download for a person; Identity can sign reads and cannot write.

## Infrastructure (not applied by code)

Nothing here is created by the application or by this change. It is done per environment (test now, production when the owner gives the go) by whoever owns infrastructure.

1. **Bucket**: a private bucket that holds personal exports and nothing else (`lax-subject-exports` in production, a separate one in test). No public ACL, no listing for anonymous users, encrypted at rest (a bucket setting; Spaces encrypts at rest by default, on AWS enable default SSE).
2. **Lifecycle rule**: expire objects under prefix `subject-exports/` after **8 days**. This is the backstop behind the 7-day expiry and the purge job. Also abort incomplete multipart uploads after 1 day, so a crashed upload leaves nothing.
3. **Credentials**: two keys limited to this one bucket. Worker: read, write and delete. Identity: read only. Never reuse the media bucket's keys.
4. **Environment**: set the variables above per environment (DigitalOcean App Platform env on the worker, `apps/auth`, `apps/api`, `apps/shop-api`) and record them in 1Password; they are listed in `docs/security/secrets-management.md`.
5. **Bid and Shop**: both must run the readers (`IDENTITY_SUBJECT_EXPORT_CLIENT_ID` / `_SECRET` set) before the worker is switched on, otherwise every request waits in retry.

### Terraform note

The repository has no Terraform. This is what the infrastructure owner should encode, shown for DigitalOcean Spaces (lon1, as the media bucket). It has not been applied anywhere.

```hcl
resource "digitalocean_spaces_bucket" "subject_exports" {
  name   = "lax-subject-exports${var.env_suffix}" # one per environment
  region = "lon1"
  acl    = "private"

  lifecycle_rule {
    id                                     = "expire-personal-exports"
    enabled                                = true
    prefix                                 = "subject-exports/"
    expiration { days = 8 }
    abort_incomplete_multipart_upload_days = 1
  }
}

# Two keys scoped to this bucket only (Spaces keys: "readwritedelete" and "read").
# digitalocean_spaces_key.subject_export_worker   grant { bucket = ..., permission = "readwritedelete" }
# digitalocean_spaces_key.subject_export_identity grant { bucket = ..., permission = "read" }
```

On AWS S3 the equivalent is a bucket with Block Public Access on, default encryption, the same lifecycle rule, and two IAM users: one with `s3:PutObject`, `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` and `s3:DeleteObject` on `arn:aws:s3:::BUCKET/subject-exports/*`, one with `s3:GetObject` on the same prefix.

## Checking a request by hand

- Identity row stuck in `collecting`: look for the job (`subject-data-export__{exportId}`) in Bull Board, then Failed jobs. A `delayed` request names the product in Identity's audit (`data_export.delayed`).
- Nothing starts: confirm the worker logs "download-my-data is not configured" is absent, and that the Identity outbox relay is running (the projector runner drives it).
- Download fails after ready: the object key in Identity must exist in the bucket and the read keys must be set on `apps/auth`.

## Staff "Data requests" (Bid admin, Compliance)

Compliance and Administrator (permission `data_requests.manage`) see every request for a copy of a person's data on one clock: the automatic downloads above, and the requests staff log themselves (a full copy with staff notes and outside systems, a request after the account was deleted, or a download taken over by hand). Bid's API reads and acts through Identity's `/internal/identity/data-requests/*` routes; it never reads Identity's tables.

| Variable | On | Purpose |
|---|---|---|
| `DATA_REQUESTS_MACHINE_CLIENT_ID` / `_SECRET` | `apps/auth` | OAuth client for the `data_requests.staff` scope (secret at least 32 characters; the id must differ from the lifecycle and export clients). Both or neither: with neither the routes are not mounted |
| `IDENTITY_DATA_REQUESTS_CLIENT_ID` / `_SECRET` | `apps/api` | The same pair, used by Bid's API. Without it the screen's routes answer 503 |
| `DATA_REQUEST_CONTACT_RETENTION_DAYS` | `apps/auth` | Days after a manual request closes before its contact name and details are cleared (default 730). The dates, scope, outcome and audit stay. Working figure, lawyer to confirm |

- A lifecycle or export token is refused by these routes, and this token is refused by theirs.
- Manual requests are numbered `DR-0001` upwards; downloads are shown as `DL-` and the first six characters of their id. If two downloads ever share those six characters, the record answers `ambiguous_reference` and the request is found by its id in the database.
- The 24-hour, 7-day and 21-day deadline alerts for downloads are also written to the request's audit trail (`data_export.deadline_alert`, with the tier and who is alerted).
- Staff open a record: Bid's audit log gets `data_request.viewed` with the staff member and the reference only. Notes and contact details are never written to either audit trail.
