output "env" {
  value = local.env_name
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "api_domain" {
  value = local.api_domain
}

output "web_domain" {
  value = local.web_domain
}

output "admin_domain" {
  value = local.admin_domain
}

output "media_domain" {
  value = local.media_domain
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "ec2_public_ip" {
  value = var.api_use_private_subnet ? null : aws_instance.api.public_ip
}

output "db_endpoint" {
  value = aws_db_instance.db.address
}

output "web_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "admin_bucket" {
  value = aws_s3_bucket.admin.bucket
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "web_cloudfront_id" {
  value = aws_cloudfront_distribution.web.id
}

output "admin_cloudfront_id" {
  value = aws_cloudfront_distribution.admin.id
}

output "media_cloudfront_id" {
  value = aws_cloudfront_distribution.media.id
}
