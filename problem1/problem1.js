/*
Provide 3 unique implementations of the following function in JavaScript.
**Input**: `n` - any integer

*Assuming this input will always produce a result lesser than `Number.MAX_SAFE_INTEGER`*.

**Output**: `return` - summation to `n`, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.
*/

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/*
The statement does not define n <= 0 or inputs that are not integers, so all
three implementations share the rules enforced by termCount(). With
S(n) = 1 + 2 + ... + n = n(n + 1) / 2:
  - n must be a safe integer, otherwise a TypeError is thrown;
  - n <= 0 is an empty sum and returns 0;
  - n > MAX_N throws a RangeError instead of returning a rounded number.
*/

// S(2 ** 27 - 1) = 2 ** 53 - 2 ** 26 is the last value below
// Number.MAX_SAFE_INTEGER; S(2 ** 27) = 2 ** 53 + 2 ** 26 is already above it.
export const MAX_N = 2 ** 27 - 1;

function describeValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    return Object.prototype.toString.call(value);
  }
  return String(value);
}

function termCount(n) {
  if (!Number.isSafeInteger(n)) {
    throw new TypeError(`n must be a safe integer, received ${describeValue(n)}`);
  }
  if (n > MAX_N) {
    throw new RangeError(
      `n must be at most ${MAX_N} so that the sum stays within Number.MAX_SAFE_INTEGER, received ${n}`,
    );
  }
  return Math.max(n, 0);
}

/** Iterative loop: O(n) time, O(1) space. */
export function sum_to_n_a(n) {
  const k = termCount(n);
  let sum = 0;
  for (let i = 1; i <= k; i++) {
    sum += i;
  }
  return sum;
}

/**
 * Closed form S(n) = n(n + 1) / 2: O(1) time, O(1) space.
 *
 * Either n or n + 1 is even, so that factor is halved before multiplying.
 * Both factors and their product are then integers no larger than the result,
 * whereas the textbook n * (n + 1) is already above Number.MAX_SAFE_INTEGER
 * for n >= 94906266 and is only exact there because it is even and below 2 ** 54.
 */
export function sum_to_n_b(n) {
  const k = termCount(n);
  return k % 2 === 0 ? (k / 2) * (k + 1) : k * ((k + 1) / 2);
}

/**
 * Divide and conquer: O(log n) time and O(log n) recursion depth.
 *
 * Among 1..2m the even terms add up to 2 * S(m) and the odd terms to
 * 2 * S(m) - m, so S(2m) = 4 * S(m) - m and S(2m + 1) = S(2m) + (2m + 1).
 * n is halved on every call (at most 28 frames for any supported n), while the
 * naive n + f(n - 1) overflows the call stack after roughly ten thousand frames.
 */
export function sum_to_n_c(n) {
  const k = termCount(n);
  if (k === 0) return 0;
  const m = Math.floor(k / 2);
  const sumTo2m = 4 * sum_to_n_c(m) - m;
  return k % 2 === 0 ? sumTo2m : sumTo2m + k;
}

function runDemo() {
  const implementations = [sum_to_n_a, sum_to_n_b, sum_to_n_c];

  console.log("sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15");
  for (const sum of implementations) {
    console.log(`${sum.name}(5) = ${sum(5)}`);
  }

  const header = ["n", ...implementations.map((sum) => sum.name)];
  const rows = [0, 1, 10, MAX_N].map((n) => [n, ...implementations.map((sum) => sum(n))]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => String(row[column]).length)),
  );
  const formatRow = (cells) =>
    cells.map((cell, column) => String(cell).padStart(widths[column])).join("  ");

  console.log(`\n${formatRow(header)}`);
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

// argv[1] is not resolved through symlinks (e.g. macOS /tmp -> /private/tmp)
// while import.meta.url is, so resolve it before comparing. It is undefined or
// not a file when the module is imported from `node --eval`, hence the catch.
function isEntryPoint() {
  try {
    const entry = realpathSync(process.argv[1]);
    return pathToFileURL(entry).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  runDemo();
}
