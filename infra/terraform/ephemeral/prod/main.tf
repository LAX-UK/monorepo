locals {
  environment = "prod"
  region      = "lon1"
  # Valkey region list is account-specific; nyc3 matches DO examples when EU slugs 422.
  redis_region         = "nyc3"
  branch               = "release"
  cookie_domain        = ".lax.bid"
  cors_allowed_origins = "https://lax.bid,https://api.lax.bid,https://auth.lax.bid,https://ws.lax.bid"
  oidc_issuer_url      = "https://auth.lax.bid"
  api_public_url       = "https://api.lax.bid"
  web_origin           = "https://lax.bid"
  ws_public_url        = "wss://ws.lax.bid"
  media_public_url     = "https://media.lax.bid"

  domain = {
    web   = "lax.bid"
    api   = "api.lax.bid"
    auth  = "auth.lax.bid"
    ws    = "ws.lax.bid"
    media = "media.lax.bid"
  }
}

resource "random_password" "better_auth_secret" {
  length  = 48
  special = false
}

locals {
  effective_better_auth_secret     = var.better_auth_secret != "" ? var.better_auth_secret : random_password.better_auth_secret.result
  effective_spaces_access_key_id   = var.spaces_access_key_id != "" ? var.spaces_access_key_id : "pending-media-spaces-access-key"
  effective_spaces_secret_key      = var.spaces_secret_access_key != "" ? var.spaces_secret_access_key : "pending-media-spaces-secret-key"
  effective_shopify_webhook_secret = var.shopify_webhook_secret != "" ? var.shopify_webhook_secret : "pending-shopify-webhook-secret"
  effective_wordpress_secret       = var.wordpress_webhook_secret != "" ? var.wordpress_webhook_secret : "pending-wordpress-webhook-secret"

  common_secret_env = [
    { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
    { key = "LOG_LEVEL", value = "info", type = "GENERAL", scope = "RUN_TIME" },
    { key = "COOKIE_DOMAIN", value = local.cookie_domain, type = "GENERAL", scope = "RUN_TIME" },
    { key = "BETTER_AUTH_SECRET", value = local.effective_better_auth_secret, type = "SECRET", scope = "RUN_TIME" },
    { key = "GOOGLE_CLIENT_ID", value = var.google_client_id, type = "SECRET", scope = "RUN_TIME" },
    { key = "GOOGLE_CLIENT_SECRET", value = var.google_client_secret, type = "SECRET", scope = "RUN_TIME" },
    { key = "APPLE_CLIENT_ID", value = var.apple_client_id, type = "SECRET", scope = "RUN_TIME" },
    { key = "APPLE_CLIENT_SECRET", value = var.apple_client_secret, type = "SECRET", scope = "RUN_TIME" }
  ]
}

resource "random_password" "auth_app" {
  length  = 32
  special = true
}

resource "random_password" "api_app" {
  length  = 32
  special = true
}

resource "random_password" "worker_app" {
  length  = 32
  special = true
}

module "postgres" {
  source        = "../../modules/postgres-cluster"
  name          = "lax-${local.environment}-postgres"
  environment   = local.environment
  region        = local.region
  size          = "db-s-2vcpu-4gb"
  node_count    = 2
  database_name = "auction"
}

module "redis" {
  source      = "../../modules/redis-cluster"
  name        = "lax-${local.environment}-redis"
  environment = local.environment
  region      = local.redis_region
  size        = "db-s-1vcpu-2gb"
  node_count  = 1
}

provider "postgresql" {
  host            = module.postgres.host
  port            = module.postgres.port
  database        = module.postgres.database_name
  username        = "doadmin"
  password        = nonsensitive(regex("doadmin:([^@]+)@", module.postgres.owner_uri)[0])
  sslmode         = "require"
  connect_timeout = 15
  superuser       = false
}

module "postgres_rbac" {
  source             = "../../modules/postgres-rbac"
  database_url_owner = module.postgres.owner_uri
  database_name      = module.postgres.database_name
  roles = {
    auth_app   = { password = random_password.auth_app.result }
    api_app    = { password = random_password.api_app.result }
    worker_app = { password = random_password.worker_app.result }
  }
}

locals {
  database_url_auth   = "postgresql://auth_app:${urlencode(random_password.auth_app.result)}@${module.postgres.host}:${module.postgres.port}/${module.postgres.database_name}?sslmode=require"
  database_url_api    = "postgresql://api_app:${urlencode(random_password.api_app.result)}@${module.postgres.host}:${module.postgres.port}/${module.postgres.database_name}?sslmode=require"
  database_url_worker = "postgresql://worker_app:${urlencode(random_password.worker_app.result)}@${module.postgres.host}:${module.postgres.port}/${module.postgres.database_name}?sslmode=require"

  components = [
    {
      name              = "web"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/web/Dockerfile"
      http_port         = 3000
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/"
      domain            = local.domain.web
      primary_domain    = true
      env = concat(local.common_secret_env, [
        { key = "NEXT_PUBLIC_API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_AUTH_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_WS_URL", value = local.ws_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "INTERNAL_API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" }
      ])
    },
    {
      name              = "api"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/api/Dockerfile"
      http_port         = 3001
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/health/live"
      domain            = local.domain.api
      primary_domain    = false
      env = concat(local.common_secret_env, [
        { key = "DATABASE_URL", value = local.database_url_api, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_API", value = local.database_url_api, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_AUTH", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_PUBLIC_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OIDC_ISSUER_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "CORS_ALLOWED_ORIGINS", value = local.cors_allowed_origins, type = "GENERAL", scope = "RUN_TIME" },
        { key = "STORAGE_DRIVER", value = "s3", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_BUCKET", value = "lax-media", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_REGION", value = local.region, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ENDPOINT", value = "https://${local.region}.digitaloceanspaces.com", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_PUBLIC_BASE_URL", value = local.media_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ACCESS_KEY_ID", value = local.effective_spaces_access_key_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "S3_SECRET_ACCESS_KEY", value = local.effective_spaces_secret_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "SHOPIFY_WEBHOOK_SECRET", value = local.effective_shopify_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "WORDPRESS_WEBHOOK_SECRET", value = local.effective_wordpress_secret, type = "SECRET", scope = "RUN_TIME" }
      ])
    },
    {
      name              = "auth"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/auth/Dockerfile"
      http_port         = 3003
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/health/live"
      domain            = local.domain.auth
      primary_domain    = false
      env = concat(local.common_secret_env, [
        { key = "DATABASE_URL", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_AUTH", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_PUBLIC_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OIDC_ISSUER_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "CORS_ALLOWED_ORIGINS", value = local.cors_allowed_origins, type = "GENERAL", scope = "RUN_TIME" },
        { key = "APPLE_DOMAIN_ASSOCIATION", value = var.apple_domain_association, type = "SECRET", scope = "RUN_TIME" }
      ])
    },
    {
      name              = "ws"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/ws/Dockerfile"
      http_port         = 3002
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/health/live"
      domain            = local.domain.ws
      primary_domain    = false
      env = [
        { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OIDC_ISSUER", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "JWKS_URL", value = "${local.oidc_issuer_url}/.well-known/jwks.json", type = "GENERAL", scope = "RUN_TIME" },
        { key = "CORS_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "LEGACY_WS_COOKIE_RELAY", value = "false", type = "GENERAL", scope = "RUN_TIME" }
      ]
    },
    {
      name            = "worker"
      kind            = "worker"
      source_dir      = "/"
      dockerfile_path = "apps/worker/Dockerfile"
      instance_size   = "professional-xs"
      instance_count  = 1
      env = [
        { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "DATABASE_URL", value = local.database_url_worker, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_WORKER", value = local.database_url_worker, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "LOG_LEVEL", value = "info", type = "GENERAL", scope = "RUN_TIME" },
        { key = "STORAGE_DRIVER", value = "s3", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_BUCKET", value = "lax-media", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_REGION", value = local.region, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ENDPOINT", value = "https://${local.region}.digitaloceanspaces.com", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_PUBLIC_BASE_URL", value = local.media_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ACCESS_KEY_ID", value = local.effective_spaces_access_key_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "S3_SECRET_ACCESS_KEY", value = local.effective_spaces_secret_key, type = "SECRET", scope = "RUN_TIME" }
      ]
    },
    {
      name            = "migrate"
      kind            = "job"
      source_dir      = "/"
      dockerfile_path = "apps/api/Dockerfile"
      run_command     = "node packages/db/dist/migrate-prod.js"
      instance_size   = "professional-xs"
      instance_count  = 1
      env = [
        { key = "DATABASE_URL_OWNER", value = module.postgres.owner_uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "AUTH_APP_DB_PASSWORD", value = random_password.auth_app.result, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_APP_DB_PASSWORD", value = random_password.api_app.result, type = "SECRET", scope = "RUN_TIME" },
        { key = "WORKER_APP_DB_PASSWORD", value = random_password.worker_app.result, type = "SECRET", scope = "RUN_TIME" }
      ]
    }
  ]
}

module "app" {
  source               = "../../modules/digitalocean-app"
  name                 = "lax-${local.environment}-app"
  environment          = local.environment
  region               = local.region
  repository_clone_url = var.repository_clone_url
  branch               = local.branch
  components           = local.components
  depends_on           = [module.postgres_rbac]
}

module "monitoring" {
  source              = "../../modules/monitoring"
  environment         = local.environment
  alert_email         = var.ops_alert_email
  postgres_cluster_id = module.postgres.id
  redis_cluster_id    = module.redis.id
  uptime_targets = {
    web  = "https://${local.domain.web}/"
    api  = "https://${local.domain.api}/health/live"
    auth = "https://${local.domain.auth}/health/live"
    ws   = "https://${local.domain.ws}/health/live"
  }
}
