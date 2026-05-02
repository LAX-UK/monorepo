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

terraform {
  backend "s3" {
    bucket                      = "lax-tf-state"
    key                         = "ephemeral-test/terraform.tfstate"
    region                      = "lon1"
    endpoint                    = "https://lon1.digitaloceanspaces.com"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    force_path_style            = false
  }
}
