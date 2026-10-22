terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 7.45, < 8.0"
    }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
}
resource "google_project_service" "api" {
  for_each           = toset(["run.googleapis.com", "cloudtasks.googleapis.com", "cloudscheduler.googleapis.com", "secretmanager.googleapis.com", "iamcredentials.googleapis.com", "texttospeech.googleapis.com"])
  service            = each.value
  disable_on_destroy = false
}
resource "google_service_account" "worker" { account_id = "business-hub-mkt-worker" }
resource "google_service_account" "task" { account_id = "business-hub-mkt-task" }
resource "google_service_account" "scheduler" { account_id = "business-hub-mkt-scheduler" }

resource "google_storage_bucket" "assets" {
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  cors {
    origin          = [trimsuffix(var.app_origin, "/")]
    method          = ["PUT", "GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 600
  }
}
resource "google_storage_bucket_iam_member" "assets" {
  for_each = { worker = google_service_account.worker.email, vercel = var.vercel_service_account }
  bucket   = google_storage_bucket.assets.name
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${each.value}"
}
resource "google_project_iam_member" "worker_db" {
  for_each = toset(["roles/datastore.user", "roles/firebaseauth.viewer"])
  role     = each.value
  member   = "serviceAccount:${google_service_account.worker.email}"
  project  = var.project_id
}
resource "google_secret_manager_secret_iam_member" "gemini" {
  secret_id  = var.gemini_secret_name
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.worker.email}"
  depends_on = [google_project_service.api]
}
resource "google_cloud_tasks_queue" "marketing" {
  name     = "business-hub-marketing"
  location = var.region
  rate_limits {
    max_concurrent_dispatches = 1
    max_dispatches_per_second = 1
  }
  retry_config {
    max_attempts       = 3
    min_backoff        = "30s"
    max_backoff        = "300s"
    max_retry_duration = "3600s"
  }
  depends_on = [google_project_service.api]
}
resource "google_cloud_tasks_queue_iam_member" "enqueue" {
  for_each = { worker = google_service_account.worker.email, vercel = var.vercel_service_account }
  name     = google_cloud_tasks_queue.marketing.name
  location = var.region
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${each.value}"
}
resource "google_service_account_iam_member" "act_as_task" {
  for_each           = { worker = google_service_account.worker.email, vercel = var.vercel_service_account }
  service_account_id = google_service_account.task.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${each.value}"
}
resource "google_cloud_run_v2_service" "worker" {
  name                = "business-hub-marketing"
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"
  template {
    service_account                  = google_service_account.worker.email
    timeout                          = "900s"
    max_instance_request_concurrency = 1
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
    containers {
      image = var.worker_image
      resources {
        limits   = { cpu = "2", memory = "2Gi" }
        cpu_idle = true
      }
      dynamic "env" {
        for_each = {
          FIREBASE_PROJECT_ID          = var.project_id
          FIREBASE_USE_ADC             = "true"
          MARKETING_ENABLED            = tostring(var.enable_generation)
          MARKETING_GENERATION_ENABLED = tostring(var.enable_generation)
          MARKETING_BUCKET             = google_storage_bucket.assets.name
          MARKETING_QUEUE              = google_cloud_tasks_queue.marketing.id
          MARKETING_WORKER_URL         = var.worker_url
          MARKETING_TASK_SA            = google_service_account.task.email
          MARKETING_SCHEDULER_SA       = google_service_account.scheduler.email
          MARKETING_ORIGIN             = var.app_origin
          MARKETING_TEXT_MODEL         = "gemini-3.1-flash-lite"
          MARKETING_IMAGE_MODEL        = "gemini-3.1-flash-lite-image"
          MARKETING_TTS_VOICE          = var.tts_voice
          MARKETING_PRICES_VALID_UNTIL = var.prices_valid_until
        }
        content {
          name  = env.key
          value = env.value
        }
      }
      env {
        name = "MARKETING_GEMINI_KEY"
        value_source {
          secret_key_ref {
            secret  = var.gemini_secret_name
            version = "latest"
          }
        }
      }
    }
  }
  depends_on = [google_project_service.api, google_secret_manager_secret_iam_member.gemini]
}
resource "google_cloud_run_v2_service_iam_member" "invoke" {
  name     = google_cloud_run_v2_service.worker.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.task.email}"
}
resource "google_cloud_scheduler_job" "marketing" {
  for_each         = var.enable_scheduler ? { prepare = "0 20 * * *", notify = "0 8 * * *" } : {}
  name             = "business-hub-marketing-${each.key}"
  region           = var.region
  schedule         = each.value
  time_zone        = "Asia/Ho_Chi_Minh"
  attempt_deadline = "60s"
  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_retry_duration   = "1800s"
  }
  http_target {
    uri         = "${trimsuffix(var.app_origin, "/")}/api/marketing/schedule/${each.key}"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = "${trimsuffix(var.app_origin, "/")}/api/marketing/schedule/${each.key}"
    }
  }
  depends_on = [google_project_service.api]
}
