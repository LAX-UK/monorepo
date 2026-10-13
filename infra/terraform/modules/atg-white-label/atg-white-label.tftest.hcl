# Contract: the White Label hostname never exists without the cookie-shield Worker in front of it.
# Run with: cd terraform/modules/atg-white-label && terraform init -backend=false && terraform test

mock_provider "cloudflare" {}

variables {
  account_id = "account"
  zone_id    = "zone"
  zone_name  = "lax.bid"
  origin     = "prod-whitelabel-3.globalauctionplatform.com"
  acm_validation = {
    name  = "_7671667c6e95f0ecab75baae6e6be6c7.auctions"
    value = "_63ea60ce6ca7e4fef3535e32988bcf1d.wzccmgtwzk.acm-validations.aws"
  }
}

run "disabled_by_default" {
  command = plan

  assert {
    condition = (
      length(cloudflare_record.acm_validation) == 0 &&
      length(cloudflare_record.white_label) == 0 &&
      length(cloudflare_workers_script.cookie_shield) == 0 &&
      length(cloudflare_workers_route.cookie_shield) == 0
    )
    error_message = "nothing may be created until the flags are set"
  }
}

run "acm_validation_only" {
  command = plan

  variables {
    acm_validation_enabled = true
  }

  assert {
    condition     = length(cloudflare_record.acm_validation) == 1 && cloudflare_record.acm_validation[0].proxied == false
    error_message = "the ACM validation CNAME must be DNS-only"
  }

  assert {
    condition     = length(cloudflare_record.white_label) == 0
    error_message = "ACM validation alone must not publish the White Label hostname"
  }
}

run "white_label_is_shielded" {
  command = plan

  variables {
    acm_validation_enabled = true
    enabled                = true
  }

  assert {
    condition     = cloudflare_record.white_label[0].proxied == true && cloudflare_record.white_label[0].name == "auctions"
    error_message = "auctions must be proxied, or browsers reach ATG without the Worker"
  }

  assert {
    condition     = cloudflare_workers_route.cookie_shield[0].pattern == "auctions.lax.bid/*"
    error_message = "the Worker route must cover every path on the White Label host"
  }

  assert {
    condition = (
      cloudflare_workers_script.cookie_shield[0].module == true &&
      strcontains(cloudflare_workers_script.cookie_shield[0].content, "LAX_COOKIE_NAME") &&
      cloudflare_workers_route.cookie_shield[0].script_name == cloudflare_workers_script.cookie_shield[0].name
    )
    error_message = "the route must run the cookie-shield module"
  }

  assert {
    condition     = output.hostname == "auctions.lax.bid"
    error_message = "hostname output must reflect the published record"
  }
}
