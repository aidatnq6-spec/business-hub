variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "asia-southeast1"
}
variable "bucket_name" { type = string }
variable "worker_image" { type = string }
variable "worker_url" {
  type        = string
  default     = ""
  description = "Bootstrap with flags off, obtain Cloud Run URI, then supply the exact URI and reapply."
}
variable "app_origin" { type = string }
variable "vercel_service_account" { type = string }
variable "gemini_secret_name" { type = string }
variable "tts_voice" {
  type    = string
  default = ""
}
variable "prices_valid_until" {
  type    = string
  default = ""
}
variable "enable_generation" {
  type    = bool
  default = false
}
variable "enable_scheduler" {
  type    = bool
  default = false
}
