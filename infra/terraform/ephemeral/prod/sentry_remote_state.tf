variable "enable_sentry_remote_state" {
  type        = bool
  default     = true
  description = "Read DSN outputs from sentry/prod remote state. Set false when the sentry layer has not been applied yet."
}

data "terraform_remote_state" "sentry" {
  count = var.enable_sentry_remote_state ? 1 : 0

  backend = "s3"
  config = {
    bucket = "lax-tf-state"
    region = "lon1"
    key    = "sentry-prod/terraform.tfstate"
    endpoints = {
      s3 = "https://lon1.digitaloceanspaces.com"
    }

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true

    use_path_style = false
  }
}

locals {
  sentry_dsns        = var.enable_sentry_remote_state ? try(nonsensitive(data.terraform_remote_state.sentry[0].outputs.dsns), {}) : {}
  sentry_app_config  = var.enable_sentry_remote_state ? try(data.terraform_remote_state.sentry[0].outputs.app_config, {}) : {}
  sentry_cron_slugs  = var.enable_sentry_remote_state ? try(jsonencode(data.terraform_remote_state.sentry[0].outputs.cron_slugs), "{}") : "{}"
  sentry_runtime_env = local.environment == "prod" ? "production" : "test"
  sentry_dsn_env_keys = {
    web    = "SENTRY_DSN_WEB"
    api    = "SENTRY_DSN_API"
    auth   = "SENTRY_DSN_AUTH"
    ws     = "SENTRY_DSN_WS"
    worker = "SENTRY_DSN_WORKER"
  }

  sentry_common_env = [
    { key = "SENTRY_ENVIRONMENT", value = local.sentry_runtime_env, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
    { key = "SENTRY_ORG", value = var.sentry_organization_slug, type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
    {
      key   = "SENTRY_RELEASE"
      value = var.sentry_release != "" ? var.sentry_release : "$${_self.COMMIT_HASH}"
      type  = "GENERAL"
      scope = "RUN_AND_BUILD_TIME"
    },
  ]

  sentry_build_env = var.sentry_auth_token != "" ? [
    { key = "SENTRY_AUTH_TOKEN", value = var.sentry_auth_token, type = "SECRET", scope = "RUN_AND_BUILD_TIME" },
  ] : []

  _sentry_env_configured = {
    for app, cfg in local.sentry_app_config : app => concat(
      local.sentry_common_env,
      local.sentry_build_env,
      lookup(local.sentry_dsns, app, "") != "" ? [
        { key = local.sentry_dsn_env_keys[app], value = local.sentry_dsns[app], type = "SECRET", scope = "RUN_TIME" },
      ] : [],
      app == "web" && lookup(local.sentry_dsns, "web", "") != "" ? [
        { key = "NEXT_PUBLIC_SENTRY_DSN_WEB", value = local.sentry_dsns["web"], type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
        { key = "SENTRY_PROJECT", value = "lax-${local.environment}-web", type = "GENERAL", scope = "RUN_AND_BUILD_TIME" },
      ] : [],
      [
        { key = "SENTRY_TRACES_SAMPLE_RATE", value = tostring(cfg.traces_sample_rate), type = "GENERAL", scope = "RUN_TIME" },
        { key = "SENTRY_PROFILES_SAMPLE_RATE", value = tostring(cfg.profiles_sample_rate), type = "GENERAL", scope = "RUN_TIME" },
      ],
      app == "worker" ? [
        { key = "SENTRY_MONITOR_SLUGS", value = local.sentry_cron_slugs, type = "GENERAL", scope = "RUN_TIME" },
      ] : [],
    )
  }

  sentry_env_for = {
    for app in ["web", "api", "auth", "ws", "worker"] : app => lookup(local._sentry_env_configured, app, [])
  }
}
