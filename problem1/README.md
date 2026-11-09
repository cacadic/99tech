# Problem 1: Three ways to sum to n

> Provide 3 unique implementations of the following function in JavaScript.
>
> **Input**: `n` - any integer
>
> _Assuming this input will always produce a result lesser than `Number.MAX_SAFE_INTEGER`_.
>
> **Output**: `return` - summation to `n`, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.

`problem1.js` exports `sum_to_n_a`, `sum_to_n_b` and `sum_to_n_c` (plus the constant `MAX_N`) as ES module named exports. The demo only runs when the file is executed directly, never on import.

## Run

```bash
cd problem1
npm start   # sum_to_n_*(5) and a small table for n = 0, 1, 10, 134217727
npm test    # built-in node:test runner, nothing to install
```

Requires Node.js 22 or newer (developed and tested on v26.13.0). There are no dependencies; `package-lock.json` is the empty lockfile that lets `npm ci` run here like in the other problems.

```js
import { sum_to_n_a, sum_to_n_b, sum_to_n_c, MAX_N } from "./problem1.js";

sum_to_n_b(5); // 15
```

## Conventions and assumptions

The statement says "any integer" but only defines the sum for `n >= 1`, and lets us ignore results above `Number.MAX_SAFE_INTEGER`. All three functions follow the same rules, enforced by one shared validator (`termCount` in `problem1.js`):

| Input                                                                                                         | Result                       | Reason                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `1 <= n <= MAX_N`                                                                                             | `n(n + 1) / 2`, always exact | the contract                                                                                               |
| `n <= 0` (including `-0`)                                                                                     | `0`                          | empty sum. The statement defines nothing here, and `0` is what the loop `for (i = 1; i <= n; i++)` yields  |
| `MAX_N < n <= Number.MAX_SAFE_INTEGER`                                                                        | `RangeError`                 | the sum would exceed `Number.MAX_SAFE_INTEGER`; failing is better than returning a silently rounded number |
| not a safe integer: `NaN`, `±Infinity`, `1.5`, `"5"`, `5n`, `null`, `undefined`, `{}`, `[]`, `2 ** 53` and up | `TypeError`                  | no coercion. The original returned `15`, `127.5` and `"510"` for `"5"` from its three functions            |

`MAX_N = 134217727 = 2 ** 27 - 1`. The sum for `MAX_N` is `2 ** 53 - 2 ** 26 = 9007199187632128`, below `Number.MAX_SAFE_INTEGER` (`9007199254740991`), while the sum for `2 ** 27` is `2 ** 53 + 2 ** 26`, above it (checked with BigInt in the tests). Supporting larger `n` would mean returning a BigInt, a different return type that the statement rules out.

Rejected alternative for negative `n`: the "oriented sum" `n(n + 1) / 2` (what the original `sum_to_n_b` returned, e.g. `10` for `n = -5`). It gives a positive number for "1 + ... + n" with a negative `n`, and it disagreed with the other two functions.

## The three implementations

|              | (a) loop                                 | (b) closed form                                        | (c) halving recursion                                                |
| ------------ | ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Idea         | add `1 + 2 + ... + n`                    | Gauss: `n(n + 1) / 2`                                  | `S(2m) = 4 * S(m) - m`, `S(2m + 1) = S(2m) + 2m + 1`                 |
| Time         | O(n)                                     | O(1)                                                   | O(log n)                                                             |
| Space        | O(1)                                     | O(1)                                                   | O(log n) stack, 28 frames at most (27 halvings + base)               |
| Near `MAX_N` | about 0.54 s cold, about 0.09 s warm     | about 12 ns warm                                       | about 0.4 µs warm                                                    |
| Trade-off    | obviously correct, but cost grows with n | fastest; needs the formula and care with intermediates | no closed form needed and no deep stack, but more intricate than (b) |

### (b) Why the even factor is halved first

The textbook `n * (n + 1) / 2` multiplies first. That product is already above `Number.MAX_SAFE_INTEGER` from `n = 94906266` on, which is 29 % of the supported range. It still comes out exact there only because it is even and below `2 ** 54` (all 39,311,462 values of that zone were checked against BigInt); one step beyond `MAX_N` the same expression silently returns wrong numbers (first at `n = 134217729`).

`(n / 2) * (n + 1)` for even `n` and `n * ((n + 1) / 2)` for odd `n` keep both factors and the product as integers no larger than the result, so nothing relies on that coincidence.

