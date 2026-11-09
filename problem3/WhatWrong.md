# Problem 3 - Messy React: what is wrong, and a tested refactor

The task: list the computational inefficiencies and anti-patterns in a React + TypeScript
function component (hooks), and provide a refactor. Analysis counts for more than the refactor,
so every claim below was checked with the TypeScript compiler (`tsc` 7.0.2, `strict`) or a small
runtime experiment. Where a claim could NOT be verified, it says so.

## The original snippet (reconstructed)

> The snippet is not stored in this repository. It is reconstructed from the public challenge
> statement and the author's earlier notes. The type-check results below are for exactly this text,
> with only the undefined names declared as stubs (`BoxProps`, `WalletRow`, `useWalletBalances`,
> `usePrices`, `classes`).

<details>
<summary>Original code (reconstructed)</summary>

```tsx
interface WalletBalance {
  currency: string;
  amount: number;
}
interface FormattedWalletBalance {
  currency: string;
  amount: number;
  formatted: string;
}

interface Props extends BoxProps {

}
const WalletPage: React.FC<Props> = (props: Props) => {
  const { children, ...rest } = props;
  const balances = useWalletBalances();
  const prices = usePrices();

  const getPriority = (blockchain: any): number => {
    switch (blockchain) {
      case 'Osmosis':
        return 100
      case 'Ethereum':
        return 50
      case 'Arbitrum':
        return 30
      case 'Zilliqa':
        return 20
      case 'Neo':
        return 20
      default:
        return -99
    }
  }

  const sortedBalances = useMemo(() => {
    return balances.filter((balance: WalletBalance) => {
      const balancePriority = getPriority(balance.blockchain);
      if (lhsPriority > -99) {
         if (balance.amount <= 0) {
           return true;
         }
      }
      return false
    }).sort((lhs: WalletBalance, rhs: WalletBalance) => {
      const leftPriority = getPriority(lhs.blockchain);
      const rightPriority = getPriority(rhs.blockchain);
      if (leftPriority > rightPriority) {
        return -1;
      } else if (rightPriority > leftPriority) {
        return 1;
      }
    });
  }, [balances, prices]);

  const formattedBalances = sortedBalances.map((balance: WalletBalance) => {
    return {
      ...balance,
      formatted: balance.amount.toFixed()
    }
  })

  const rows = sortedBalances.map((balance: FormattedWalletBalance, index: number) => {
    const usdValue = prices[balance.currency] * balance.amount;
    return (
      <WalletRow
        className={classes.row}
        key={index}
        amount={balance.amount}
        usdValue={usdValue}
        formattedAmount={balance.formatted}
      />
    )
  })

  return (
    <div {...rest}>
      {rows}
    </div>
  )
}
```

</details>

What the compiler says about it (`tsc --noEmit --strict`, log: `/tmp/99tech-work/logs/problem3-original-tsc-strict.log`):

```
TS2339: Property 'blockchain' does not exist on type 'WalletBalance'.        (3 places)
TS2304: Cannot find name 'lhsPriority'.
TS2345: Argument of type '(lhs, rhs) => -1 | 1 | undefined' is not assignable to parameter of type '(a, b) => number'.
TS2345: ... Property 'formatted' is missing in type 'WalletBalance' but required in type 'FormattedWalletBalance'.
```

With `noImplicitReturns` it adds `TS7030: Not all code paths return a value`; with `noUnusedLocals` it
adds `TS6133` for `balancePriority` and `formattedBalances`; with `noUncheckedIndexedAccess` it flags
`prices[balance.currency]` as possibly `undefined`.

---

## 1. The issues

Severity: **High** = wrong output or crash, **Medium** = wrong in some conditions / hides bugs, **Low** = smell or minor cost.

### 1.1 Correctness

