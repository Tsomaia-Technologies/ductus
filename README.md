# Ductus

Event sourcing framework built on async generators in TypeScript.

## Monorepo

- **packages/core** — Framework (published as `ductus`)
- **apps/sample** — Example app (legacy API)
- **apps/sample2** — Chat demo app (legacy API)

## Setup

```bash
pnpm install
```

## Commands

- `pnpm build` — Build framework (ductus)
- `pnpm test` — Run tests
- `pnpm lint:deps` — Check dependency boundaries (apps must not import core internals)
- `pnpm changeset` — Add a changeset for versioning

## Versioning

Independent versioning via [Changesets](https://github.com/changesets/changesets). Run `pnpm changeset` to add changes, then `pnpm changeset version` and `pnpm publish -r`.
