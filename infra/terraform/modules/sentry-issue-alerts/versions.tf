terraform {
  required_version = "= 1.9.8"

  required_providers {
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14.13"
    }
  }
}
