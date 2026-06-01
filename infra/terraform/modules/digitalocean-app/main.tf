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

locals {
  _components = nonsensitive(var.components)
  services    = { for c in local._components : c.name => c if c.kind == "service" }
  workers     = { for c in local._components : c.name => c if c.kind == "worker" }
  jobs        = { for c in local._components : c.name => c if c.kind == "job" }
  domains     = { for c in local._components : c.name => c if try(c.domain, null) != null }

  # Private GitHub repos must use github { ... } (DO GitHub App), not git { repo_clone_url } (unauthenticated HTTPS).
  _repo_from_https = try(regex("^https://github\\.com/([^/]+/[^/.]+)(?:\\.git)?/?$", trimspace(var.repository_clone_url))[0], null)
  _repo_from_ssh   = try(regex("^git@github\\.com:([^/]+/[^/.]+)(?:\\.git)?$", trimspace(var.repository_clone_url))[0], null)
  github_repo = coalesce(
    trimspace(var.github_repo) != "" ? trimspace(var.github_repo) : null,
    local._repo_from_https,
    local._repo_from_ssh,
    "LAX-UK/monorepo",
  )
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

        github {
          repo           = local.github_repo
          branch         = var.branch
          deploy_on_push = false
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

        github {
          repo           = local.github_repo
          branch         = var.branch
          deploy_on_push = false
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
        # The API runner image is `FROM node:22-alpine` without corepack/pnpm,
        # so invoke the compiled migrator with node directly. `packages/db/dist`
        # is produced by turbo `^build` and copied into the runner stage.
        run_command = coalesce(job.value.run_command, "node packages/db/dist/migrate-prod.js")

        github {
          repo           = local.github_repo
          branch         = var.branch
          deploy_on_push = false
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
        # `zone` is intentionally omitted: lax.bid lives on Cloudflare, not DO Networking.
        # Setting `zone` makes DO try DNS-01 against a zone it doesn't control and to verify
        # ownership by resolving the CNAME target (which is Cloudflare anycast through the
        # orange-cloud), so the domain stays PENDING and the edge returns 530.
      }
    }

    # Without host-scoped rules, every HTTP service defaults to path "/" on shared ingress → 400 duplicate prefix.
    ingress {
      dynamic "rule" {
        for_each = var.path_routes

        content {
          component {
            name                 = rule.value.component
            preserve_path_prefix = true
          }
          match {
            authority {
              exact = rule.value.authority
            }
            path {
              prefix = rule.value.path_prefix
            }
          }
        }
      }

      dynamic "rule" {
        for_each = local.domains

        content {
          component {
            name = rule.value.name
          }
          match {
            authority {
              exact = rule.value.domain
            }
            path {
              prefix = "/"
            }
          }
        }
      }
    }
  }
}
