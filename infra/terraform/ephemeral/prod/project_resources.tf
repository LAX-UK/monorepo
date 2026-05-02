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

resource "digitalocean_project_resources" "managed_stack" {
  project = data.terraform_remote_state.persistent.outputs.digitalocean_project_id
  resources = [
    module.postgres.urn,
    module.redis.urn,
    module.app.urn,
  ]
}
