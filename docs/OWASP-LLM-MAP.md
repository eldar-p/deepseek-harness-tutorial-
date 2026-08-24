# OWASP LLM Top 10 → GIM controls

Mapping to [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) (2025).  
Status: **Hardened** tier — static + enforcement eval; runtime egress partially manual.

| ID | Risk | GIM control | Test / audit |
|----|------|-------------|--------------|
| **LLM01** | Prompt injection | Tool enforcement (jail, bash deny); model untrusted | `test:security` s01–s08, s12; audit #28 |
| **LLM02** | Sensitive info disclosure | Write deny secrets; log redaction contract | s03–s05, s13; audit #30; `paths.js` |
| **LLM03** | Supply chain | Zero npm deps; sha256 pins on zip/manifests | st02; audit #27, #32 |
| **LLM04** | Model DoS | Context compact @72%; `COLI_MAX_QUEUE`; tool truncation | `context-compact.js`; SPEED P5 |
| **LLM05** | Improper output handling | UI renders markdown as text; no eval of model HTML/JS | audit #17 UI |
| **LLM06** | Excessive agency | Fixed tool set; deny destructive ops; ask_user for ambiguity | `permission-risk.js`; `test:security` |
| **LLM07** | System prompt leakage | No system prompts in host logs | st06; audit #13 traces |
| **LLM08** | Vector / embedding weaknesses | Code index optional; no default RAG exfil path | defer if index enabled |
| **LLM09** | Misinformation | Not a security control — user review | honest-eval (quality) |
| **LLM10** | Unbounded consumption | Sequential eval lock; API user-supplied; GPU lock | honest-eval lock; `paths.lockGpu` |

## Coverage summary

| Tier | OWASP items with automated test | Notes |
|------|--------------------------------|-------|
| Hardened (now) | 8/10 (LLM01–07, LLM10) | LLM08 N/A without RAG; LLM09 quality-only |
| Assured (next) | + runtime egress (#29), guest write smoke (#31) | Docker CI job |

## Run enforcement mapping

```bash
npm run test:security
node scripts/security-eval.mjs --json | jq '.results[] | select(.pass)| .owasp'
```

Each scenario in `src/security-eval.js` lists `owasp: ['LLMxx', …]` tags.

See [THREAT-MODEL.md](./THREAT-MODEL.md) for trust boundaries and residual risks.
