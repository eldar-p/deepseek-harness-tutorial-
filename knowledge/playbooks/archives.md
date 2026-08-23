---
name: archives
description: Find and use web archives, Internet Archive items, Wayback snapshots, Software Heritage, Debian snapshots, and local tar/zip/7z/iso. Use when the user mentions archive, Wayback, archive.org, snapshot, old page, unpack, tar, zip, 7z, or historical files.
---

# Archives (Tor + local unpack)

Discovery and downloads go through MCP `tor-net`, never host fetch/browser.

## Web / library archives

1. `tor_check`
2. **Find items:** `archive_find` — query plus optional `mediatype`: `texts` `software` `audio` `movies` `image` `data` `web`
3. **List files:** `archive_item` with the `identifier`
4. **Read a page from the past:** `archive_wayback` on the live URL, then `tor_get` the `https://web.archive.org/web/TIMESTAMP/…` snapshot
5. **Source code history:** `archive_swh` (Software Heritage)
6. **Save a file:** `archive_save` (lands on guest `/mnt/hostshare/downloads` = host `<HOST_SHARE>\downloads`). Default cap 80 MB.

Debian old packages: `tor_get` `https://snapshot.debian.org/package/NAME/` then install from that snapshot in the VM, not on Windows.

GitHub zip of a tag (still via Tor):  
`https://codeload.github.com/OWNER/REPO/tar.gz/refs/tags/TAG` → `archive_save`

## Local archives (zip/tar/7z/iso)

Always **list** before extract. Prefer the share so files survive reboot.

Guest (`vbox_exec`):

```bash
bash /mnt/hostshare/archive-open.sh list /path/file.ext
bash /mnt/hostshare/archive-open.sh extract /path/file.ext /mnt/hostshare/unpack/NAME
```

Host Windows only if the file is already on F:/E: and is not a Tor download: `Expand-Archive` or `tar -tf` in PowerShell.

Formats the script covers: `.zip` `.tar` `.tar.gz` `.tgz` `.tar.bz2` `.tar.xz` `.gz` `.bz2` `.xz` `.7z` `.iso` (loop-mount, root).

## Don't

- Don't use Anna's Archive / LibGen / Sci-Hub / leak dumps / stolen DBs.
- Don't unpack into `C:\` or the live overlay home unless the user asked.
- Don't download ISO/datasets over hundreds of MB without asking (raise `max_mb` only if they want it).
- Don't invent .onion “secret archives”.
