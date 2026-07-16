# --- SPA static hosting (dashboard + admin) ---
output "spa_bucket_name" {
  description = "S3 bucket hosting the dashboard/admin SPA bundles"
  value       = aws_s3_bucket.spa.id
}

output "spa_cloudfront_domain" {
  description = "CloudFront domain serving the SPA"
  value       = aws_cloudfront_distribution.spa.domain_name
}

output "spa_cloudfront_distribution_id" {
  description = "SPA CloudFront distribution id (for cache invalidations)"
  value       = aws_cloudfront_distribution.spa.id
}

output "github_actions_role_arn" {
  description = "IAM role assumed by GitHub Actions to deploy the SPA"
  value       = aws_iam_role.github_actions_spa_deploy.arn
}

# --- Media CDN ---
output "media_bucket_name" {
  description = "S3 bucket storing user-uploaded media"
  value       = aws_s3_bucket.media.id
}

output "media_cloudfront_domain" {
  description = "CloudFront domain for media — set PUBLIC_MEDIA_BASE_URL / VITE_PUBLIC_MEDIA_BASE_URL to https://<this>"
  value       = aws_cloudfront_distribution.media.domain_name
}

# --- Compute / entrypoints ---
output "alb_dns_name" {
  description = "Public DNS of the app load balancer (point the app domain here)"
  value       = aws_lb.web.dns_name
}

output "ecr_web_repository_url" {
  description = "ECR repo for the Next.js + API image"
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_worker_repository_url" {
  description = "ECR repo for the bullground worker image"
  value       = aws_ecr_repository.worker.repository_url
}

# --- Data stores (endpoints; credentials live in Secrets Manager) ---
output "rds_endpoint" {
  description = "RDS Postgres endpoint"
  value       = aws_db_instance.main.address
}

output "valkey_primary_endpoint" {
  description = "ElastiCache Valkey primary endpoint (BullMQ)"
  value       = aws_elasticache_replication_group.valkey.primary_endpoint_address
}

output "opensearch_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.main.endpoint
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN holding the full DATABASE_URL"
  value       = aws_secretsmanager_secret.database_url.arn
}
