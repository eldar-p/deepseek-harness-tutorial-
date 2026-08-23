@echo off
REM Interactive shell into VM whoami only
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -i "%USERPROFILE%\.ssh\id_ed25519" -p 2222 kodachi@127.0.0.1
