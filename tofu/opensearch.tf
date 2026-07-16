resource "aws_opensearch_domain" "main" {
  domain_name    = "${var.project}-${var.environment}"
  engine_version = var.opensearch_engine_version

  cluster_config {
    instance_type          = var.opensearch_instance_type
    instance_count         = var.opensearch_instance_count
    zone_awareness_enabled = var.opensearch_instance_count > 1
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 20
  }

  # In-VPC domain reachable only from the app security groups.
  vpc_options {
    subnet_ids         = slice(aws_subnet.private[*].id, 0, var.opensearch_instance_count)
    security_group_ids = [aws_security_group.data.id]
  }

  encrypt_at_rest {
    enabled = true
  }
  node_to_node_encryption {
    enabled = true
  }
  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  # VPC + SG already restrict access to app tasks; an open domain policy is fine
  # here. For prod, enable fine-grained access control with a master user.
  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "*" }
      Action    = "es:*"
      Resource  = "arn:aws:es:${var.aws_region}:${var.aws_account_id}:domain/${var.project}-${var.environment}/*"
    }]
  })

  tags = local.tags
}
