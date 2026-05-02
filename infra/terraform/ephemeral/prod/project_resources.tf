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

data "digitalocean_projects" "all" {}

locals {
  do_project_expected_name     = "lax-prod-project"
  do_project_id_from_state     = try(data.terraform_remote_state.persistent.outputs.digitalocean_project_id, "")
  do_project_ids_matching_name = [for p in data.digitalocean_projects.all.projects : p.id if p.name == local.do_project_expected_name]
  do_project_id_from_api       = length(local.do_project_ids_matching_name) > 0 ? local.do_project_ids_matching_name[0] : ""
  do_project_id = var.digitalocean_project_id != "" ? var.digitalocean_project_id : (
    local.do_project_id_from_state != "" ? local.do_project_id_from_state : local.do_project_id_from_api
  )
}

resource "digitalocean_project_resources" "managed_stack" {
  lifecycle {
    precondition {
      condition     = local.do_project_id != ""
      error_message = "Could not resolve the DO project id. Set TF_VAR_digitalocean_project_id, apply infra/terraform/persistent/prod so remote state exports digitalocean_project_id, or create a project named \"lax-prod-project\" (Terraform persistent stack)."
    }
  }

  project = local.do_project_id
  resources = [
    module.postgres.urn,
    module.redis.urn,
    module.app.urn,
  ]
}
