locals {
  managed_tags = {
    environment = var.environment
    managed_by  = "terraform"
  }
}
