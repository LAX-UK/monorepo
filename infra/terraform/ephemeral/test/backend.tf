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
