terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.43.0"
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

resource "sentry_issue_alert" "high_error_count" {
  for_each = var.project_slugs

  organization = var.organization_slug
  project      = each.value
  name         = "High error volume"
  action_match = "all"
  filter_match = "all"
  frequency    = 30

  conditions = [{ id = "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" }]
  actions    = [{ id = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction", service = "mail" }]
}
