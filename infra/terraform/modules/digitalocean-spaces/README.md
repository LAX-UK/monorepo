# digitalocean-spaces

Manages the shared `lax-media` Space, CORS, public-read prefix whitelist, and CDN.

Image upload prefixes allowed for anonymous CDN read are listed in `local.public_image_prefixes` (must stay in sync with `sale_day` and other kinds in `apps/api/src/services/upload.policy.ts`).
