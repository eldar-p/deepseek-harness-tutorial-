# GIM product principles

These rules govern architecture, docs, and code review. **Do not violate them for convenience.**

## 1. One product for everyone

- No per-model code paths (`if v4`, `if deepseek`, agent profiles for one checkpoint).
- No per-OS product forks in core logic — **Docker** is the universal runtime for LLM + guest where applicable.
- If something fails on one platform, fix the **universal path**, not a special-case shim.

## 2. Colibri is the default local LLM

- Local agent stack default: **Colibri in Docker** → OpenAI `/v1`.
- Optional escape hatches only when explicitly requested: `--gguf`, `--api`, `--vllm`.
- Harness talks to **one OpenAI-compatible URL**; it never branches tool contracts by backend.
- Speed: universal env + `cache_slot` per chat + grammar drafts — never per-checkpoint profiles.

## 3. One tool contract

- Fixed tools for every model: `list_dir`, `read_file`, `write_file`, `search_files`, `guest_bash`, `ask_user`.
- Capability probe + text fallback — not separate agent loops per vendor.

## 4. Speed without model-specific hacks

- Tuning via **universal env** (VRAM/RAM tier, I/O, KV persistence, daemon warm).
- Learning cache (`.coli_usage`) comes from **user workload**, not shipped “profiles for model X”.
- Hardware calibration: `coli tune` / `--auto-tier` — fingerprint is model metadata + machine, not hardcoded names in GIM.

## 5. Honest limits

- Document RAM/VRAM/disk requirements; do not promise tok/s without hardware context.
- Prompt injection mitigated by **enforcement layer**, not “trust the model”.

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) · [SPEED.md](./SPEED.md) · [SECURITY.md](./SECURITY.md)
