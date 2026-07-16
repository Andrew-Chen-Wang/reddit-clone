variable "aws_account_id" {
  description = "AWS account ID to validate against"
  type        = string
  default     = "471112590391"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Short project name, used as a prefix for resource names"
  type        = string
  default     = "readit"
}

variable "environment" {
  description = "Deployment environment (prod, staging, ...)"
  type        = string
  default     = "prod"
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format (for the OIDC deploy role)"
  type        = string
  default     = "Andrew-Chen-Wang/reddit-clone"
}

variable "spa_bucket_name" {
  description = "Name of the S3 bucket that hosts the dashboard/admin SPA bundles"
  type        = string
  default     = "readit-spa-assets"
}

variable "media_bucket_name" {
  description = "Name of the S3 bucket that stores user-uploaded media"
  type        = string
  default     = "readit-media"
}

variable "spa_cors_origin" {
  description = "Allowed browser origin for the SPA/media CORS policies (the app's public URL)"
  type        = string
  default     = "https://readit.andrewcwang.com"
}

# --- Networking ---

variable "vpc_cidr" {
  description = "CIDR block for the application VPC"
  type        = string
  default     = "10.40.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across"
  type        = number
  default     = 2
}

# --- RDS Postgres ---

variable "postgres_version" {
  description = "RDS PostgreSQL engine version. NOTE: local dev runs Postgres 18; RDS does not yet offer 18, so prod tracks the latest available major (schema is compatible)."
  type        = string
  default     = "16.8"
}

variable "db_instance_class" {
  description = "RDS instance class (dev-scale default; use a larger, Multi-AZ class in real prod)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name"
  type        = string
  default     = "main"
}

variable "db_username" {
  description = "Master database username"
  type        = string
  default     = "readit"
}

# --- ElastiCache (Valkey — BullMQ backing store only) ---

variable "valkey_node_type" {
  description = "ElastiCache node type for Valkey"
  type        = string
  default     = "cache.t4g.micro"
}

variable "valkey_engine_version" {
  description = "ElastiCache Valkey engine version"
  type        = string
  default     = "8.0"
}

# --- OpenSearch ---

variable "opensearch_engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "OpenSearch_2.13"
}

variable "opensearch_instance_type" {
  description = "OpenSearch data node instance type (dev-scale; use 3 nodes across AZs in real prod)"
  type        = string
  default     = "t3.small.search"
}

variable "opensearch_instance_count" {
  description = "Number of OpenSearch data nodes"
  type        = number
  default     = 1
}

# --- ECS Fargate ---

variable "web_container_port" {
  description = "Port the Next.js server listens on inside the container"
  type        = number
  default     = 3000
}

variable "web_cpu" {
  description = "Fargate CPU units for the web task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Fargate memory (MiB) for the web task"
  type        = number
  default     = 1024
}

variable "web_desired_count" {
  description = "Number of web tasks to run"
  type        = number
  default     = 2
}

variable "worker_cpu" {
  description = "Fargate CPU units for the worker task"
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "Fargate memory (MiB) for the worker task"
  type        = number
  default     = 1024
}

variable "worker_desired_count" {
  description = "Number of worker tasks to run"
  type        = number
  default     = 1
}
