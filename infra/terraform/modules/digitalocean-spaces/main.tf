terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.85.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 4.45.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.23.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "= 0.13.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

resource "digitalocean_spaces_bucket" "this" {
  name   = var.bucket_name
  region = var.region
  acl    = "private"
}
resource "digitalocean_spaces_bucket_cors_configuration" "this" {
  bucket = digitalocean_spaces_bucket.this.name
  region = digitalocean_spaces_bucket.this.region
  cors_rule {
    allowed_headers = ["Content-Type", "x-amz-*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Whitelist of image-only prefixes that are safe to expose via the public CDN.
# Document prefixes (legal-entity-documents, lot-documents, sale-documents,
# submission-documents) deliberately stay private and are accessed only via
# presigned URLs — see apps/api/src/services/upload.policy.ts.
locals {
  public_image_prefixes = [
    "events",
    "seed",
    "uploads/pending/avatar",
    "uploads/pending/submissions",
    "uploads/pending/lots",
    "uploads/pending/sales",
    "uploads/pending/artists",
    "uploads/pending/categories",
  ]
}

resource "digitalocean_spaces_bucket_policy" "public_read" {
  region = digitalocean_spaces_bucket.this.region
  bucket = digitalocean_spaces_bucket.this.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadImagePrefixes"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = [for p in local.public_image_prefixes : "arn:aws:s3:::${digitalocean_spaces_bucket.this.name}/${p}/*"]
      },
    ]
  })
}

# CDN endpoint in front of the bucket. No custom domain because DO Let's Encrypt
# only works with DO-managed DNS (we use Cloudflare). Use the CDN URL directly
# via NEXT_PUBLIC_MEDIA_BASE_URL instead.
resource "digitalocean_cdn" "this" {
  origin = "${digitalocean_spaces_bucket.this.name}.${digitalocean_spaces_bucket.this.region}.digitaloceanspaces.com"
  ttl    = 86400
}
