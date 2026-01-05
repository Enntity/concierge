#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Concierge Server Setup Script                      ║${NC}"
echo -e "${GREEN}║         For Hetzner Cloud (Ubuntu 22.04)                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Prompt for configuration
echo -e "${YELLOW}Please provide the following information:${NC}"
echo ""

read -p "Domain name (e.g., app.example.com): " DOMAIN
read -p "Email for SSL certificates: " ACME_EMAIL
read -p "MongoDB connection string: " MONGODB_URI
read -p "Cortex GraphQL API URL (e.g., https://api.example.com/graphql): " CORTEX_GRAPHQL_API_URL
read -p "Cortex Media API URL (e.g., https://api.example.com/file-handler): " CORTEX_MEDIA_API_URL

echo ""
echo -e "${YELLOW}Redis (from Cortex server):${NC}"
read -p "Redis password (from Cortex server setup): " REDIS_PASSWORD
if [ -z "$REDIS_PASSWORD" ]; then
    echo -e "${RED}Redis password is required! Get it from the Cortex server setup.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Authentication:${NC}"
read -p "Auth Secret (leave blank to generate): " AUTH_SECRET
read -p "Google OAuth Client ID (optional): " AUTH_GOOGLE_ID
read -p "Google OAuth Client Secret (optional): " AUTH_GOOGLE_SECRET
read -p "Allowed email domains (comma-separated, optional): " AUTH_ALLOWED_DOMAINS

echo ""
read -p "GitHub repository (e.g., enntity/concierge): " GITHUB_REPOSITORY

# Generate secrets if not provided
if [ -z "$AUTH_SECRET" ]; then
    AUTH_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}Generated AUTH_SECRET${NC}"
fi

# Generate Traefik dashboard password
read -p "Traefik dashboard username (default: admin): " TRAEFIK_USER
TRAEFIK_USER=${TRAEFIK_USER:-admin}
TRAEFIK_PASSWORD=$(openssl rand -base64 12 | tr -d '=+/')
TRAEFIK_DASHBOARD_AUTH=$(htpasswd -nb "$TRAEFIK_USER" "$TRAEFIK_PASSWORD" | sed 's/\$/\$\$/g')

echo ""
echo -e "${GREEN}Step 1: Updating system...${NC}"
apt-get update && apt-get upgrade -y

echo -e "${GREEN}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${YELLOW}Docker already installed${NC}"
fi

echo -e "${GREEN}Step 3: Installing additional tools...${NC}"
apt-get install -y apache2-utils curl git ufw

echo -e "${GREEN}Step 4: Configuring firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo -e "${GREEN}Step 5: Creating application directory...${NC}"
mkdir -p /opt/concierge
cd /opt/concierge

echo -e "${GREEN}Step 6: Creating environment file...${NC}"
cat > .env << EOF
# Domain Configuration
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# GitHub Container Registry
GITHUB_REPOSITORY=${GITHUB_REPOSITORY}
IMAGE_TAG=latest

# Redis (on Cortex server via private network 10.0.0.2)
REDIS_PASSWORD=${REDIS_PASSWORD}

# MongoDB
MONGODB_URI=${MONGODB_URI}

# Cortex API
CORTEX_GRAPHQL_API_URL=${CORTEX_GRAPHQL_API_URL}
CORTEX_MEDIA_API_URL=${CORTEX_MEDIA_API_URL}

# Authentication
AUTH_SECRET=${AUTH_SECRET}
AUTH_GOOGLE_ID=${AUTH_GOOGLE_ID}
AUTH_GOOGLE_SECRET=${AUTH_GOOGLE_SECRET}
AUTH_ALLOWED_DOMAINS=${AUTH_ALLOWED_DOMAINS}

# Traefik Dashboard
TRAEFIK_DASHBOARD_AUTH=${TRAEFIK_DASHBOARD_AUTH}

# Optional
SLACK_WEBHOOK_URL=
EOF

chmod 600 .env

echo -e "${GREEN}Step 7: Creating Docker network...${NC}"
docker network create concierge_web 2>/dev/null || true

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Point your DNS:"
echo "   - ${DOMAIN} → $(curl -s ifconfig.me)"
echo "   - traefik.${DOMAIN} → $(curl -s ifconfig.me) (optional, for dashboard)"
echo ""
echo "2. Add these secrets to your GitHub repository:"
echo "   Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "   DEPLOY_HOST: $(curl -s ifconfig.me)"
echo "   DEPLOY_USER: root"
echo "   DEPLOY_SSH_KEY: (your private SSH key)"
echo "   CORTEX_GRAPHQL_API_URL: ${CORTEX_GRAPHQL_API_URL}"
echo "   CORTEX_MEDIA_API_URL: ${CORTEX_MEDIA_API_URL}"
echo ""
echo "3. Push to main branch to trigger deployment"
echo "   Or manually deploy with: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo -e "${YELLOW}Saved credentials:${NC}"
echo "   Traefik Dashboard: https://traefik.${DOMAIN}"
echo "   Username: ${TRAEFIK_USER}"
echo "   Password: ${TRAEFIK_PASSWORD}"
echo ""
echo -e "${YELLOW}Redis:${NC}"
echo "   Connecting to Cortex server at 10.0.0.2:6379"
echo ""
echo "   Environment file: /opt/concierge/.env"
echo ""

