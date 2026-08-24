# Deep CLI — Pre-beta

**Стадия:** pre-beta checks green on `main`  
**License:** [CC BY-NC-SA 4.0](./LICENSE)

```powershell
npm run audit:prebeta
node bin/deep.js doctor --readiness --stage=beta
```

## Done

- Audit gate `pre-beta`: 0 FAIL (JSDoc types policy + performance timeouts)
- Extra unit tests: proc / llama / shutdown
- Coverage gate ≥50% (src ~70%+)

See [BETA.md](./BETA.md) · [todo/README-beta.md](./todo/README-beta.md) · [docs/TYPES.md](./docs/TYPES.md)
