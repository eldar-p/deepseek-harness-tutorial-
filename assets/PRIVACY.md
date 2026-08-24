# GIM CLI — privacy & telemetry

- **No phone-home telemetry** in the CLI. `telemetry: false` in default config.
- **gim.log** records events only (`event=…`), never prompt or chat bodies.
- **Logs** chmod 0600 on POSIX; rotate at 512 KiB on stop.
- **DSH** runs locally; model traffic stays `127.0.0.1` unless you change settings.
- **Guest network** controlled by preset (`balanced` = allowlist, `offline` = none).
- **Zero-traces** presets wipe session temps on stop; user code in workspace is never shredded without `--wipe-workspace` + explicit confirm.

Opt-in only: set `telemetry: true` in `~/.gim/config.json` when a future release documents what is sent.
