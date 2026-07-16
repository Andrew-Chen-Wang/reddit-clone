# Valkey — used ONLY as the BullMQ backing store (no app-level caching).
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-valkey"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_elasticache_replication_group" "valkey" {
  replication_group_id = "${local.name}-valkey"
  description          = "BullMQ backing store (Valkey)"
  engine               = "valkey"
  engine_version       = var.valkey_engine_version
  node_type            = var.valkey_node_type
  port                 = 6379

  num_cache_clusters         = 1     # dev default; >=2 for prod failover
  automatic_failover_enabled = false # requires >=2 nodes
  multi_az_enabled           = false

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.data.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # BullMQ ioredis is in-VPC; enable TLS for prod

  tags = merge(local.tags, { Name = "${local.name}-valkey" })
}
