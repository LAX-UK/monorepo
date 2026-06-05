# digitalocean-app

Creates one DigitalOcean App Platform app with services, workers, a pre-deploy Job, env vars, and per-component domain attachments.

## Deploy source

Each component inherits the module-level `deploy_source` (`github` or `image`) unless overridden per component. When `deploy_source = "image"`, the spec pins to `registry.digitalocean.com/<registry>/lax-<environment>-<name>:<image_tag>` (default tag = environment name, e.g. `prod`).

CI (`.github/workflows/build-images.yml`) builds and pushes all six components, including `web`. Web build-time `NEXT_PUBLIC_*` values are documented in [`infra/web-build/README.md`](../../../web-build/README.md).
