#!/usr/bin/env bash
# SPORTPASS: set up the whole system on the school server (Ubuntu).
#   MySQL (database) + Node.js/PM2 (backend API) + Nginx (website, HTTPS)
# Run from the project folder:   bash deploy/setup-server.sh
# Safe to run again: it updates the code and keeps the database and secrets.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$APP_DIR/sportpass-backend"
FRONTEND="$APP_DIR/sportpass-frontend"
WEB_ROOT="/var/www/sportpass"
DB_NAME="sportpass_db"
DB_USER="sportpass"

step() { echo; echo "==== $* ===="; }

step "1/7 System packages (Node.js 20, MySQL, Nginx)"
sudo apt-get update -y
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get install -y mysql-server nginx openssl
sudo systemctl enable --now mysql nginx
command -v pm2 >/dev/null || sudo npm install -g pm2
echo "node $(node -v), npm $(npm -v)"

step "2/7 Database"
ENV_FILE="$BACKEND/.env"
if [ -f "$ENV_FILE" ] && grep -q "^DB_USER=$DB_USER$" "$ENV_FILE"; then
  DB_PASS="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
  echo "Keeping the existing database password from .env"
else
  DB_PASS="$(openssl rand -hex 16)"
fi
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "Database $DB_NAME ready (user $DB_USER)"

step "3/7 Backend settings (.env)"
if [ -f "$ENV_FILE" ] && grep -q "^DB_USER=$DB_USER$" "$ENV_FILE"; then
  echo "Keeping existing $ENV_FILE"
else
  [ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"
  cat > "$ENV_FILE" <<ENV
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
DB_SSL=false
DB_TIMEZONE=+08:00
APP_TIMEZONE=Asia/Manila
JWT_SECRET=$(openssl rand -hex 48)
SCHOOL_EMAIL_DOMAIN=cec.edu.ph
FINE_PER_MISSED_SCAN=30
ACTIVITY_QR_TTL_SECONDS=120
STUDENT_QR_TTL_SECONDS=300
MIN_MINUTES_BEFORE_TIME_OUT=1
ENV
  chmod 600 "$ENV_FILE"
  echo "Wrote $ENV_FILE"
fi

step "4/7 Backend install + start (PM2)"
cd "$BACKEND"
npm ci --omit=dev || npm install --omit=dev
mkdir -p uploads
if pm2 describe sportpass-api >/dev/null 2>&1; then
  pm2 restart sportpass-api --update-env
else
  pm2 start server.js --name sportpass-api --cwd "$BACKEND"
fi
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null || true
sleep 3
curl -fsS http://127.0.0.1:5000/ >/dev/null && echo "Backend is running on port 5000" || { echo "Backend did not start. Logs:"; pm2 logs sportpass-api --lines 30 --nostream; exit 1; }

step "5/7 Website build"
cd "$FRONTEND"
npm ci || npm install
# Same address for the website and the API: the API is under /api.
VITE_API_URL=/ npm run build
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "$WEB_ROOT"/*
sudo cp -r dist/* "$WEB_ROOT"/
echo "Website copied to $WEB_ROOT"

step "6/7 HTTPS certificate + Nginx"
CERT_DIR="/etc/ssl/sportpass"
if [ ! -f "$CERT_DIR/sportpass.crt" ]; then
  sudo mkdir -p "$CERT_DIR"
  sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/sportpass.key" -out "$CERT_DIR/sportpass.crt" \
    -subj "/CN=sportpass.cec.edu.ph" >/dev/null 2>&1
  echo "Made a self-signed certificate (replace with Let's Encrypt once there is a domain)"
fi
sudo tee /etc/nginx/sites-available/sportpass >/dev/null <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate     /etc/ssl/sportpass/sportpass.crt;
    ssl_certificate_key /etc/ssl/sportpass/sportpass.key;

    root /var/www/sportpass;
    index index.html;
    client_max_body_size 5m;   # profile photos are up to 2 MB

    # Backend API and profile photos
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }

    # The service worker must always be fresh
    location = /sw.js {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }
    # Built files have unique names: cache them for a long time
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    # Everything else is the single-page app
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ /index.html;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/sportpass /etc/nginx/sites-enabled/sportpass
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

step "7/7 Firewall"
if sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 22/tcp; sudo ufw allow 80/tcp; sudo ufw allow 443/tcp
fi

IP_LAN="$(hostname -I | awk '{print $1}')"
IP_TS="$(tailscale ip -4 2>/dev/null | head -1 || true)"
echo
echo "================================================================"
echo " SPORTPASS is set up."
echo "   School network : https://$IP_LAN"
[ -n "$IP_TS" ] && echo "   Tailscale      : https://$IP_TS"
echo "   First login    : admin@sportpass.local / ChangeMe@2026 (change it!)"
echo "   Browser will warn about the certificate: click Advanced > Proceed."
echo "   Backend logs   : pm2 logs sportpass-api"
echo "================================================================"
