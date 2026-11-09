# Problem 3 - Messy React

Analysis of a deliberately messy React + TypeScript component, plus a refactor that compiles and is tested.

- **[WhatWrong.md](./WhatWrong.md)** - every defect (with evidence), review of the earlier notes, design of the refactor, assumptions.
- `solution.tsx` - the refactored `WalletPage`.
- `wallet-utils.ts` / `types.ts` - pure logic (filter, sort, format, USD value, keys) and types.
- `context.tsx` - documented stand-ins for what the challenge snippet leaves undefined (`BoxProps`, `WalletRow`, `useWalletBalances`, `usePrices`).
- `*.test.ts(x)` - Vitest + Testing Library tests.

```bash
npm ci
npm run typecheck     # tsc --noEmit, strict
npm test -- --run     # vitest, jsdom
```

Node `^22.22.2 || ^24.15.0 || >=26`.
