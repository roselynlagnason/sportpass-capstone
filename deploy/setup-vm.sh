#!/usr/bin/env bash
# SPORTPASS one-shot setup for an Ubuntu 24.04 VM.
# Installs Nginx, MySQL, Node 20, builds the web app, starts the API as a
# service. Safe to run again after "git pull" (keeps .env and the database).
#
#   sudo bash deploy/setup-vm.sh http://10.20.26.4
#   sudo bash deploy/setup-vm.sh https://sportpass.yourschool.edu.ph
#
# The address is what people type in the browser (no slash at the end).
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0 <address>"; exit 1; }

ADDR="${1:-}"
if [ -z "$ADDR" ]; then
  ADDR="http://$(hostname -I | awk '{print $1}')"
  echo "No address given, using $ADDR"
fi
ADDR="${ADDR%/}"

APP=/opt/sportpass
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/8] Installing packages"
apt-get update -y
apt-get install -y nginx mysql-server git ufw rsync curl openssl ca-certificates

NODE_MAJOR=0
command -v node >/dev/null 2>&1 && NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "==> Installing Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> [2/8] Copying the project to $APP"
mkdir -p "$APP"
if [ "$SRC" != "$APP" ]; then
  rsync -a --exclude node_modules --exclude .git --exclude dist "$SRC"/ "$APP"/
fi
BACK="$APP/sportpass-backend"
FRONT="$APP/sportpass-frontend"

echo "==> [3/8] Database"
systemctl enable --now mysql
if [ -f "$BACK/.env" ] && grep -q '^DB_PASSWORD=.' "$BACK/.env"; then
  DB_PASS="$(grep '^DB_PASSWORD=' "$BACK/.env" | cut -d= -f2-)"
  JWT="$(grep '^JWT_SECRET=' "$BACK/.env" | cut -d= -f2-)"
else
  DB_PASS="$(openssl rand -hex 16)"
  JWT="$(openssl rand -hex 48)"
fi
mysql <<SQL
CREATE DATABASE IF NOT EXISTS sportpass_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'sportpass'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'sportpass'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON sportpass_db.* TO 'sportpass'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> [4/8] API settings (.env)"
cat > "$BACK/.env" <<ENV
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sportpass
DB_PASSWORD=${DB_PASS}
DB_NAME=sportpass_db
DB_SSL=false
DB_TIMEZONE=+08:00
APP_TIMEZONE=Asia/Manila
CORS_ORIGIN=${ADDR}
JWT_SECRET=${JWT}
FINE_PER_MISSED_SCAN=30
ACTIVITY_QR_TTL_SECONDS=120
STUDENT_QR_TTL_SECONDS=300
MIN_MINUTES_BEFORE_TIME_OUT=1
SCHOOL_EMAIL_DOMAIN=cec.edu.ph
ENV

echo "==> [5/8] Installing API dependencies"
cd "$BACK"
npm install --omit=dev
mkdir -p uploads
chown -R www-data:www-data "$BACK"
chmod 600 "$BACK/.env"

echo "==> [6/8] Building the web app for $ADDR"
cd "$FRONT"
npm install
VITE_API_URL="$ADDR" npm run build
mkdir -p /var/www/sportpass
rm -rf /var/www/sportpass/*
cp -r dist/* /var/www/sportpass/

echo "==> [7/8] Starting the API service and Nginx"
cat > /etc/systemd/system/sportpass-api.service <<UNIT
[Unit]
Description=SPORTPASS API
After=network.target mysql.service

[Service]
User=www-data
WorkingDirectory=$BACK
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable sportpass-api
systemctl restart sportpass-api

cat > /etc/nginx/sites-available/sportpass <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/sportpass;
    index index.html;
    client_max_body_size 3m;

    location /api/     { proxy_pass http://127.0.0.1:5000; include proxy_params; }
    location /uploads/ { proxy_pass http://127.0.0.1:5000; include proxy_params; }

    location = /sw.js  { add_header Cache-Control "no-cache"; try_files $uri =404; }
    location /         { try_files $uri /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/sportpass /etc/nginx/sites-enabled/sportpass
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

echo "==> [8/8] Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

sleep 4
echo
echo "---- Checks ----"
curl -s http://127.0.0.1:5000/ || echo "API did not answer: run  sudo journalctl -u sportpass-api -n 50"
echo
echo "Open:   $ADDR"
echo "Login:  admin@sportpass.local / ChangeMe@2026   (change it right away)"
echo "Logs:   sudo journalctl -u sportpass-api -f"
echo "Note:   phone camera scanning needs HTTPS (see DEPLOY-SCHOOL-SERVER.md, step 10)"
