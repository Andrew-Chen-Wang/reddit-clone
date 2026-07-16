resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name}/web"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}/worker"
  retention_in_days = 30
  tags              = local.tags
}

locals {
  # Image tags are pushed by CI; plan/apply uses "latest" unless overridden.
  web_image    = "${aws_ecr_repository.web.repository_url}:latest"
  worker_image = "${aws_ecr_repository.worker.repository_url}:latest"

  # Non-secret runtime config shared by both services. PUBLIC_MEDIA_BASE_URL points
  # at the media CloudFront distribution so prod media URLs are served from the CDN,
  # and VITE_PUBLIC_MEDIA_BASE_URL (SPA build) is set to the same value in CI.
  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "VALKEY_URL", value = "redis://${aws_elasticache_replication_group.valkey.primary_endpoint_address}:6379" },
    { name = "ELASTICSEARCH_URL", value = "https://${aws_opensearch_domain.main.endpoint}" },
    { name = "S3_BUCKET_NAME", value = aws_s3_bucket.media.bucket },
    { name = "S3_REGION", value = var.aws_region },
    { name = "PUBLIC_MEDIA_BASE_URL", value = "https://${aws_cloudfront_distribution.media.domain_name}" },
  ]

  app_secrets = [
    { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    { name = "GOOGLE_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.app.arn}:GOOGLE_CLIENT_ID::" },
    { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:GOOGLE_CLIENT_SECRET::" },
  ]
}

# --- Web (Next.js + mounted API) ---
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([{
    name         = "web"
    image        = local.web_image
    essential    = true
    portMappings = [{ containerPort = var.web_container_port, protocol = "tcp" }]
    environment = concat(local.common_env, [
      { name = "NEXT_PUBLIC_HOST_URL", value = "http://${aws_lb.web.dns_name}" },
    ])
    secrets = local.app_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
  }])
  tags = local.tags
}

resource "aws_ecs_service" "web" {
  name            = "${local.name}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.web_container_port
  }
  depends_on = [aws_lb_listener.http]
  tags       = local.tags
}

# --- Worker (bullground BullMQ consumer, no inbound) ---
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([{
    name        = "worker"
    image       = local.worker_image
    essential   = true
    environment = local.common_env
    secrets     = local.app_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
  tags = local.tags
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }
  tags = local.tags
}
