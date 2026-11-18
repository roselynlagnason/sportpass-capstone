# SPORTPASS on the school server — cheat sheet

| What | Value |
|---|---|
| Server (Proxmox VM 105) | Ubuntu 24.04, user `ceccsdattendance` |
| On campus | https://10.20.26.4 |
| Public (once IT forwards port 1982) | https://103.142.9.22:1982 — school router forwards 1982 to 10.20.26.4:1982 |
| Off campus (Tailscale on) | https://100.106.104.6 — Tailscale gave this address; see login.tailscale.com > Machines |
| First admin | admin@sportpass.local / ChangeMe@2026 — change it after first login |
| Website files | /var/www/sportpass (Nginx) |
| Backend | ~/sportpass/sportpass-backend, PM2 process `sportpass-api`, port 5000 |
| Database | MySQL `sportpass_db`, user `sportpass` (password in the backend .env on the server) |

## Update after changing code
Laptop PowerShell: `powershell -ExecutionPolicy Bypass -File deploy\update.ps1`
(or by hand: pack with tar, `scp` to the server, then on the server
`cd ~/sportpass && tar xzf ~/sportpass.tar.gz && bash deploy/setup-server.sh`).
The setup script is safe to re-run: it keeps .env, the database and photos.

## Log in to the server
`ssh ceccsdattendance@100.106.104.6`  (prompt becomes `ceccsdattendance@ceccsdsportsfestattendance:~$`)

## Useful server commands
| Need | Command |
|---|---|
| Backend logs | `pm2 logs sportpass-api --lines 40 --nostream` |
| Restart backend | `pm2 restart sportpass-api` |
| Backend status | `pm2 status` |
| See tables | `sudo mysql -e "USE sportpass_db; SHOW TABLES;"` |
| Open MySQL | `sudo mysql sportpass_db` (type `exit` to leave) |
| Test login on the server | `curl -sk -X POST https://127.0.0.1/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@sportpass.local","password":"ChangeMe@2026"}'` |
| Nginx check / reload | `sudo nginx -t && sudo systemctl reload nginx` |
| Backup database | `sudo mysqldump sportpass_db > ~/sportpass-backup-$(date +%F).sql` |

## Still to do
- Ask IT to forward ports 80/443 (or a subdomain like sportpass.cec.edu.ph) to 10.20.26.4 so people off campus can open it, then get a free Let's Encrypt certificate (`sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d <domain>`).
- Optional: copy old data from Aiven (mysqldump from Aiven, import into sportpass_db).
