terraform {
  backend "s3" {
    bucket = "lax-tf-state"
    key    = "persistent-prod/terraform.tfstate"
    region = "lon1"

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
