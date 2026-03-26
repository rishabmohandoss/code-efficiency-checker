# Phase 6 Test File - Infrastructure as Code Security Issues
# This file demonstrates Terraform security misconfigurations

# ==========================================
# RULE 58: IAC HARDCODED SECRETS - HIGH
# ==========================================

# HIGH: Hardcoded database password
resource "aws_db_instance" "production" {
  identifier = "prod-db"
  engine     = "postgres"
  instance_class = "db.t3.micro"

  username = "admin"
  password = "SuperSecret123!"    # DANGEROUS: Hardcoded password!

  allocated_storage = 20
  skip_final_snapshot = true
}

# HIGH: Hardcoded master password
resource "aws_rds_cluster" "main" {
  cluster_identifier = "aurora-cluster"
  engine            = "aurora-postgresql"

  master_username = "root"
  master_password = "MyPassword456"    # DANGEROUS

  database_name   = "mydb"
}

# HIGH: Hardcoded API token
resource "aws_ecs_task_definition" "app" {
  family = "app-task"

  container_definitions = jsonencode([{
    name  = "app"
    image = "myapp:latest"
    environment = [
      {
        name  = "API_KEY"
        value = "sk_live_123456789abcdef"    # DANGEROUS
      },
      {
        name  = "SECRET_KEY"
        value = "my-secret-key-12345"    # DANGEROUS
      },
      {
        name  = "AUTH_TOKEN"
        value = "ghp_AbCdEf123456789"    # DANGEROUS
      }
    ]
  }])
}

# HIGH: Hardcoded admin password
resource "azurerm_virtual_machine" "main" {
  name                  = "vm-instance"
  location              = "East US"
  resource_group_name   = azurerm_resource_group.main.name

  os_profile {
    computer_name  = "hostname"
    admin_username = "admin"
    admin_password = "P@ssw0rd123!"    # DANGEROUS
  }
}

# HIGH: Hardcoded SSH key
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  user_data = <<-EOF
              #!/bin/bash
              echo "ssh-rsa AAAAB3Nza... admin@example.com" >> /home/ubuntu/.ssh/authorized_keys
              export DB_PASSWORD="hardcoded_password"    # DANGEROUS
              EOF
}

# ==========================================
# CORRECT EXAMPLES (Should NOT trigger)
# ==========================================

# CORRECT: Using variables
resource "aws_db_instance" "secure" {
  identifier = "secure-db"
  engine     = "postgres"
  instance_class = "db.t3.micro"

  username = var.db_username
  password = var.db_password    # From variables, not hardcoded

  allocated_storage = 20
}

# CORRECT: Using AWS Secrets Manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "secure_with_secrets_manager" {
  identifier = "db-with-sm"
  engine     = "postgres"

  username = "admin"
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}

# CORRECT: Using environment variables
resource "aws_ecs_task_definition" "secure_app" {
  family = "secure-app"

  container_definitions = jsonencode([{
    name  = "app"
    image = "myapp:latest"
    secrets = [
      {
        name      = "API_KEY"
        valueFrom = aws_secretsmanager_secret.api_key.arn
      }
    ]
  }])
}

# ==========================================
# RULE 48: UNENCRYPTED CLOUD STORAGE - HIGH
# ==========================================

# HIGH: S3 bucket without encryption
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"
  # Missing encryption configuration!
}

resource "aws_s3_bucket_server_side_encryption_configuration" "disabled" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = ""    # Empty/disabled
    }
  }
}

# HIGH: Public S3 bucket
resource "aws_s3_bucket_acl" "public" {
  bucket = aws_s3_bucket.data.id
  acl    = "public-read"    # DANGEROUS
}

# ==========================================
# RULE 47: OVERLY PERMISSIVE IAM - HIGH
# ==========================================

# HIGH: IAM policy with wildcard
resource "aws_iam_role_policy" "overly_permissive" {
  name = "overly-permissive"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "*"           # DANGEROUS: All actions
        Resource = "*"         # DANGEROUS: All resources
      }
    ]
  })
}

# HIGH: Another wildcard policy
resource "aws_iam_policy" "admin_like" {
  name = "admin-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:*"
        Resource = "*"
      }
    ]
  })
}

# ==========================================
# RULE 49: OVERLY PERMISSIVE FIREWALL - MEDIUM
# ==========================================

# MEDIUM: Security group open to internet
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Web server security group"

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]    # DANGEROUS: All ports from anywhere
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]    # DANGEROUS: SSH from anywhere
  }
}

# MEDIUM: GCP firewall rule
resource "google_compute_firewall" "allow_all" {
  name    = "allow-all-ingress"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  source_ranges = ["0.0.0.0/0"]    # DANGEROUS
}

# ==========================================
# EXPECTED DETECTIONS:
# ==========================================
#
# HIGH: 15-20 issues
#   - Hardcoded passwords (5-7)
#   - Hardcoded API tokens (3-4)
#   - Hardcoded secrets in user_data (2)
#   - Unencrypted S3 buckets (2)
#   - Overly permissive IAM policies (3-4)
#
# MEDIUM: 3-5 issues
#   - Overly permissive security groups (3-4)
#   - Public S3 buckets (1)
#
# TOTAL: 18-25 issues expected
# ==========================================

# Notes:
# - IaC files are committed to git - secrets exposed forever
# - Even after deletion, git history retains secrets
# - Infrastructure changes are sensitive and permanent
# - Misconfigurations can expose entire cloud infrastructure
#
# Best practices:
# 1. Use variables for all sensitive values
# 2. Store sensitive variables in .tfvars (gitignored)
# 3. Use cloud secret managers (AWS Secrets Manager, etc.)
# 4. Enable encryption by default
# 5. Use least-privilege IAM policies
# 6. Restrict firewall rules to specific IPs
# 7. Scan IaC with tools like tfsec, checkov, terrascan
#
# Real-world examples:
# - Uber (2016): AWS credentials in GitHub
# - CodeSpaces (2021): Hardcoded JWT secret in source code
# - Multiple companies: Terraform state files with secrets committed
