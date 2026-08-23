#!/bin/bash
# list | extract  ARCHIVE  [DEST]
set -euo pipefail
cmd=${1:-}
src=${2:-}
dest=${3:-}

if [[ -z "$cmd" || -z "$src" ]]; then
  echo "usage: archive-open.sh list FILE"
  echo "       archive-open.sh extract FILE DESTDIR"
  exit 2
fi
if [[ ! -f "$src" ]]; then
  echo "missing file: $src"
  exit 1
fi

lower=$(printf '%s' "$src" | tr 'A-Z' 'a-z')

list() {
  case "$lower" in
    *.tar.gz|*.tgz) tar -tzf "$src" | head -n 80 ;;
    *.tar.bz2|*.tbz2) tar -tjf "$src" | head -n 80 ;;
    *.tar.xz|*.txz) tar -tJf "$src" | head -n 80 ;;
    *.tar) tar -tf "$src" | head -n 80 ;;
    *.zip) unzip -l "$src" | head -n 80 ;;
    *.7z)
      if command -v 7z >/dev/null; then 7z l "$src" | head -n 80
      else echo "install p7zip-full"; exit 1; fi
      ;;
    *.gz|*.bz2|*.xz) ls -lh "$src"; echo "(single compressed file)" ;;
    *.iso) file "$src"; ls -lh "$src" ;;
    *) file "$src"; echo "unknown archive type" ; exit 1 ;;
  esac
}

extract() {
  if [[ -z "$dest" ]]; then
    echo "DESTDIR required"
    exit 2
  fi
  mkdir -p "$dest"
  case "$lower" in
    *.tar.gz|*.tgz) tar -xzf "$src" -C "$dest" ;;
    *.tar.bz2|*.tbz2) tar -xjf "$src" -C "$dest" ;;
    *.tar.xz|*.txz) tar -xJf "$src" -C "$dest" ;;
    *.tar) tar -xf "$src" -C "$dest" ;;
    *.zip) unzip -q "$src" -d "$dest" ;;
    *.7z)
      if command -v 7z >/dev/null; then 7z x -y -o"$dest" "$src"
      else echo "install p7zip-full"; exit 1; fi
      ;;
    *.gz) gzip -dc "$src" > "$dest/$(basename "$src" .gz)" ;;
    *.bz2) bunzip2 -dc "$src" > "$dest/$(basename "$src" .bz2)" ;;
    *.xz) xz -dc "$src" > "$dest/$(basename "$src" .xz)" ;;
    *.iso)
      mnt="$dest/mnt"
      mkdir -p "$mnt"
      sudo mount -o loop,ro "$src" "$mnt"
      echo "mounted $src -> $mnt (sudo umount $mnt when done)"
      ;;
    *) echo "unknown archive type"; exit 1 ;;
  esac
  echo "ok $dest"
  ls -la "$dest" | head -n 40
}

case "$cmd" in
  list) list ;;
  extract) extract ;;
  *) echo "unknown command"; exit 2 ;;
esac
