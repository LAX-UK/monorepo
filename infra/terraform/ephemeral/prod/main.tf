locals {
  environment          = "prod"
  region               = "lon1"
  redis_region         = "lon1"
  cookie_domain        = ".lax.bid"
  cors_allowed_origins = "https://lax.bid,https://api.lax.bid,https://auth.lax.bid,https://ws.lax.bid,https://event.lax.bid"
  oidc_issuer_url      = "https://auth.lax.bid"
  api_public_url       = "https://api.lax.bid"
  web_origin           = "https://lax.bid"
  event_origin         = "https://event.lax.bid"
  ws_public_url        = "wss://ws.lax.bid"
  media_public_url     = "https://lax-media.lon1.cdn.digitaloceanspaces.com"
  cdn_public_url       = "https://cdn.lax.bid"

  domain = {
    web   = "lax.bid"
    api   = "api.lax.bid"
    auth  = "auth.lax.bid"
    ws    = "ws.lax.bid"
    event = "event.lax.bid"
    media = "media.lax.bid"
    gtm   = "gtm.lax.bid"
  }

  sgtm_endpoint_url = "https://${local.domain.gtm}"
}

resource "random_password" "better_auth_secret" {
  length  = 48
  special = false
}

# Persisted in TF state so List-Unsubscribe links remain valid across applies. Rotation requires
# a deliberate `terraform taint` of this resource (or supplying a new TF_VAR_email_unsubscribe_secret).
resource "random_password" "email_unsubscribe_secret" {
  length  = 48
  special = false
}

resource "random_password" "check_in_token_secret" {
  length  = 48
  special = false
}

