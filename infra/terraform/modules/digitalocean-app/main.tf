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

locals {
  _components = nonsensitive(var.components)
  services    = { for c in local._components : c.name => c if c.kind == "service" }
  workers     = { for c in local._components : c.name => c if c.kind == "worker" }
  jobs        = { for c in local._components : c.name => c if c.kind == "job" }
  domains     = { for c in local._components : c.name => c if try(c.domain, null) != null }
}

resource "digitalocean_app" "this" {
  spec {
    name   = var.name
    region = var.region

    dynamic "service" {
      for_each = local.services

      content {
        name               = service.value.name
        source_dir         = service.value.source_dir
        dockerfile_path    = service.value.dockerfile_path
        http_port          = service.value.http_port
        instance_size_slug = service.value.instance_size
        instance_count     = service.value.instance_count

        git {
          repo_clone_url = var.repository_clone_url
          branch         = var.branch
        }

        dynamic "env" {
          for_each = { for env in service.value.env : env.key => env }

          content {
            key   = env.value.key
            value = env.value.value
            type  = env.value.type
            scope = env.value.scope
          }
        }

        dynamic "health_check" {
          for_each = service.value.health_check_path == null ? [] : [service.value.health_check_path]

          content {
            http_path = health_check.value
          }
        }
      }
    }

    dynamic "worker" {
      for_each = local.workers

      content {
        name               = worker.value.name
        source_dir         = worker.value.source_dir
        dockerfile_path    = worker.value.dockerfile_path
        instance_size_slug = worker.value.instance_size
        instance_count     = worker.value.instance_count

        git {
          repo_clone_url = var.repository_clone_url
          branch         = var.branch
        }

        dynamic "env" {
          for_each = { for env in worker.value.env : env.key => env }

          content {
            key   = env.value.key
            value = env.value.value
            type  = env.value.type
            scope = env.value.scope
          }
        }
      }
    }

    dynamic "job" {
      for_each = local.jobs

      content {
        name               = job.value.name
        source_dir         = job.value.source_dir
        dockerfile_path    = job.value.dockerfile_path
        instance_size_slug = job.value.instance_size
        instance_count     = 1
        kind               = "PRE_DEPLOY"
        run_command        = coalesce(job.value.run_command, "pnpm db:migrate:prod")

        git {
          repo_clone_url = var.repository_clone_url
          branch         = var.branch
        }

        dynamic "env" {
          for_each = { for env in job.value.env : env.key => env }

          content {
            key   = env.value.key
            value = env.value.value
            type  = env.value.type
            scope = env.value.scope
          }
        }
      }
    }

    dynamic "domain" {
      for_each = local.domains

      content {
        name = domain.value.domain
        type = try(domain.value.primary_domain, false) ? "PRIMARY" : "ALIAS"
        zone = "lax.bid"
      }
    }
  }
}
