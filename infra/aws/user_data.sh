#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y nginx git curl ca-certificates gnupg

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

corepack enable
corepack prepare pnpm@9.12.1 --activate

mkdir -p /var/www/jedolo
mkdir -p /etc/jedolo

systemctl enable nginx
systemctl restart nginx
