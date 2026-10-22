output "worker_uri" { value = google_cloud_run_v2_service.worker.uri }
output "queue" { value = google_cloud_tasks_queue.marketing.id }
output "bucket" { value = google_storage_bucket.assets.name }
output "task_service_account" { value = google_service_account.task.email }
output "scheduler_service_account" { value = google_service_account.scheduler.email }
output "scheduler_job_ids" { value = { for k, job in google_cloud_scheduler_job.marketing : k => job.id } }
