# Tor на whoami

Клиент SOCKS в госте: `127.0.0.1:9050`.

Прямой Tor здесь режут на TLS ClientHello. Рабочий путь — **Snowflake**:

```bash
bash /mnt/hostshare/tor-up.sh
```

Пакет: `snowflake-client`. Конфиг: `/mnt/hostshare/ai/torrc.client`.

Проверка: `curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip` → `"IsTor":true`.

Cline: MCP `tor_status`, `tor_fetch`, `tor_up`. `.onion` только через `socks5h`.

Не гонять SSH 2222 с хоста через Tor. Не включать `torrify-system-* --force` без явной просьбы.
