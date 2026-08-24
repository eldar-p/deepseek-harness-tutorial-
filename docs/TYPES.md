# Types policy (pre-beta)

Deep CLI is **ESM JavaScript** (Node 22+). Full TypeScript migration is deferred past pre-beta.

## Current contract

- Public helpers use **JSDoc** (`@param`, `@returns`, `@typedef`) in `src/` and plugins
- Runtime validation via explicit checks + `exitCode` on errors (see audit #19)
- `package.json` `"type": "module"` — no ambient `.d.ts` yet

## Deferred

- Migrate `src/` to TypeScript (`strict`) at pre-beta→beta boundary if needed
- Publish `.d.ts` with npm package when CDN channel ships typed API

## Check

```bash
# JSDoc presence is part of audit #5
npm run audit:prebeta
```
