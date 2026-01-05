# Deploying Concierge to Hetzner Cloud

This guide walks you through deploying Concierge to a Hetzner Cloud VPS with automatic SSL, CI/CD, and zero-downtime deployments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Hetzner VPS                              │
│                                                             │
│  ┌───────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │  Traefik  │──▶│  Concierge   │   │   Worker     │       │
│  │ (SSL/LB)  │   │  (Next.js)   │   │  (BullMQ)    │       │
│  └───────────┘   └──────────────┘   └──────────────┘       │
│        │                │                  │                │
│        └────────────────┴──────────────────┘                │
│                         │                                   │
│                  ┌──────┴──────┐                           │
│                  │    Redis    │                           │
│                  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- A Hetzner Cloud account ([sign up here](https://www.hetzner.com/cloud))
- A domain name with access to DNS settings
- A GitHub repository with this code
- MongoDB Atlas account (or self-hosted MongoDB)

## Step 1: Create Hetzner Server

1. Log into [Hetzner Cloud Console](https://console.hetzner.cloud/)

2. Click **"Create Server"**

3. Configure your server:
   - **Location**: Choose based on your users (Ashburn for US East, Hillsboro for US West)
   - **Image**: Ubuntu 22.04
   - **Type**: CX32 (4 vCPU, 8GB RAM) - ~€8.75/month
   - **SSH Key**: Add your public SSH key (required!)
   - **Name**: `concierge-prod`

4. Click **"Create & Buy Now"**

5. Note the IP address once created

## Step 2: Configure DNS

Point your domain to the server IP:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | concierge | YOUR_SERVER_IP | 300 |
| A | traefik.concierge | YOUR_SERVER_IP | 300 |

Example: If your domain is `example.com`, create:
- `concierge.example.com` → Server IP
- `traefik.concierge.example.com` → Server IP (optional, for monitoring)

## Step 3: Run Server Setup

SSH into your new server and run the setup script:

```bash
# SSH into the server
ssh root@YOUR_SERVER_IP

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/deploy/setup-server.sh | bash
```

Or manually:

```bash
# Clone just the deploy folder
git clone --depth 1 --filter=blob:none --sparse https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
git sparse-checkout set deploy

# Run setup
chmod +x deploy/setup-server.sh
sudo ./deploy/setup-server.sh
```

The script will prompt you for:
- Domain name
- Email for SSL certificates
- MongoDB connection string
- Cortex API URLs
- OAuth credentials (optional)

## Step 4: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DEPLOY_HOST` | Server IP address | `123.45.67.89` |
| `DEPLOY_USER` | SSH username | `root` |
| `DEPLOY_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `CORTEX_GRAPHQL_API_URL` | Cortex GraphQL endpoint | `https://api.example.com/graphql` |
| `CORTEX_MEDIA_API_URL` | Cortex Media endpoint | `https://api.example.com/media` |

### Getting your SSH private key:

```bash
# On your local machine
cat ~/.ssh/id_rsa
# Or if using ed25519:
cat ~/.ssh/id_ed25519
```

Copy the entire content including `-----BEGIN` and `-----END` lines.

## Step 5: Deploy!

Push to the `main` branch:

```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

GitHub Actions will:
1. Build the Docker image
2. Push to GitHub Container Registry
3. SSH to your server
4. Pull the new image
5. Restart with zero downtime

## Manual Deployment

If you need to deploy manually:

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Navigate to app directory
cd /opt/concierge

# Pull latest image
docker pull ghcr.io/YOUR_USERNAME/YOUR_REPO:latest

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just the app
docker logs -f concierge-app

# Just the worker
docker logs -f concierge-worker
```

### Check status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Traefik Dashboard

Access at `https://traefik.YOUR_DOMAIN` (credentials shown after setup)

## Updating Environment Variables

Edit the `.env` file on the server:

```bash
ssh root@YOUR_SERVER_IP
nano /opt/concierge/.env

# Then restart
cd /opt/concierge
docker compose -f docker-compose.prod.yml up -d
```

## Scaling

### Add more workers

Edit `docker-compose.prod.yml` and add replicas:

```yaml
worker:
  deploy:
    replicas: 3
```

### Upgrade server

In Hetzner Console, you can resize your server with minimal downtime:
- CX32 → CX42 for more CPU/RAM
- Or add a dedicated Redis/MongoDB server

## Backup

### Redis data

```bash
# Create backup
docker exec redis redis-cli -a YOUR_REDIS_PASSWORD BGSAVE
docker cp redis:/data/dump.rdb ./redis-backup.rdb

# Restore
docker cp ./redis-backup.rdb redis:/data/dump.rdb
docker restart redis
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs concierge-app

# Check if port is in use
netstat -tlnp | grep 3000
```

### SSL certificate issues

```bash
# Check Traefik logs
docker logs traefik

# Force certificate renewal
docker exec traefik rm /letsencrypt/acme.json
docker restart traefik
```

### Connection refused

```bash
# Check firewall
ufw status

# Ensure ports are open
ufw allow 80/tcp
ufw allow 443/tcp
```

## Cost Summary

| Component | Monthly Cost |
|-----------|-------------|
| Hetzner CX32 (4 vCPU, 8GB) | ~€8.75 (~$10) |
| MongoDB Atlas (M0 Free) | $0 |
| Domain (annual / 12) | ~$1 |
| **Total** | **~$11/month** |

Compare to:
- AWS (equivalent): ~$100+/month
- Azure: ~$80+/month
- Vercel Pro + Redis + Workers: ~$40+/month


