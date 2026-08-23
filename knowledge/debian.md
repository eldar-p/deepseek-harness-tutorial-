# Debian VM whoami — рабочая среда ИИ

Cline/Qwen работает с Linux **через эту ВМ**, не через PowerShell.

- OS: Kodachi 9.0.1 (Debian 13 Trixie)
- SSH: `127.0.0.1:2222`, user `kodachi`
- Файлы: `<VM_DIR>` → `/mnt/hostshare`
- Команды: MCP `vbox_exec`
- Не onion-lab / не `10.10.40.61`

Live-сессия: пакеты в overlay пропадают после ребута. Долговечное клади в `/mnt/hostshare`.