| # | Where | Why it is wrong | Consequence | Fix | Sev. |
|---|-------|-----------------|-------------|-----|------|
| C1 | `filter`: `if (lhsPriority > -99)` | `lhsPriority` is never declared; the variable that was declared is `balancePriority` (and it is never read). `TS2304`. | `ReferenceError: lhsPriority is not defined` on the first element of any non-empty list (verified; an empty list never calls the callback, so the bug hides until real data arrives). | Use the declared variable, or better, a named predicate. | High |
| C2 | `filter`: `if (balance.amount <= 0) return true` | The condition is inverted. Even with C1 fixed, only balances that are **empty or negative** on a known chain survive. | Verified: for `[Osmosis 5, Neo 0, Foo -3, Ethereum -1]` the filter keeps `Neo:0` and `Ethereum:-1`; every real balance is dropped. | Keep `amount > 0` **and** `Number.isFinite(amount)` (`Infinity > 0` is `true`; `NaN` fails every comparison). | High |
| C3 | `sort` comparator | Falls off the end when priorities are equal. `TS2345` (and `TS7030` with `noImplicitReturns`). At runtime this is **not** a crash: the spec coerces the `undefined` result to `+0`. | The comparator is incomplete, not asymmetric. Equal-priority items (Zilliqa and Neo, both 20) keep their input order (`Array.prototype.sort` is stable since ES2019). So the visible order of those rows depends on the order the data source returns them (verified: `[Zil, Neo]` vs `[Neo, Zil]` give different outputs). | Always return a number and add a deterministic tie-break (currency, then blockchain). | Medium |
| C4 | `WalletBalance` | Has no `blockchain` field, but the code reads `balance.blockchain` three times (`TS2339`). | The code only works if the hook returns more than the declared type; the compiler cannot help with anything involving the chain. | Add `blockchain` to the interface. | High (type) |
| C5 | `formattedBalances` vs `rows` | `formattedBalances` is built and never used. `rows` maps `sortedBalances` and reads `balance.formatted`, which does not exist on those objects (`TS2345`: parameter annotated `FormattedWalletBalance` while the array is `WalletBalance[]`). | `formattedAmount` is `undefined` for every row: the formatted value is silently never displayed. One full array pass and N object allocations are thrown away on every render. | Map once, from the sorted list to the final row data; use that list for rendering. | High |
| C6 | `prices[balance.currency] * balance.amount` | A currency missing from `prices` gives `undefined * n === NaN` (verified). `usePrices()` is typically empty while loading. | `usdValue` is `NaN` and `WalletRow` renders `NaN` (or `$NaN`). | Model "unknown" explicitly (`number \| null`) and render a placeholder. Do not default to `0`: that shows a wrong "$0.00" (see section 2). | High |
| C7 | `balance.amount.toFixed()` | No argument means 0 fraction digits. | Verified: `(0.5).toFixed()` is `"1"`, `(2.5).toFixed()` is `"3"`, `(0.000001234).toFixed()` is `"0"` (a positive balance shown as zero), `(1e21).toFixed()` is `"1e+21"`, `NaN`/`Infinity` print literally, `(-0.4).toFixed()` is `"-0"`. Returning a *string* is fine (it is for display); the precision is the problem. | `Intl.NumberFormat` with explicit fraction digits, a floor for tiny positive values and a placeholder for non-finite numbers. | Medium |
| C8 | Amount values | The original never decides what to do with `0`, negative, `NaN`, `Infinity`. | See C2 and C7; each of them leaks into rows or text differently. | One predicate, `isDisplayable`, with tests for each value. | Medium |

### 1.2 Type safety

| # | Where | Issue | Fix |
|---|-------|-------|-----|
| T1 | `getPriority = (blockchain: any)` | `any` turns the type checker off for the one value the whole function is about; it is also why C4 was never noticed. | Parameter `string` (external data may contain unknown chains, which the `default` branch exists for) plus a `Blockchain` union for the known ones. |
| T2 | `React.FC<Props> = (props: Props) =>` | The props type is stated twice. `React.FC` adds nothing here (since React 18 it no longer implies `children`). | A plain function with a destructured, typed parameter. |
| T3 | `interface Props extends BoxProps {}` | An empty interface that only renames its parent (`@typescript-eslint/no-empty-object-type`). | Use `BoxProps` directly, or add real members. |
| T4 | `usePrices()` result | Used as a dictionary, no declared shape; `prices[x]` is typed `number` although it can be `undefined` at runtime. | `PriceMap = Record<string, number>` and read it defensively (`noUncheckedIndexedAccess` makes the compiler insist). |
| T5 | `FormattedWalletBalance` | Repeats the fields of `WalletBalance` instead of `extends`; the two will drift. | `interface FormattedWalletBalance extends WalletBalance { formatted: string }`. |

