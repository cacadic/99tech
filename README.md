# 99Tech code challenge

Three independent packages, one per problem. Everything runs locally; there is nothing to deploy.

| Problem                    | Folder                                         | What it is                                                                                                                                                | Run                     |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1 — Three ways to sum to n | [`problem1/`](problem1/)                       | `sum_to_n_a/b/c`: loop, closed form, O(log n) halving recursion. Conventions for `n <= 0` and the safe range are stated in its README.                    | `npm run test:problem1` |
| 2 — Fancy Form             | [`problem2/fancy-form/`](problem2/fancy-form/) | A currency-swap form (React, TypeScript, Vite, Tailwind). Simulated balances and swaps; prices from the challenge's feed with a labelled sample fallback. | `npm run dev`           |
| 3 — Messy React            | [`problem3/`](problem3/)                       | [`WhatWrong.md`](problem3/WhatWrong.md) lists the problems of the snippet by category; [`solution.tsx`](problem3/solution.tsx) is the tested refactor.    | `npm run test:problem3` |

## Quick start

Node.js `^22.22.2 || ^24.15.0 || >=26` (`.nvmrc`: 26).

```bash
npm run setup     # `npm ci` in each of the three packages
npm run dev       # Fancy Form at http://localhost:5173
```

| Command (from this folder)             |                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run setup`                        | `npm ci` in `problem1`, `problem2/fancy-form` and `problem3` (the root itself has no dependencies) |
| `npm run dev` / `build` / `preview`    | Fancy Form dev server / production build / serve the build                                         |
| `npm run typecheck`                    | Fancy Form and Problem 3                                                                           |
| `npm run lint`, `npm run format:check` | Fancy Form                                                                                         |
| `npm test`                             | Problem 1 (`node --test`), Problem 2 (Vitest), Problem 3 (Vitest)                                  |
| `npm run test:coverage`                | Fancy Form coverage                                                                                |
| `npm run test:e2e`                     | Fancy Form, Playwright on the production build (uses the installed Google Chrome)                  |
| `npm run verify`                       | all of the above in sequence                                                                       |

## Problem 2 in one paragraph

Choose two tokens (searchable lists with icons; only tokens with a valid price are offered), type an amount, and the
amount you receive is `amount × price[from] / price[to]`, computed with `decimal.js` and truncated to 8 decimals —
the same number is then credited to the demo wallet (which starts at 1,800 USD). Max, switch direction, validation
messages next to the field, a pending state, toast, English/Vietnamese, light/dark with separate backgrounds, and a
responsive, keyboard-operable layout are all there. Details, screenshots and the rules for choosing prices are in
[`problem2/fancy-form/README.md`](problem2/fancy-form/README.md).

## Documents about this restoration

| File                                           | Contents                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`AUDIT.md`](AUDIT.md)                         | Why the form had disappeared, the bugs of the original, what the app really imported  |
| [`RESTORE_CHECKLIST.md`](RESTORE_CHECKLIST.md) | Every original feature → where it lives now → the evidence, with status               |
| [`MIGRATION.md`](MIGRATION.md)                 | Dependency changes (72 → 43), exceptions and their reasons, Node and Docker alignment |
| [`REVIEW.md`](REVIEW.md)                       | The commands that were run, their results, what is not verified                       |
