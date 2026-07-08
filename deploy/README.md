# PR Compass Gabia PM2 Deployment

This deployment path is for the current MVP:

- free domain first
- Gabia server
- PM2 for both Next.js and FastAPI
- Nginx reverse proxy
- SQLite kept outside the deploy repository

## Repository Split

Development repository:

```text
git@github.com-snsfb134:snsfb134/pr-compass.git
```

Deployment repository:

```text
git@github.com-snsfb134:snsfb134/pr-compass-deploy.git
```

The deployment repository should contain build/runtime artifacts only. It should not contain `.env`, SMTP credentials, SQLite DB files, snapshots, or generated email outbox files.

## Recommended Server Layout

```text
/srv/pr-compass-deploy   deployment repository checkout
/srv/pr-compass-data     SQLite DB, snapshots, reports, email outbox
```

## Environment

Set these on the server through PM2 ecosystem env or shell profile. Do not commit real values.

```bash
PR_COMPASS_DATA_DIR="/srv/pr-compass-data"
PR_COMPASS_WEB_APP_URL="https://YOUR_FREE_DOMAIN"
NEXT_PUBLIC_API_BASE_URL="/backend"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USERNAME="YOUR_SMTP_USERNAME"
SMTP_PASSWORD="YOUR_SMTP_APP_PASSWORD"
SMTP_FROM_EMAIL="PR Compass <YOUR_SMTP_USERNAME>"
SMTP_USE_SSL="false"
```

## Free Domain

Use DuckDNS for the first MVP test.

1. Go to `https://www.duckdns.org`.
2. Sign in with GitHub or Google.
3. Create a subdomain such as `prcompass`.
4. Set the IP to the Gabia server public IP.
5. Give the resulting domain to the deployment process:

```text
prcompass.duckdns.org
```

If the name is taken, use a nearby variant such as:

```text
pr-compass.duckdns.org
prcompass-briefing.duckdns.org
prcompassbc.duckdns.org
```

## Nginx Choice

Use Nginx for this server because the existing `bada-web` PM2 deployment likely already sits behind Nginx. Caddy is simpler for automatic HTTPS, but it can conflict with an existing Nginx process on ports 80/443.

Nginx keeps the deployment close to the current server style.

## Nginx Example

Replace `YOUR_FREE_DOMAIN` before applying.

```nginx
server {
    listen 80;
    server_name YOUR_FREE_DOMAIN;

    client_max_body_size 20m;

    location /backend/ {
        proxy_pass http://127.0.0.1:8010/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After DNS resolves, add HTTPS with Certbot if it is already used on the server:

```bash
sudo certbot --nginx -d YOUR_FREE_DOMAIN
```

## PM2

Use the generated `ecosystem.config.cjs` in the deploy repository.

```bash
cd /srv/pr-compass-deploy
pm2 start ecosystem.config.cjs
pm2 save
```

For updates:

```bash
cd /srv/pr-compass-deploy
git pull
pm2 restart pr-compass-api
pm2 restart pr-compass-web
```

## Health Checks

```bash
curl http://127.0.0.1:8010/health
curl http://127.0.0.1:3000
curl http://YOUR_FREE_DOMAIN
```

Then open:

```text
https://YOUR_FREE_DOMAIN
https://YOUR_FREE_DOMAIN/briefing/sample
https://YOUR_FREE_DOMAIN/admin/briefings
```

