resource "random_password" "db" {
  length  = 32
  special = false
}

# Full Postgres connection string the app reads as DATABASE_URL. Kept in Secrets
# Manager and injected into tasks via the ECS `secrets` block (never plaintext env).
resource "aws_secretsmanager_secret" "database_url" {
  name = "${local.name}/database-url"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s:5432/%s",
    var.db_username,
    random_password.db.result,
    aws_db_instance.main.address,
    var.db_name,
  )
}

# Application secrets that are NOT derivable from other resources (Google OAuth,
# session signing, etc.). Created empty; populate the value in the console / CI —
# tofu ignores drift so a manual value survives applies.
resource "aws_secretsmanager_secret" "app" {
  name = "${local.name}/app"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    GOOGLE_CLIENT_ID     = "REPLACE_ME"
    GOOGLE_CLIENT_SECRET = "REPLACE_ME"
  })
  lifecycle {
    ignore_changes = [secret_string]
  }
}
