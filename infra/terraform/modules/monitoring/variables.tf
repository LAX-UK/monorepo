variable "environment" {
  type = string
}
variable "alert_email" {
  type        = string
  default     = ""
  description = "DigitalOcean account–verified address for monitor and uptime alerts. Leave empty to skip alert resources (checks are still created)."
}
variable "postgres_cluster_id" {
  type = string
}
variable "redis_cluster_id" {
  type = string
}
variable "uptime_targets" {
  type = map(string)
}
