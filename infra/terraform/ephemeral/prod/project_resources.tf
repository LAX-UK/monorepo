data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "lax-tf-state"
    region = "lon1"
    key    = "persistent-prod/terraform.tfstate"
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
  do_project_id_from_state = try(data.terraform_remote_state.persistent.outputs.digitalocean_project_id, "")
  do_project_id            = var.digitalocean_project_id != "" ? var.digitalocean_project_id : local.do_project_id_from_state
}

resource "digitalocean_project_resources" "managed_stack" {
  lifecycle {
    precondition {
      condition     = local.do_project_id != ""
      error_message = "digitalocean_project_id is missing: apply infra/terraform/persistent/prod once (terraform apply) so remote state exports it, or set TF_VAR_digitalocean_project_id to the project UUID from DigitalOcean."
    }
  }

  project = local.do_project_id
  resources = [
    module.postgres.urn,
    module.redis.urn,
    module.app.urn,
  ]
}