### 1.3 Hooks

| # | Where | Issue | Consequence | Fix |
|---|-------|-------|-------------|-----|
| H1 | `useMemo(..., [balances, prices])` | `prices` is not read inside the callback. | The sort and filter are recomputed on every price update for nothing. (It does **not** cause extra re-renders: the component re-renders on price changes anyway because it calls `usePrices()`. Memo dependencies only control recomputation.) | List exactly what is read, or drop the memo. |
| H2 | `getPriority` declared inside the component | Re-created on every render; it closes over nothing. It is also used inside `useMemo` but absent from the dependency array, which `react-hooks/exhaustive-deps` documents as a missing dependency (the lint rule was **not run** on the original here). Adding it to the deps would defeat the memo, because its identity changes every render. | Wasteful, and a lint trap. | Module-level pure function and table. |
| H3 | Memoization is partial | The sort is memoized, but `formattedBalances` and `rows` (which depend on `prices`) are recomputed on every render. | Inconsistent: the expensive-looking part is cached, the part that actually depends on `prices` is not. | One pure derivation, memoized (or not) as a unit. |

### 1.4 Algorithm and performance

Honest summary: with the handful of rows a wallet has, nothing here is slow. The real costs are wasted work, not complexity class.

| # | Issue | Cost |
|---|-------|------|
| A1 | Four passes (`filter`, `sort`, `map`, `map`), and the first `map` result is discarded. | O(n) allocations per render for nothing (C5). |
| A2 | The comparator calls `getPriority` twice per comparison. | O(n log n) `switch` evaluations; negligible for small n. A decorate-sort-undecorate would only be worth it for thousands of rows, so the refactor does not do it. |
| A3 | Recompute-on-price-tick (H1). | A full re-sort whenever prices change, although prices cannot change the order. |
| A4 | `.sort()` after `.filter()` | **Not** a defect: `filter` already returns a new array, so `balances` is not mutated (verified). Adding `.slice()` (as the old `solution.tsx` did) is redundant. |

### 1.5 React rendering

| # | Where | Issue | Consequence | Fix |
|---|-------|-------|-------------|-----|
| R1 | `key={index}` | The index identifies a *position*, not a balance. | When a row is added or removed above others, React reuses each DOM node / component state for a different balance (reproduced in `solution.test.tsx`: the node that showed `OSMO` shows `ETH` after the list grows). Visible as wrong per-row state and needless DOM writes. | Stable domain key: `blockchain:currency`. |
| R2 | `className={classes.row}` | `classes` is not defined in the snippet (usually a `makeStyles` result). | Cannot compile on its own. | Pass a class name in through props (`rowClassName`). |
| R3 | `const { children, ...rest } = props` | `children` is destructured and never rendered. | Anything the parent passes as children disappears silently. | Render `{children}`. |
| R4 | `<div {...rest}>` | `rest` is whatever `BoxProps` allows. If `BoxProps` is a design-system type (MUI-style `sx`, `component`, `mt`...), those props reach the DOM. Verified with React 19: `<div sx={{m:1}} mt={2}>` renders `<div sx="[object Object]" mt="2">`. | Invalid attributes in the DOM. This depends on what `BoxProps` really is, which the snippet does not say. | Destructure non-DOM props out; forward only DOM props. |
| R5 | Rows with identical `blockchain` + `currency` | Any domain key collides (and the old `solution.tsx` key did). React documents duplicate keys as unsupported: children may be duplicated or omitted. (Not reproduced against the original here; the refactor is tested to produce none.) | Unpredictable rows. | Make the key unique (occurrence suffix) instead of discarding data. |
| R6 | Unknown price | `NaN` reaches the text node (C6). | `NaN` shown to the user. | Placeholder `—`. |

### 1.6 Robustness

