# Deploying SPORTPASS on the school Proxmox VM (Ubuntu 24.04)

One VM runs everything:

    phone/laptop --> Nginx (port 80/443)
                       |- /            -> built web app (static files)
                       |- /api, /uploads -> Node API on 127.0.0.1:5000
                                             |-> MySQL on 127.0.0.1:3306

Replace `<VM-IP>` with the VM's address (Proxmox > VM 105 > Cloud-Init, or run
`ip a` on the VM) and, if the school gives you one, use the domain instead.

---

## 0. Log in

From your PC (PowerShell): `ssh <vm-user>@<VM-IP>`
(the user/password are on the VM's Cloud-Init tab). The Proxmox console works
too but SSH lets you paste.

If SSH is refused from outside the school network, ask the ICT office to open
port 22 (and 80/443) to the VM, or connect to the school VPN first.

## 1. Update and install

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # should print v20.x
```

If the school blocks nodesource, use `sudo apt install -y nodejs npm`
(Node 18 is enough for the API, but build the web app on your PC, step 6).

## 2. Create the database

```
sudo mysql
```
Inside the MySQL prompt (choose your own password):
```
CREATE DATABASE sportpass_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sportpass'@'localhost' IDENTIFIED BY 'PUT-A-STRONG-PASSWORD-HERE';
GRANT ALL PRIVILEGES ON sportpass_db.* TO 'sportpass'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
No tables needed: the API creates them and the first admin on first start.

(Want your Laragon data too? Export `sportpass_db` from HeidiSQL as a .sql
file, `scp` it to the VM and run
`sudo mysql sportpass_db < sportpass_db.sql` BEFORE the first API start.)

## 3. Get the code

```
sudo mkdir -p /opt/sportpass && sudo chown $USER:$USER /opt/sportpass
git clone https://github.com/roselynlagnason/sportpass-capstone.git /opt/sportpass
```
If the repo is private, git asks for a username and a GitHub Personal Access
Token (GitHub > Settings > Developer settings > Tokens) as the password.
No GitHub on the VM? Copy from your PC instead (PowerShell, in the project
folder, skip node_modules and .env):
`scp -r sportpass-backend <vm-user>@<VM-IP>:/opt/sportpass/`

## 4. Configure and install the API

```
cd /opt/sportpass/sportpass-backend
cp .env.example .env
openssl rand -hex 48        # copy this output for JWT_SECRET
nano .env
```
Set these in `.env`:
```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sportpass
DB_PASSWORD=<the MySQL password from step 2>
DB_NAME=sportpass_db
DB_SSL=false
DB_TIMEZONE=+08:00
APP_TIMEZONE=Asia/Manila
CORS_ORIGIN=http://<VM-IP>        # exactly what you type in the browser
JWT_SECRET=<the random value>
SCHOOL_EMAIL_DOMAIN=cec.edu.ph
```
Then:
```
npm install --omit=dev
sudo chown -R www-data:www-data /opt/sportpass/sportpass-backend
sudo chmod 600 .env
```
Quick test (Ctrl+C to stop): `sudo -u www-data node server.js`
You should see "MySQL connected", "created all tables and the first admin
account" and "Server running on port 5000".

## 5. Keep the API running (systemd)

```
sudo nano /etc/systemd/system/sportpass-api.service
```
```
[Unit]
Description=SPORTPASS API
After=network.target mysql.service

[Service]
User=www-data
WorkingDirectory=/opt/sportpass/sportpass-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
```
sudo systemctl daemon-reload
sudo systemctl enable --now sportpass-api
sudo systemctl status sportpass-api
curl http://127.0.0.1:5000/      # SPORTPASS Backend Running
```
Logs: `sudo journalctl -u sportpass-api -f`

## 6. Build the web app

The app needs the final address baked in. Build it on your PC (Laragon's Node
is fine), in PowerShell:
```
cd sportpass-frontend
npm install
$env:VITE_API_URL="http://<VM-IP>"
npm run build
scp -r dist <vm-user>@<VM-IP>:/tmp/sportpass-dist
```
(No slash at the end of the address. If you later switch to a domain or
HTTPS, rebuild with the new address.)

On the VM:
```
sudo mkdir -p /var/www/sportpass
sudo rm -rf /var/www/sportpass/*
sudo cp -r /tmp/sportpass-dist/* /var/www/sportpass/
```

## 7. Nginx

```
sudo nano /etc/nginx/sites-available/sportpass
```
```
server {
    listen 80 default_server;
    server_name _;

    root /var/www/sportpass;
    index index.html;
    client_max_body_size 3m;          # profile photos (max 2 MB)

    location /api/     { proxy_pass http://127.0.0.1:5000; include proxy_params; }
    location /uploads/ { proxy_pass http://127.0.0.1:5000; include proxy_params; }

    location = /sw.js  { add_header Cache-Control "no-cache"; try_files $uri =404; }
    location /         { try_files $uri /index.html; }
}
```
```
sudo ln -sf /etc/nginx/sites-available/sportpass /etc/nginx/sites-enabled/sportpass
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Firewall

```
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
Port 5000 and 3306 stay closed to the outside; only Nginx talks to them.

## 9. First login

Open `http://<VM-IP>` -> log in as `admin@sportpass.local` / `ChangeMe@2026`
and change the password straight away (Settings > Change Password). Then
set the event details and add a sportfest day.

## 10. HTTPS (needed for phone cameras!)

Phone browsers only allow the camera (QR scanner) and the offline mode on
HTTPS. Plain `http://<VM-IP>` loads, but scanning will not work. Options:

- **Best:** ask the school for a domain/subdomain pointing at the VM, then
  `sudo apt install -y certbot python3-certbot-nginx` and
  `sudo certbot --nginx -d your.domain.edu.ph`
  (the VM must be reachable from the internet on 80/443).
  Rebuild the web app with `VITE_API_URL=https://your.domain.edu.ph`, re-copy
  it (step 6) and set `CORS_ORIGIN=https://your.domain.edu.ph`, then
  `sudo systemctl restart sportpass-api`.
- **No domain:** use a free tunnel (Cloudflare Tunnel or similar) in front of
  the VM for the demo, or a self-signed certificate (every phone shows a
  warning that must be accepted, and the offline mode may not install).

## Updating later

```
cd /opt/sportpass && git pull
cd sportpass-backend && npm install --omit=dev
sudo systemctl restart sportpass-api
```
Web app changes: rebuild on your PC and redo the copy in step 6.

## Backup before the demo

```
sudo mysqldump sportpass_db > ~/sportpass-$(date +%F).sql
```

## Troubleshooting

| Problem | Check |
|---|---|
| Page loads but login fails / network error | Web app built with the wrong `VITE_API_URL`; rebuild (step 6). Check `CORS_ORIGIN` matches the address in the browser. |
| 502 Bad Gateway | API is down: `sudo systemctl status sportpass-api`, `journalctl -u sportpass-api -n 50` |
| "Database connection failed" | Wrong DB user/password in `.env`; test with `mysql -u sportpass -p sportpass_db` |
| Photos don't upload | `client_max_body_size` in Nginx; file must be under 2 MB |
| Wrong "today" / scans refused | `DB_TIMEZONE=+08:00` and `APP_TIMEZONE=Asia/Manila` in `.env` |
| Camera won't open | Needs HTTPS (step 10) |