locals {
  effective_better_auth_secret       = var.better_auth_secret != "" ? var.better_auth_secret : random_password.better_auth_secret.result
  effective_check_in_token_secret    = var.check_in_token_secret != "" ? var.check_in_token_secret : random_password.check_in_token_secret.result
  effective_spaces_access_key_id     = var.spaces_access_key_id != "" ? var.spaces_access_key_id : "pending-media-spaces-access-key"
  effective_spaces_secret_key        = var.spaces_secret_access_key != "" ? var.spaces_secret_access_key : "pending-media-spaces-secret-key"
  effective_shopify_webhook_secret   = var.shopify_webhook_secret != "" ? var.shopify_webhook_secret : "pending-shopify-webhook-secret"
  effective_wordpress_secret         = var.wordpress_webhook_secret != "" ? var.wordpress_webhook_secret : "pending-wordpress-webhook-secret"
  effective_email_unsubscribe_secret = var.email_unsubscribe_secret != "" ? var.email_unsubscribe_secret : random_password.email_unsubscribe_secret.result

  common_secret_env = [
    { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
    { key = "APP_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
    { key = "LOG_LEVEL", value = "info", type = "GENERAL", scope = "RUN_TIME" },
    { key = "COOKIE_DOMAIN", value = local.cookie_domain, type = "GENERAL", scope = "RUN_TIME" },
    { key = "BETTER_AUTH_SECRET", value = local.effective_better_auth_secret, type = "SECRET", scope = "RUN_TIME" },
    { key = "GOOGLE_CLIENT_ID", value = var.google_client_id, type = "SECRET", scope = "RUN_TIME" },
    { key = "GOOGLE_CLIENT_SECRET", value = var.google_client_secret, type = "SECRET", scope = "RUN_TIME" },
    { key = "APPLE_CLIENT_ID", value = var.apple_client_id, type = "SECRET", scope = "RUN_TIME" },
    { key = "APPLE_CLIENT_SECRET", value = var.apple_client_secret, type = "SECRET", scope = "RUN_TIME" }
  ]

  # Email env shared by api / auth / worker. POSTMARK_SERVER_TOKEN is enforced by the app-side
  # superRefine when EMAIL_PROVIDER=postmark; the prod default IS postmark so the token MUST be supplied.
  email_common_env = [
    { key = "EMAIL_PROVIDER", value = var.email_provider, type = "GENERAL", scope = "RUN_TIME" },
    { key = "EMAIL_FROM", value = var.email_from, type = "GENERAL", scope = "RUN_TIME" },
    { key = "EMAIL_REPLY_TO", value = var.email_reply_to, type = "GENERAL", scope = "RUN_TIME" },
    { key = "POSTMARK_TRANSACTIONAL_STREAM", value = var.postmark_transactional_stream, type = "GENERAL", scope = "RUN_TIME" },
    { key = "POSTMARK_BROADCAST_STREAM", value = var.postmark_broadcast_stream, type = "GENERAL", scope = "RUN_TIME" },
    { key = "POSTMARK_SERVER_TOKEN", value = var.postmark_server_token, type = "SECRET", scope = "RUN_TIME" },
  ]

  # Twilio Verify — phone OTP for profile verification and phone sign-in (apps/api + apps/auth).
  # When enable_phone_verification=true, apps refuse to start without the Twilio credentials below.
  phone_verification_common_env = [
    { key = "ENABLE_PHONE_VERIFICATION", value = var.enable_phone_verification, type = "GENERAL", scope = "RUN_TIME" },
    { key = "TWILIO_ACCOUNT_SID", value = var.twilio_account_sid, type = "SECRET", scope = "RUN_TIME" },
    { key = "TWILIO_VERIFY_SERVICE_SID", value = var.twilio_verify_service_sid, type = "SECRET", scope = "RUN_TIME" },
    { key = "TWILIO_API_KEY_SID", value = var.twilio_api_key_sid, type = "SECRET", scope = "RUN_TIME" },
    { key = "TWILIO_API_KEY_SECRET", value = var.twilio_api_key_secret, type = "SECRET", scope = "RUN_TIME" },
  ]

  # Organisation module kill switch — must stay in sync with infra/web-build/prod.env.
  org_module_hidden_env_web = var.org_module_hidden ? [
    { key = "NEXT_PUBLIC_FORCE_ORG_MODULE", value = "hidden", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
  ] : []
  org_module_hidden_env_api = var.org_module_hidden ? [
    { key = "FORCE_ORG_MODULE", value = "hidden", type = "GENERAL", scope = "RUN_TIME" },
  ] : []
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
  source          = "../../modules/redis-cluster"
  name            = "lax-${local.environment}-redis"
  environment     = local.environment
  region          = local.redis_region
  size            = "db-s-1vcpu-2gb"
  node_count      = 2
  eviction_policy = "noeviction"
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
      name            = "web"
      kind            = "service"
      source_dir      = "/"
      dockerfile_path = "apps/web/Dockerfile"
      # web is prebuilt in CI (build args from infra/web-build/prod.env) and pushed
      # to DOCR, so it inherits var.app_deploy_source like the other components.
      # The NEXT_PUBLIC_* env entries below now act as RUN_TIME values.
      http_port         = 3000
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/api/health"
      domain            = local.domain.web
      primary_domain    = true
      env = concat(local.common_secret_env, local.sentry_env_for["web"], local.org_module_hidden_env_web, [
        { key = "NEXT_PUBLIC_API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_AUTH_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_WS_URL", value = local.ws_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_MEDIA_BASE_URL", value = local.media_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS", value = "true", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_GTM_ID", value = var.next_public_gtm_id, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_GA4_MEASUREMENT_ID", value = var.next_public_ga4_measurement_id, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED", value = var.next_public_marketing_attribution_enabled, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "INTERNAL_API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "PLATFORM_CATALOG_LEGAL_ENTITY_ID", value = "30000000-0000-4000-9000-000000000001", type = "GENERAL", scope = "RUN_TIME" },
        { key = "NEXT_PUBLIC_WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_COOKIE_DOMAIN", value = local.cookie_domain, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_TURNSTILE_SITE_KEY", value = var.turnstile_site_key, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "CSP_ENFORCE", value = var.csp_enforce, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "NEXT_PUBLIC_CSP_REPORT_URI", value = var.next_public_csp_report_uri, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" }
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
      env = concat(local.common_secret_env, local.email_common_env, local.phone_verification_common_env, local.sentry_env_for["api"], local.org_module_hidden_env_api, [
        { key = "DATABASE_URL", value = local.database_url_api, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_API", value = local.database_url_api, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_AUTH", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_POOL_MAX", value = "8", type = "GENERAL", scope = "RUN_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_PUBLIC_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OIDC_ISSUER_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGINS", value = local.cors_allowed_origins, type = "GENERAL", scope = "RUN_TIME" },
        { key = "STORAGE_DRIVER", value = "s3", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_BUCKET", value = "lax-media", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_REGION", value = local.region, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ENDPOINT", value = "https://${local.region}.digitaloceanspaces.com", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_PUBLIC_BASE_URL", value = local.media_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ACCESS_KEY_ID", value = local.effective_spaces_access_key_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "S3_SECRET_ACCESS_KEY", value = local.effective_spaces_secret_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "SHOPIFY_WEBHOOK_SECRET", value = local.effective_shopify_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "WORDPRESS_WEBHOOK_SECRET", value = local.effective_wordpress_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "POSTMARK_WEBHOOK_BASIC_AUTH", value = var.postmark_webhook_basic_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "BREVO_WEBHOOK_SECRET", value = var.brevo_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "EMAIL_UNSUBSCRIBE_SECRET", value = local.effective_email_unsubscribe_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "REQUIRE_EMAIL_VERIFICATION", value = var.require_email_verification, type = "GENERAL", scope = "RUN_TIME" },
        { key = "ENABLE_WHATSAPP_CHANNEL", value = var.enable_whatsapp_channel, type = "GENERAL", scope = "RUN_TIME" },
        { key = "VAPID_PUBLIC_KEY", value = var.vapid_public_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VAPID_PRIVATE_KEY", value = var.vapid_private_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VAPID_SUBJECT", value = var.vapid_subject, type = "GENERAL", scope = "RUN_TIME" },
        { key = "ENGLISH_ONLY_AUCTIONS", value = "true", type = "GENERAL", scope = "RUN_TIME" },
        { key = "ENABLE_BULL_BOARD", value = "true", type = "GENERAL", scope = "RUN_TIME" },
        { key = "PLATFORM_CATALOG_LEGAL_ENTITY_ID", value = "30000000-0000-4000-9000-000000000001", type = "GENERAL", scope = "RUN_TIME" },
        { key = "STRIPE_SECRET_KEY", value = var.stripe_secret_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "STRIPE_PUBLISHABLE_KEY", value = var.stripe_publishable_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VERIFF_API_KEY", value = var.veriff_api_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VERIFF_SHARED_SECRET", value = var.veriff_shared_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "VERIFF_API_BASE_URL", value = var.veriff_api_base_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "STRIPE_CONNECT_WEBHOOK_SECRET", value = var.stripe_connect_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "STRIPE_TRANSFERS_WEBHOOK_SECRET", value = var.stripe_transfers_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "STRIPE_PAYMENTS_WEBHOOK_SECRET", value = var.stripe_payments_webhook_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "CRON_INTERNAL_SECRET", value = var.cron_internal_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "KYC_THRESHOLD_AMOUNT", value = var.kyc_threshold_amount, type = "GENERAL", scope = "RUN_TIME" },
        { key = "KYC_THRESHOLD_CURRENCY", value = var.kyc_threshold_currency, type = "GENERAL", scope = "RUN_TIME" },
        { key = "CHECK_IN_TOKEN_SECRET", value = local.effective_check_in_token_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "INVITE_EMAIL_FROM", value = var.invite_email_from, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OPS_SUPPORT_EMAIL", value = var.ops_support_email, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OPS_ONCALL_EMAIL", value = var.ops_oncall_email, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_CLIENT_ID", value = var.xero_client_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "XERO_CLIENT_SECRET", value = var.xero_client_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "XERO_REDIRECT_URI", value = var.xero_redirect_uri, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_WEBHOOK_KEY", value = var.xero_webhook_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "XERO_DEFAULT_REVENUE_ACCOUNT_CODE", value = var.xero_default_revenue_account_code, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_DEFAULT_TAX_TYPE", value = var.xero_default_tax_type, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_INVOICE_DUE_DAYS", value = var.xero_invoice_due_days, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_INVOICE_BLOCKING", value = var.xero_invoice_blocking, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_POST_CONNECT_WEB_REDIRECT", value = var.xero_post_connect_web_redirect, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_USE_LEGAL_ENTITY_CONTACT", value = var.xero_use_legal_entity_contact, type = "GENERAL", scope = "RUN_TIME" },
        { key = "XERO_PAYOUT_BILL_ACCOUNT_CODE", value = var.xero_payout_bill_account_code, type = "GENERAL", scope = "RUN_TIME" },
        { key = "AUTH_DEK_KEY", value = var.auth_dek_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "TURNSTILE_SECRET_KEY", value = var.turnstile_secret_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VERIFY_ORIGIN", value = var.verify_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "SSR_TRUSTED_ORIGINS", value = var.ssr_trusted_origins, type = "GENERAL", scope = "RUN_TIME" },
        { key = "SGTM_ENDPOINT_URL", value = local.sgtm_endpoint_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "META_PIXEL_ID", value = var.meta_pixel_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "META_CAPI_ACCESS_TOKEN", value = var.meta_capi_access_token, type = "SECRET", scope = "RUN_TIME" },
        { key = "META_CAPI_TEST_EVENT_CODE", value = var.meta_capi_test_event_code, type = "SECRET", scope = "RUN_TIME" },
        { key = "GA4_MEASUREMENT_ID", value = var.ga4_measurement_id, type = "GENERAL", scope = "RUN_TIME" },
        { key = "MARKETING_ATTRIBUTION_ENABLED", value = var.marketing_attribution_enabled, type = "GENERAL", scope = "RUN_TIME" }
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
      env = concat(local.common_secret_env, local.email_common_env, local.phone_verification_common_env, local.sentry_env_for["auth"], [
        { key = "DATABASE_URL", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_AUTH", value = local.database_url_auth, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        # Required: apps/auth uses Redis to push BullMQ jobs from the Better Auth send-verification /
        # send-reset-password / databaseHooks.user.create.after hooks via IEmailService.enqueue().
        { key = "DATABASE_POOL_MAX", value = "8", type = "GENERAL", scope = "RUN_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "API_PUBLIC_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "OIDC_ISSUER_URL", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGINS", value = local.cors_allowed_origins, type = "GENERAL", scope = "RUN_TIME" },
        { key = "APPLE_DOMAIN_ASSOCIATION", value = var.apple_domain_association, type = "SECRET", scope = "RUN_TIME" },
        { key = "REQUIRE_EMAIL_VERIFICATION", value = var.require_email_verification, type = "GENERAL", scope = "RUN_TIME" },
        { key = "AUTH_DEK_KEY", value = var.auth_dek_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "VERIFY_ORIGIN", value = var.verify_origin, type = "GENERAL", scope = "RUN_TIME" }
      ])
    },
    {
      name              = "ws"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/ws/Dockerfile"
      http_port         = 3002
      instance_size     = "professional-xs"
      instance_count    = 3
      health_check_path = "/health/live"
      domain            = local.domain.ws
      primary_domain    = false
      env = concat(
        [
          { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
          { key = "APP_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
          { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
          { key = "API_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
          { key = "OIDC_ISSUER", value = local.oidc_issuer_url, type = "GENERAL", scope = "RUN_TIME" },
          { key = "JWKS_URL", value = "${local.oidc_issuer_url}/.well-known/jwks.json", type = "GENERAL", scope = "RUN_TIME" },
          { key = "CORS_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
          { key = "LEGACY_WS_COOKIE_RELAY", value = "false", type = "GENERAL", scope = "RUN_TIME" },
        ],
        local.sentry_env_for["ws"],
      )
    },
    {
      name              = "event"
      kind              = "service"
      source_dir        = "/"
      dockerfile_path   = "apps/event/Dockerfile"
      http_port         = 80
      instance_size     = "professional-xs"
      instance_count    = 2
      health_check_path = "/"
      domain            = local.domain.event
      primary_domain    = false
      env = [
        { key = "VITE_API_BASE", value = local.api_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "VITE_WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "VITE_EVENT_ORIGIN", value = local.event_origin, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "VITE_CDN_BASE", value = local.cdn_public_url, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
      ]
    },
    {
      name            = "clamav"
      kind            = "service"
      source_dir      = "/"
      dockerfile_path = "apps/clamav/Dockerfile"
      # 4 GiB dedicated (~$49/mo). ClamAV holds the full signature DB in RAM (~1.5-2 GB)
      # and briefly doubles it during a reload; 2 GB risks OOM.
      instance_size                      = "apps-d-1vcpu-4gb"
      instance_count                     = 1
      internal_ports                     = [9000]
      health_check_path                  = "/"
      health_check_initial_delay_seconds = 180
      health_check_period_seconds        = 30
      env                                = []
    },
    {
      name            = "worker"
      kind            = "worker"
      source_dir      = "/"
      dockerfile_path = "apps/worker/Dockerfile"
      instance_size   = "professional-xs"
      instance_count  = 1
      env = concat(local.email_common_env, local.sentry_env_for["worker"], [
        { key = "NODE_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "APP_ENV", value = "production", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "DATABASE_URL", value = local.database_url_worker, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_URL_WORKER", value = local.database_url_worker, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_CA_CERT", value = module.postgres.ca_certificate, type = "SECRET", scope = "RUN_TIME" },
        { key = "DATABASE_POOL_MAX", value = "8", type = "GENERAL", scope = "RUN_TIME" },
        { key = "REDIS_URL", value = module.redis.uri, type = "SECRET", scope = "RUN_TIME" },
        { key = "LOG_LEVEL", value = "info", type = "GENERAL", scope = "RUN_TIME" },
        { key = "STORAGE_DRIVER", value = "s3", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_BUCKET", value = "lax-media", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_REGION", value = local.region, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ENDPOINT", value = "https://${local.region}.digitaloceanspaces.com", type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_PUBLIC_BASE_URL", value = local.media_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "S3_ACCESS_KEY_ID", value = local.effective_spaces_access_key_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "S3_SECRET_ACCESS_KEY", value = local.effective_spaces_secret_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "ZOHO_CAMPAIGNS_API_KEY", value = var.zoho_campaigns_api_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "ZOHO_CAMPAIGNS_LIST_KEY", value = var.zoho_campaigns_list_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "MARKETING_CONTACT_SYNC_PROVIDER", value = "brevo", type = "GENERAL", scope = "RUN_TIME" },
        { key = "BREVO_API_KEY", value = var.brevo_api_key, type = "SECRET", scope = "RUN_TIME" },
        { key = "BREVO_LIST_ID", value = var.brevo_list_id, type = "GENERAL", scope = "RUN_TIME" },
        { key = "CRON_INTERNAL_SECRET", value = var.cron_internal_secret, type = "SECRET", scope = "RUN_TIME" },
        { key = "ADMIN_EMAIL_ADDRESS", value = var.admin_email_address, type = "GENERAL", scope = "RUN_TIME" },
        { key = "API_INTERNAL_BASE_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "API_PUBLIC_URL", value = local.api_public_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "WEB_ORIGIN", value = local.web_origin, type = "GENERAL", scope = "RUN_TIME" },
        { key = "SGTM_ENDPOINT_URL", value = local.sgtm_endpoint_url, type = "GENERAL", scope = "RUN_TIME" },
        { key = "META_PIXEL_ID", value = var.meta_pixel_id, type = "SECRET", scope = "RUN_TIME" },
        { key = "META_CAPI_ACCESS_TOKEN", value = var.meta_capi_access_token, type = "SECRET", scope = "RUN_TIME" },
        { key = "META_CAPI_TEST_EVENT_CODE", value = var.meta_capi_test_event_code, type = "SECRET", scope = "RUN_TIME" },
        { key = "GA4_MEASUREMENT_ID", value = var.ga4_measurement_id, type = "GENERAL", scope = "RUN_TIME" },
        { key = "MARKETING_EVENT_WORKER_CONCURRENCY", value = "5", type = "GENERAL", scope = "RUN_TIME" },
        { key = "CLAMAV_URL", value = "http://clamav:9000", type = "GENERAL", scope = "RUN_TIME" }
      ])
    },
    {
      name            = "migrate"
      kind            = "job"
      source_dir      = "/"
      dockerfile_path = "docker/migrate.Dockerfile"
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
  branch               = var.app_git_branch
  deploy_source        = var.app_deploy_source
  image_tag            = var.app_image_tag
  components           = local.components
  path_routes = [
    {
      authority   = local.domain.web
      path_prefix = "/q"
      component   = "api"
    },
  ]
  depends_on = [module.postgres_rbac]
}

module "monitoring" {
  source              = "../../modules/monitoring"
  environment         = local.environment
  alert_email         = var.ops_alert_email
  postgres_cluster_id = module.postgres.id
  redis_cluster_id    = module.redis.id
  uptime_targets = {
    web   = "https://${local.domain.web}/"
    api   = "https://${local.domain.api}/health/live"
    auth  = "https://${local.domain.auth}/health/live"
    ws    = "https://${local.domain.ws}/health/live"
    event = "https://${local.domain.event}/"
    gtm   = "https://${local.domain.gtm}/healthy"
  }
}
