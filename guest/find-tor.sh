#!/bin/bash
ls /usr/bin | grep -i tor || true
ls /usr/sbin | grep -i tor || true
ls /opt 2>/dev/null | head
command -v tor-switch routing-switch nyx obfs4proxy || true
ls /etc/systemd/system | grep -i tor || true
ls /etc/systemd/system/*.wants 2>/dev/null | head
# kodachi docs often use a binary named tor-switch
find /usr -maxdepth 3 -iname '*tor-switch*' 2>/dev/null | head
find /opt -maxdepth 3 -iname '*tor*' 2>/dev/null | head