### (c) Derivation

Among `1..2m` the even terms `2, 4, ..., 2m` add up to `2 * S(m)`, and the odd terms `1, 3, ..., 2m - 1` add up to `2 * S(m) - m`. Hence:

- `S(2m) = 4 * S(m) - m`
- `S(2m + 1) = S(2m) + (2m + 1)`
- `S(0) = 0`

Example: `S(5)`: `m = 2`, `S(4) = 4 * S(2) - 2 = 4 * 3 - 2 = 10`, so `S(5) = 10 + 5 = 15`.

`n` is halved on every call, so the recursion makes (bit length of `n`) + 1 calls: 28 for `MAX_N`, pinned by a test. The naive `n + f(n - 1)`, which is what the original `sum_to_n_c` did, needs `n` frames and overflows the call stack after roughly ten thousand (see below), which is under 0.01 % of the supported range.

## Compared with the original submission

Measured by running the original file (Node.js v26.13.0):

| Input              | Original `a` / `b` / `c`                                    | Now                   |
| ------------------ | ----------------------------------------------------------- | --------------------- |
| `-5`               | `0` / `10` / `-5`                                           | `0` for all three     |
| `-1`               | `0` / `-0` / `-1`                                           | `0` for all three     |
| `1.5`              | `1` / `1.875` / `2`                                         | `TypeError`           |
| `NaN`              | `0` / `NaN` / stack overflow                                | `TypeError`           |
| `Infinity`         | never returns (infinite loop) / `Infinity` / stack overflow | `TypeError`           |
| `"5"`              | `15` / `127.5` / `"510"`                                    | `TypeError`           |
| `100000`           | ok / ok / `RangeError: Maximum call stack size exceeded`    | ok                    |
| `134217729`        | off by one / off by one / stack overflow                    | `RangeError`          |
| importing the file | prints `15 15 15`, exports nothing                          | silent, named exports |

## Tests

`npm test` runs `problem1.test.js` with `node:test` and `node:assert/strict`:

- known values (`0, 1, 2, 5, 10, 100, ...`), negative numbers and `-0` for all three functions;
- a BigInt reference as oracle: every `n` from `-5` to `2000` (all three), a seeded random sample (`mulberry32`, fixed seed, so failures reproduce) up to `1e6` (all three) and over the whole range (b and c), every `n` in two windows around `MAX_N` and around `94906266`, and the neighbours of every power of two;
- boundaries: `MAX_N` is exact, `MAX_N + 1`, `2 ** 40` and `Number.MAX_SAFE_INTEGER` throw `RangeError`, 22 kinds of non-safe-integer input throw `TypeError`;
- intermediate values: the arithmetic of (b) and (c) is replayed in BigInt to show that every step stays a safe integer at the boundary, while `n * (n + 1)` does not;
- cost: the loop at `MAX_N` finishes in under 5 s, (b) and (c) answer in well under 20 ms, (c) makes exactly `bit length + 1` calls, and the naive recursion overflows the stack at `MAX_N` where (c) does not;
- command line: the demo prints when run directly (also through a symlink) and prints nothing when imported.

## Measured numbers

Environment: Node.js v26.13.0, macOS arm64 (Apple M4 Pro), default `--stack-size=984`. Timings vary by machine; the stack depth also varies with the JIT state of the function.

| What                                                   | Result                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Naive `n + f(n - 1)` overflows the call stack at       | 8,875 frames in a cold process; up to about 12,400 once V8 has optimized the function                   |
| `sum_to_n_a(MAX_N)`                                    | 536 to 560 ms for the first call in 12 fresh processes; 87 to 95 ms for later calls in the same process |
| `sum_to_n_b` / `sum_to_n_c`, first call at `MAX_N`     | 25 to 31 µs / 34 to 39 µs                                                                               |
| `sum_to_n_b` / `sum_to_n_c`, warm mean over random `n` | 12 ns / 410 ns per call                                                                                 |

Reproduce the first two rows:

```bash
for n in 8000 20000; do
  node -e "const f = (n) => (n <= 0 ? 0 : n + f(n - 1)); try { console.log($n, f($n)); } catch (e) { console.log($n, e.name); }"
done
node -e "import('./problem1.js').then(({ sum_to_n_a, MAX_N }) => { const t = performance.now(); sum_to_n_a(MAX_N); console.log(Math.round(performance.now() - t), 'ms'); })"
```
