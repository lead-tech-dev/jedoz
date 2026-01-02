# AWS Infra (Terraform)

## Workspaces

Use workspaces to separate dev/staging/prod state.

```bash
terraform init
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
terraform workspace select dev
```

If `var.env` is not set, the workspace name is used for resource naming.

## Apply

```bash
terraform plan -var="domain_name=example.com" -var="db_password=..."
terraform apply -var="domain_name=example.com" -var="db_password=..."
```

## Notes

- Public subnets host the ALB (and the EC2 if `api_use_private_subnet=false`).
- Private subnets host RDS. A NAT gateway is created when `enable_nat_gateway=true`.
- If `api_use_private_subnet=true`, the API instance has no public IP. Use SSM or a bastion host for SSH.
