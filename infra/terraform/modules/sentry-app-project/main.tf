resource "sentry_project" "this" {
  organization  = var.organization_slug
  teams         = [var.team_slug]
  name          = var.project_name
  slug          = var.project_name
  platform      = var.platform
  default_rules = false
  default_key   = false
}

resource "sentry_key" "this" {
  organization      = var.organization_slug
  project           = sentry_project.this.slug
  name              = "terraform-${var.app_key}"
  rate_limit_count  = var.rate_limit_count
  rate_limit_window = var.rate_limit_window
}

resource "sentry_project_inbound_data_filter" "this" {
  for_each = var.inbound_filters

  organization = var.organization_slug
  project      = sentry_project.this.id
  filter_id    = each.value
  active       = true
}

resource "sentry_organization_code_mapping" "app" {
  organization   = var.organization_slug
  integration_id = var.github_integration_id
  repository_id  = var.github_repository_id
  project_id     = sentry_project.this.internal_id
  default_branch = "main"
  stack_root     = "/"
  source_root    = "apps/${var.app_key}/"
}

resource "sentry_organization_code_mapping" "packages" {
  organization   = var.organization_slug
  integration_id = var.github_integration_id
  repository_id  = var.github_repository_id
  project_id     = sentry_project.this.internal_id
  default_branch = "main"
  stack_root     = "/"
  source_root    = "packages/"
}
