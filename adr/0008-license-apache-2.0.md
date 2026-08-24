# 0008 — Project license Apache-2.0

**Status:** Accepted  
**Date:** 2026-08-24  
**Supersedes:** CC BY-NC-SA 4.0 (pre-2.0)

## Context

The project used MIT, then CC BY-NC-SA 4.0. For broader adoption and alignment with
optional backends (e.g. Colibri Apache-2.0 orchestration), the maintainer switched to Apache-2.0.

## Decision

GIM CLI project sources (this repository) are licensed under **Apache License 2.0**.

- SPDX: `Apache-2.0`
- Full text: [`LICENSE`](../LICENSE)
- Summary: https://www.apache.org/licenses/LICENSE-2.0

Third-party runtimes (llama.cpp, DSH, Debian, GGUF models, Colibri upstream) remain under **their own** licenses.
Colibri C sources are **not** vendored into the npm package as GIM code.

## Consequences

- Commercial and non-commercial use allowed under Apache-2.0 terms
- Attribution / NOTICE requirements apply on redistribution
- npm `license` field: `Apache-2.0`
- Contributors agree to the same terms via CONTRIBUTING.md