| # | Issue |
|---|-------|
| B1 | Unknown blockchains map to `-99` and are dropped by the (intended) filter. That is the right behaviour, but it is implicit: nothing documents or tests it. |
| B2 | Equal-priority chains (Zilliqa, Neo) need a deterministic secondary key; otherwise the order follows the data source (C3). |
| B3 | While prices load, every USD value is unknown; the UI must be able to represent that (C6). |
| B4 | Money is a JavaScript `number` here. That is dictated by the challenge's `WalletBalance`; for real balances and prices use decimal strings or integers (Problem 2 of this repository does this with a BigInt decimal). |

---

## 2. Review of the earlier notes (`WhatWrong.txt`) and `solution.tsx`

The earlier notes found most real problems. Precision corrections:

| Earlier claim | Verdict |
|---------------|---------|
| `getPriority(blockchain: any)` uses `any` | Correct. |
| `WalletBalance` lacks `blockchain` | Correct. |
| "`Props extends BoxProps` is declared but `children` is unused" | Imprecise. The declaration is not the problem; `children` is destructured and never rendered (R3), and the interface is empty (T3). |
| `lhsPriority` never defined; filter keeps only `amount <= 0` | Correct (C1, C2). |
| "Comparator doesn't return 0 for equal priority" | Correct, but it lacked the consequence. It is a type error; at runtime `undefined` is coerced to 0, so nothing crashes (C3). |
| "the comparator is asymmetrical" | Incorrect. It is consistent where it returns; it is *incomplete*. |
| "`useMemo` depends on `prices` ... causing needless re-renders" | Imprecise: needless **recomputation**, not re-renders (H1). |
| "`getPriority` recreated every render; use a module-level constant **map**" | Correct. Note that a plain object lookup (`PRIORITY[b]`) finds `Object.prototype` members for keys like `"constructor"`; the refactor uses a `Map`. |
| `formatted` mismatch | Correct (C5). |
| "`key={index}` leads to unstable reconciliation" | Correct, now demonstrated by a test. |
| "`toFixed()` ... **returns a string**; precision likely wrong" | Half right. Returning a string is expected for display; the 0-digit rounding is the defect (C7). |
| `...rest` onto a `div` may receive non-DOM props | Correct, and conditional on what `BoxProps` is (R4). |
| `prices[...]` undefined -> NaN; `classes.row` undefined | Correct. |

Problems in the earlier `solution.tsx`:

- **It could not compile**: `BoxProps`, `WalletRow`, `useWalletBalances`, `usePrices`, `useMemo` and React were never imported or declared.
- `?? 0` on the price hides a missing price as a confident, wrong **$0.00**. That is worse than `NaN`, which at least looks broken.
- `.slice()` after `.filter()` is redundant (A4).
- `toFixed(2)` trades one precision bug for another: a `0.0000004` token shows `0.00`, and large values get no grouping.
- `amount > 0` lets `Infinity` through.
- No tie-break for Zilliqa vs Neo.
- Three chained `useMemo`s, including one around JSX elements; more machinery than benefit.
- `Props extends BoxProps {}` is still empty; `children` and the row class were silently dropped instead of being handled.
- `Record<Blockchain, number>` plus `?? -99` is contradictory: the type says the fallback is unreachable, the data says otherwise. And the key `` `${blockchain}-${currency}` `` collides for duplicate entries.
- `useWalletBalances() as WalletBalance[]` casts hide type errors rather than fixing them.
- No tests.

---

## 3. The refactor

### Files

| File | Role |
|------|------|
| `types.ts` | `Blockchain` union, `WalletBalance` (with `blockchain`), `FormattedWalletBalance`, `PriceMap`, `WalletRowData`. |
| `wallet-utils.ts` | Pure, framework-free helpers: priority table, `getPriority`, `isDisplayable`, `compareBalances`, `formatAmount`, `formatUsd`, `usdValue`, `rowKey`, `toRows`. |
| `context.tsx` | **Stand-ins** for what the snippet leaves undefined (see Assumptions). |
| `solution.tsx` | The refactored `WalletPage`. |
| `wallet-utils.test.ts`, `solution.test.tsx` | 62 tests. |

### Decisions

