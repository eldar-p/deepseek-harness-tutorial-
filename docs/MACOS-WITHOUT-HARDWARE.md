# macOS without a physical Mac

Deep has **no Mac in the lab**. That is fine — coverage strategy:

## What we already use (free)

| Method | What it proves | Cost |
|--------|----------------|------|
| **GitHub Actions `macos-latest`** | Unit tests, coverage, harness, **field-lite** (llama CPU fetch + materialize) | Included in GH Actions minutes |
| **Pinned darwin Metal binary** in `llama-binaries.json` | Auto-fetch path for Apple Silicon | Free |
| **`scripts/field-macos.sh`** | Operator script if someone *does* have a Mac later | Free |

This is the **accepted** macOS bar for Deep 1.1.x — not a backlog item.

## Paid options (only if you want full GGUF e2e on real Mac)

| Option | Notes |
|--------|-------|
| [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/) | Real Mac hosts; **24h minimum** bill per host — expensive for a one-shot e2e |
| [MacStadium Orka](https://macstadium.com/orka) | Ephemeral macOS VMs; GitHub Actions plugins |
| [Depot macOS runners](https://depot.dev/blog/now-available-macos-26-github-actions) | Drop-in `runs-on: depot-macos-*` for Actions |
| [Bitrise Build Hub](https://bitrise.io/blog/post/build-hub-github-actions-macos-runner-alternative) | M4 Pro runners as Actions labels |

**Recommendation:** stay on GitHub-hosted `macos-latest` field-lite unless product sales need signed macOS full-stack GREEN. Do **not** buy EC2 Mac for a single smoke.

## Not real options

- Hackintosh / nested VMware “macOS on Windows” — fragile, ToS-grey, not for CI truth
- Linux CI as a substitute for Metal/darwin paths — already covered separately

See [OS-COMPAT.md](./OS-COMPAT.md).
