# Terraform state recovery

State lives in the versioned `lax-tf-state` DigitalOcean Space. GitHub Actions serializes applies, but Spaces does not provide native Terraform state locking.

## Restore a previous state version

1. Stop all Terraform workflows.
2. Identify the last known-good object version for `<layer>-<env>/terraform.tfstate` in the Spaces UI or with the S3 API.
3. Copy the current state to `<layer>-<env>/incident-backups/<timestamp>.tfstate`.
4. Restore the known-good version to `<layer>-<env>/terraform.tfstate`.
5. Run `terraform plan` through GitHub Actions and confirm the diff only contains expected recovery changes.

Do not run local `terraform apply` unless the workflow runner itself is unavailable and the incident commander has recorded the exception.
