variable "env" {
  description = "Environment name (dev/staging/prod). Defaults to current Terraform workspace."
  type        = string
  default     = ""
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "eu-west-3"
}

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks."
  type        = list(string)
  default     = ["10.20.1.0/24", "10.20.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks."
  type        = list(string)
  default     = ["10.20.101.0/24", "10.20.102.0/24"]
}

variable "enable_nat_gateway" {
  description = "Create NAT gateway for private subnets."
  type        = bool
  default     = true
}

variable "api_use_private_subnet" {
  description = "Place API EC2 in private subnet (requires SSM or bastion for SSH)."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Root domain (ex: lodix.com)."
  type        = string
}

variable "create_zone" {
  description = "Create Route53 zone if true."
  type        = bool
  default     = false
}

variable "api_subdomain" {
  description = "API subdomain (ex: api)."
  type        = string
  default     = "api"
}

variable "web_subdomain" {
  description = "Web subdomain (ex: app)."
  type        = string
  default     = ""
}

variable "admin_subdomain" {
  description = "Admin subdomain (ex: admin)."
  type        = string
  default     = "admin"
}

variable "media_subdomain" {
  description = "Media subdomain (ex: media)."
  type        = string
  default     = "media"
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into EC2."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.small"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "jedolo"
}

variable "db_username" {
  description = "Database username."
  type        = string
  default     = "jedolo"
}

variable "db_password" {
  description = "Database password."
  type        = string
  sensitive   = true
}

variable "db_backup_retention_days" {
  description = "RDS backup retention days."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ."
  type        = bool
  default     = false
}

variable "force_destroy_buckets" {
  description = "Allow bucket destroy with objects (useful for dev)."
  type        = bool
  default     = false
}
