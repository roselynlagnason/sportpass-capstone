# SPORTPASS - send your latest code to the school server and apply it.
# Run in PowerShell from anywhere:  powershell -ExecutionPolicy Bypass -File deploy\update.ps1
# Off campus: Tailscale must be on. On campus you can set $Server = "10.20.26.4".
$Server  = "100.106.104.6"
$User    = "ceccsdattendance"
$Project = Split-Path -Parent $PSScriptRoot
$Pack    = Join-Path $env:USERPROFILE "sportpass.tar.gz"

Write-Host "1/3 Packing $Project ..."
Push-Location $Project
tar -czf $Pack --exclude=node_modules --exclude=.git --exclude=.env --exclude=.env.laragon `
  --exclude=dist --exclude=uploads --exclude=aiven-ca.pem --exclude=certificate.txt .
Pop-Location

Write-Host "2/3 Uploading (type the server password) ..."
scp $Pack "${User}@${Server}:~/"

Write-Host "3/3 Applying on the server (type the password again; sudo may ask once more) ..."
ssh -t "${User}@${Server}" "cd ~/sportpass && tar xzf ~/sportpass.tar.gz && bash deploy/setup-server.sh"

Write-Host "Done. Open https://$Server and press Ctrl+Shift+R."
