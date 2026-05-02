variable "environment" {
  type = string
}
variable "alert_email" {
  type = string
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
