# Deploy Secrets (OVH/VPS)

Set these in GitHub: Settings → Secrets and variables → Actions.

## Required

- `VPS_HOST`
- `VPS_SSH_USER`
- `VPS_SSH_KEY`

## Optional (defaults in workflow)

- `VPS_APP_DIR` (default `/var/www/jedolo`)
- `VPS_WEB_DIR` (default `/var/www/jedolo/web`)
- `VPS_ADMIN_DIR` (default `/var/www/jedolo/admin`)
- `API_GIT_URL` (defaults to the current repository URL)

## Notes

- You can delete old AWS secrets from GitHub once the workflow is fully migrated.
