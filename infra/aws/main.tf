locals {
  env_name    = var.env != "" ? var.env : (terraform.workspace == "default" ? "dev" : terraform.workspace)
  env_prefix  = "${local.env_name}-jedolo"
  api_domain  = var.api_subdomain != "" ? "${var.api_subdomain}.${var.domain_name}" : var.domain_name
  web_domain  = var.web_subdomain != "" ? "${var.web_subdomain}.${var.domain_name}" : var.domain_name
  admin_domain = var.admin_subdomain != "" ? "${var.admin_subdomain}.${var.domain_name}" : "admin.${var.domain_name}"
  media_domain = var.media_subdomain != "" ? "${var.media_subdomain}.${var.domain_name}" : "media.${var.domain_name}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_route53_zone" "main" {
  count = var.create_zone ? 1 : 0
  name  = var.domain_name
}

data "aws_route53_zone" "main" {
  count        = var.create_zone ? 0 : 1
  name         = var.domain_name
  private_zone = false
}

locals {
  zone_id = var.create_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.main[0].zone_id
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${local.env_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.env_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = element(data.aws_availability_zones.available.names, count.index)
  map_public_ip_on_launch = true
  tags = {
    Name = "${local.env_prefix}-public-${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags = {
    Name = "${local.env_prefix}-private-${count.index + 1}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.env_prefix}-public-rt"
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"
  tags = {
    Name = "${local.env_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags = {
    Name = "${local.env_prefix}-nat"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.env_prefix}-private-rt"
  }
}

resource "aws_route" "private_nat" {
  count                   = var.enable_nat_gateway ? 1 : 0
  route_table_id          = aws_route_table.private.id
  destination_cidr_block  = "0.0.0.0/0"
  nat_gateway_id          = aws_nat_gateway.main[0].id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

locals {
  api_subnet_id = var.api_use_private_subnet ? aws_subnet.private[0].id : aws_subnet.public[0].id
  api_public_ip = var.api_use_private_subnet ? false : true
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_security_group" "alb" {
  name        = "${local.env_prefix}-alb-sg"
  description = "ALB SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name        = "${local.env_prefix}-app-sg"
  description = "App SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name        = "${local.env_prefix}-db-sg"
  description = "DB SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "db" {
  name       = "${local.env_prefix}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "db" {
  identifier              = "${local.env_prefix}-db"
  engine                  = "postgres"
  engine_version          = "15.5"
  instance_class          = var.db_instance_class
  allocated_storage       = 30
  db_name                 = var.db_name
  username                = var.db_username
  password                = var.db_password
  multi_az                = var.db_multi_az
  publicly_accessible     = false
  vpc_security_group_ids  = [aws_security_group.db.id]
  db_subnet_group_name    = aws_db_subnet_group.db.name
  backup_retention_period = var.db_backup_retention_days
  skip_final_snapshot     = true
}

resource "aws_instance" "api" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = local.api_subnet_id
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = local.api_public_ip
  user_data                   = file("${path.module}/user_data.sh")
  tags = {
    Name = "${local.env_prefix}-api"
  }
}

resource "aws_lb" "api" {
  name               = "${local.env_prefix}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  name        = "${local.env_prefix}-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"
  health_check {
    path                = "/health/ready"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group_attachment" "api" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = aws_instance.api.id
  port             = 80
}

resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain
  validation_method = "DNS"
}

resource "aws_route53_record" "api_cert" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = 300
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.api_cert : r.fqdn]
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_route53_record" "api" {
  zone_id = local.zone_id
  name    = local.api_domain
  type    = "A"
  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_s3_bucket" "web" {
  bucket        = "${local.env_prefix}-web"
  force_destroy = var.force_destroy_buckets
}

resource "aws_s3_bucket" "admin" {
  bucket        = "${local.env_prefix}-admin"
  force_destroy = var.force_destroy_buckets
}

resource "aws_s3_bucket" "media" {
  bucket        = "${local.env_prefix}-media"
  force_destroy = var.force_destroy_buckets
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "admin" {
  bucket                  = aws_s3_bucket.admin.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.env_prefix}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${local.env_prefix}-media-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "cf" {
  provider          = aws.use1
  domain_name       = local.web_domain
  validation_method = "DNS"
  subject_alternative_names = [
    local.admin_domain,
    local.media_domain,
  ]
}

resource "aws_route53_record" "cf_cert" {
  for_each = {
    for dvo in aws_acm_certificate.cf.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = 300
}

resource "aws_acm_certificate_validation" "cf" {
  provider                = aws.use1
  certificate_arn         = aws_acm_certificate.cf.arn
  validation_record_fqdns = [for r in aws_route53_record.cf_cert : r.fqdn]
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Web ${var.env}"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "web-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "web-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress = true

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cf.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = [local.web_domain]
}

resource "aws_cloudfront_distribution" "admin" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Admin ${var.env}"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.admin.bucket_regional_domain_name
    origin_id                = "admin-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "admin-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress = true

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cf.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = [local.admin_domain]
}

resource "aws_cloudfront_distribution" "media" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Media ${var.env}"

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "media-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "media-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress = true

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cf.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = [local.media_domain]
}

data "aws_iam_policy_document" "web_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_policy.json
}

data "aws_iam_policy_document" "admin_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.admin.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.admin.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "admin" {
  bucket = aws_s3_bucket.admin.id
  policy = data.aws_iam_policy_document.admin_policy.json
}

data "aws_iam_policy_document" "media_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = data.aws_iam_policy_document.media_policy.json
}

resource "aws_route53_record" "web" {
  zone_id = local.zone_id
  name    = local.web_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "admin" {
  zone_id = local.zone_id
  name    = local.admin_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.admin.domain_name
    zone_id                = aws_cloudfront_distribution.admin.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "media" {
  zone_id = local.zone_id
  name    = local.media_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.media.domain_name
    zone_id                = aws_cloudfront_distribution.media.hosted_zone_id
    evaluate_target_health = false
  }
}
