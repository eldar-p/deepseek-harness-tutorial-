# 0008 — Project license CC BY-NC-SA 4.0

**Status:** Accepted  
**Date:** 2026-08-24

## Context

The project initially used MIT. The maintainer requires a NonCommercial ShareAlike license.

## Decision

Deep CLI project sources (this repository) are licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International** (CC BY-NC-SA 4.0).

- SPDX: `CC-BY-NC-SA-4.0`
- Full text: [`LICENSE`](../LICENSE)
- Summary: https://creativecommons.org/licenses/by-nc-sa/4.0/
- RU deed: https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ru

Third-party runtimes (llama.cpp, DSH, Debian, GGUF models) remain under **their own** licenses.

## Consequences

- Non-commercial use/share/adapt with attribution; adaptations must be ShareAlike
- Commercial use needs a separate agreement (see `docs/legal/COMMERCIAL-NOTICE.md`)
- npm `license` field set to `CC-BY-NC-SA-4.0`
- Contributors agree to the same terms via CONTRIBUTING.md