- **Logic out of the component.** Everything that can be wrong (filter, order, format, value, keys) is a pure function, tested without React. The component only wires hooks to rows.
- **Priority table at module level**, as a `Map`, so unknown and prototype names (`"constructor"`, `"__proto__"`) are unknown chains.
- **Filter**: known chain, finite amount, amount > 0.
- **Order**: priority descending, then currency ascending, then blockchain ascending, then amount descending. It is a total order, so the output does not depend on the input order (tested with permutations). Plain code-unit comparison is used instead of `localeCompare`, so the order does not depend on the runtime locale.
- **Formatting**: `Intl.NumberFormat("en-US")` with up to 8 fraction digits, built once at module level (constructing a formatter per row per render is expensive). A positive amount that would round to zero shows `<0.00000001`. NaN/Infinity show `—`. `-0` shows `0`.
- **USD value** is `number | null`. `null` (rendered `—`) when the price is missing, non-finite, `<= 0`, or the product overflows. A price of `0` is treated as unknown: an unloaded feed is far more likely than a worthless token, and "$0.00" would be a confident lie.
- **Keys**: `blockchain:currency`. Exact duplicates are **kept** (no data is invented or dropped) and get `#2`, `#3`... in sorted order, so keys are unique.
- **Props**: `WalletPageProps extends BoxProps` has a real member (`rowClassName`), which is removed before the rest is spread onto the `<div>`; `children` is rendered before the rows.
- **No `React.FC`, no `any`, no casts.**

### Why one `useMemo`

The derivation `toRows(balances, prices)` is a single pure function of exactly two inputs, so a single `useMemo` with exactly `[balances, prices]` is correct and complete. I measured it (Node 26, `toRows`, 20-run average):

| rows | time per call |
|------|---------------|
| 10 | 0.008 ms |
| 100 | 0.066 ms |
| 1 000 | 0.73 ms |
| 10 000 | 7.3 ms |

So memoization is **not** needed for speed at wallet sizes, and the component would be equally correct without it. It is kept because it is cheap insurance with a precise contract: when the page re-renders for reasons unrelated to the data (a parent passing a new `className`, say), the sort and the N `Intl` calls are skipped, provided the hooks return stable references. `solution.test.tsx` pins that behaviour (the spy sees one call across unrelated re-renders, and a new call when `balances` or `prices` change). If the hooks return fresh arrays on every render, the memo does nothing, and it should be removed. The JSX itself is deliberately not memoized.

### Assumptions about the undefined names (`context.tsx`)

- `BoxProps` = `HTMLAttributes<HTMLDivElement>`. If it is really a design-system type, R4 applies and the non-DOM props must be removed before spreading.
- `useWalletBalances()` returns `readonly WalletBalance[]` synchronously (empty array while loading); `usePrices()` returns a `PriceMap` (empty while loading). They read a React context, so tests can feed them.
- `WalletRow` accepts the snippet's props plus `currency`, `blockchain` (labels) and a **nullable** `usdValue`. The real component is not given; its contract would need the same nullable value.
- Balances are plain JS numbers (challenge-imposed, see B4); prices are USD per unit.
- `classes.row` is replaced by an optional `rowClassName` prop.

### Tests

`npm test -- --run`: 62 tests in two files.

- `wallet-utils.test.ts`: legacy (buggy) logic reimplemented inside the test to show the difference (inverted filter, tie order depends on input, ReferenceError); priorities incl. prototype names; `isDisplayable` for 0 / negative / -0 / NaN / ±Infinity / unknown chain; comparator totality and antisymmetry; formatting (including the `toFixed()` surprises for contrast); `usdValue` with missing, zero, negative, NaN, Infinity price and overflow; `toRows` (pipeline, no mutation of inputs, order independence over permutations, duplicates, same currency on two chains).
- `solution.test.tsx`: row order and filtering; formatted amount and USD; placeholder instead of `NaN`; empty list / empty prices; children first, DOM props forwarded; `rowClassName` not leaking; no React key warnings with duplicates; **DOM node identity** preserved when rows are inserted or removed (and the `key={index}` counterexample); memo call counts.

Mutation check (temporary copy, not in the repo): replacing the key with the index, inverting the filter, removing the currency tie-break, dropping `prices` from the memo deps, using `toFixed()`, and removing the price guard each made at least one test fail.

### Run it

```bash
cd problem3
npm ci
npm run typecheck
npm test -- --run
```

Requires Node `^22.22.2 || ^24.15.0 || >=26` (jsdom 31's range).
