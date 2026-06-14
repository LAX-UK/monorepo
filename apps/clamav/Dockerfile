# Docker Hub repo is ajilaag/clamav-rest (GitHub org is ajilach). Pin a release tag.
FROM ajilaag/clamav-rest:v0.4.15

# clamd + freshclam + REST API run in one container; HTTP REST listens on 9000.
# Size cap is governed by MAX_FILE_SIZE (default 25M -> HTTP 413 over that). Our
# worker caps scans at 25 MB, so give the wrapper headroom for multipart overhead.
ENV MAX_FILE_SIZE=30M
# Server-to-server only; disable the permissive default CORS (ALLOW_ORIGINS=*).
ENV ALLOW_ORIGINS=

# Pre-seed the signature DB at build time. App Platform has no persistent volume,
# so without this every cold start downloads the full DB (~1-3 min) during which
# the worker fail-closes and rejects uploads. Baking it means freshclam only
# fetches deltas on boot, shrinking that window to seconds.
RUN freshclam --datadir=/clamav/data --stdout || true

EXPOSE 9000
