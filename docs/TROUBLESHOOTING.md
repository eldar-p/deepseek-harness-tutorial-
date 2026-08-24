# Troubleshooting

## Engine RED — docker/podman not found

1. **Run the Docker Desktop installer** (not just download — finish setup).
2. Reboot if the installer asks.
3. Start **Docker Desktop** from Start menu; wait until the whale icon is steady/green.
4. Verify:

```powershell
powershell -File .\scripts\wait-docker.ps1
docker version
gim doctor
```

If `docker` works in a **new** terminal but `gim doctor` still fails, set:

```powershell
$env:GIM_DOCKER_BIN = "C:\Users\<you>\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
# or legacy install:
# $env:GIM_DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
```

Then `gim start` again — guest should build `gim-guest:prealpha` on first run (~1 min).

## Guest build fails — docker-credential-desktop not found

Symptom during `gim start`:

```text
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in %PATH%
```

**Cause:** Node/DSH spawned `docker` without Docker Desktop's `resources\bin` on PATH (credential helper lives there).

**Fix (built-in):** GIM CLI prepends the docker bin directory to **both** `Path` and `PATH` (`engineEnv` in `src/detect.js`) for guest ops **and** the DSH process. Update to latest `main` and retry.

**Manual workaround:**

```powershell
powershell -File .\scripts\wait-docker.ps1   # also prepends resources\bin
$env:GIM_DOCKER_BIN = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
gim start --cpu
```

## Llama RED / health timeout

```bash
# Logs
type %USERPROFILE%\.gim\run\default\llama.log   # Windows
cat ~/.gim/run/default/llama.log               # Unix

# CPU fallback
gim start --cpu --gguf PATH
```

CUDA build needs pinned zip or `GIM_LLAMA_BIN`.

## DSH RED / plugin tree failed

Re-materialize:

```bash
gim bootstrap
```

Check `~/.gim/dsh-home/profiles/web/cordis.patch.yml` — duplicate ids break DSH 0.1.1-rc.2.

`gim doctor` runs **plugin validation** (no `ctx.tool(`, `defineTool` must have `output.render`). Failures here crash DSH at boot (see 1.1.1 lsp-bridge fix).

On Windows, plugin URLs in the patch use `file:///C|/…` form.

## WSL

1. Prefer **Docker Desktop → WSL integration** (not apt `docker` alone).
2. Install Linux `dsh` under `~/.local` — reject Windows shims on `/mnt/<drive>/…`.
3. Helpers: `bash scripts/run-wsl-field-lite.sh` / `field-linux-wsl.sh` (auto-detect repo path).

## Manifest JSON / PowerShell BOM

If `channels.json` / config parse fails with `Unexpected token ''`, the file has a UTF-8 BOM. GIM strips BOM on read (`src/json-io.js`). Prefer Node/`writeJsonFile` — avoid `Set-Content` without `-Encoding utf8NoBOM`.

## Q3 quant warnings

Prefer **Q4_K_M** or higher for tool-heavy agents. Full policy: [QUANT.md](./QUANT.md).

- `gim start` prints `[YELLOW]` + `[HINT]`; writes `.gim/QUANT.md` for the agent
- `gim status` / `gim doctor` show a **Quant** row
- Soft gate: Q2− blocked; `gim start --require-q4` enforces Q4+; `--force-quant` overrides
- Fix: `gim start --gguf /path/model.Q4_K_M.gguf`

## Long sessions / context full

DSH auto-compacts at ~50% of the context window (see `cordis.gim.patch.yml`).

- In DSH chat, run **`/compact`** to force a summary now
- Large tool output is pruned at 4k chars — full logs belong in `workspace/logs/`
- Durable facts (with user consent) → `.gim/memory.json` (see `AGENTS.md`)

After compaction, re-read files instead of relying on old tool output in history.

## Multi-stack

```bash
gim start --name dev
gim status --name dev
gim status --all
gim stacks
gim stop --name dev
```

Only one **GPU** stack at a time. If start fails with GPU lock, stop the other stack or use `--cpu`.

## Guest network allowlist

Preset `balanced` / `dev`:

1. Host injects `GIM_NET_MODE` / `GIM_NET_ALLOWLIST`
2. Guest entrypoint `gim-net-enforce` applies **iptables** OUTPUT allowlist (needs `NET_ADMIN`)
3. `offline` / `paranoia` → `--network none`

```bash
docker exec gim-guest-default printenv GIM_NET_ALLOWLIST
docker logs gim-guest-default 2>&1 | findstr gim-net
```

Hard proxy sidecar — future; current filter is DNS→IP iptables (IPv4).

## Port already in use

`gim stop` then `gim start`. Stacks use random ports in 13000–14000 (DSH) and 18000–19000 (llama).

## Ctrl+C left processes

Pre-alpha: signal handler runs `gim stop`. If hung: `gim stop --emergency`.

## GitHub / push

Auth is user-side; local work does not require push for pre-alpha.
