import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as problem1 from "./problem1.js";
import { MAX_N, sum_to_n_a, sum_to_n_b, sum_to_n_c } from "./problem1.js";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const LARGEST_SUM = 2 ** 53 - 2 ** 26;
const FIRST_UNSAFE_PRODUCT = 94_906_266;
const SEED = 20261109;

const implementations = [
  ["sum_to_n_a", sum_to_n_a],
  ["sum_to_n_b", sum_to_n_b],
  ["sum_to_n_c", sum_to_n_c],
];
const subLinear = implementations.slice(1);

const notSafeIntegers = [
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
  ["1.5", 1.5],
  ["-1.5", -1.5],
  ["Number.EPSILON", Number.EPSILON],
  ["Number.MAX_VALUE", Number.MAX_VALUE],
  ["Number.MAX_SAFE_INTEGER + 1", Number.MAX_SAFE_INTEGER + 1],
  ["Number.MIN_SAFE_INTEGER - 1", Number.MIN_SAFE_INTEGER - 1],
  ['"5"', "5"],
  ['""', ""],
  ["null", null],
  ["undefined", undefined],
  ["true", true],
  ["5n", 5n],
  ["{}", {}],
  ["Object.create(null)", Object.create(null)],
  ["[]", []],
  ["[5]", [5]],
  ["new Number(5)", new Number(5)],
  ["Symbol()", Symbol("n")],
  ["() => 5", () => 5],
];

function reference(n) {
  const k = BigInt(n);
  return k > 0n ? (k * (k + 1n)) / 2n : 0n;
}

function expected(n) {
  return Number(reference(n));
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function randomInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function assertExact(name, sum, n) {
  assert.equal(sum(n), expected(n), `${name}(${n})`);
}

function fastestRunMs(runs, task) {
  let fastest = Infinity;
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    task();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

// Heavy sampling tests call b and c millions of times: if one of them silently
// became O(n) they would run for hours instead of failing, so check up front.
function assertSubLinear() {
  for (const [name, sum] of subLinear) {
    const fastest = fastestRunMs(3, () => sum(MAX_N));
    assert.ok(
      fastest < 20,
      `${name}(MAX_N) took ${fastest.toFixed(1)} ms, is it still sub-linear?`,
    );
  }
}

// Replays the recurrence of sum_to_n_c in exact BigInt arithmetic and returns
// every value it produces, so that safety can be asserted for each of them.
function halvingTrace(n) {
  const sizes = [];
  for (let k = BigInt(n); k > 0n; k /= 2n) sizes.push(k);

  const values = [];
  let sum = 0n;
  for (const k of sizes.reverse()) {
    const m = k / 2n;
    const quadrupled = 4n * sum;
    const sumTo2m = quadrupled - m;
    sum = k % 2n === 0n ? sumTo2m : sumTo2m + k;
    values.push(quadrupled, sumTo2m, sum);
  }
  return { values, result: sum };
}

describe("public API", () => {
  it("exports the three functions and MAX_N, nothing else", () => {
    assert.deepEqual(Object.keys(problem1), ["MAX_N", "sum_to_n_a", "sum_to_n_b", "sum_to_n_c"]);
    for (const [name, sum] of implementations) {
      assert.equal(sum.name, name);
    }
  });

  it("MAX_N is the largest n whose sum is a safe integer", () => {
    assert.equal(MAX_N, 134217727);
    assert.equal(MAX_N, 2 ** 27 - 1);
    assert.ok(reference(MAX_N) <= MAX_SAFE);
    assert.ok(reference(MAX_N + 1) > MAX_SAFE);
    assert.equal(reference(MAX_N), BigInt(LARGEST_SUM));
  });
});

for (const [name, sum] of implementations) {
  describe(name, () => {
    it("returns 15 for the example in the statement", () => {
      assert.equal(sum(5), 15);
    });

    it("returns the known sums", () => {
      const known = [
        [1, 1],
        [2, 3],
        [3, 6],
        [4, 10],
        [5, 15],
        [10, 55],
        [100, 5050],
        [1000, 500500],
        [65536, 2147516416],
        [1e6, 500000500000],
      ];
      for (const [n, want] of known) {
        assert.equal(sum(n), want, `${name}(${n})`);
      }
    });

    it("treats n <= 0 as an empty sum and returns +0, never a negative number or -0", () => {
      const nonPositive = [0, -0, -1, -2, -5, -100, -(MAX_N + 1), Number.MIN_SAFE_INTEGER];
      for (const n of nonPositive) {
        assert.equal(sum(n), 0, `${name}(${n})`);
      }
    });

    it("accepts integral floats such as 5.0 and 1e3", () => {
      assert.equal(sum(5.0), 15);
      assert.equal(sum(1e3), 500500);
    });

    it("returns the largest supported sum at MAX_N", () => {
      const result = sum(MAX_N);
      assert.equal(result, LARGEST_SUM);
      assert.ok(Number.isSafeInteger(result));
    });

    it("throws a RangeError above MAX_N instead of returning a rounded number", () => {
      for (const n of [MAX_N + 1, 2 ** 28, 2 ** 40, Number.MAX_SAFE_INTEGER]) {
        assert.throws(
          () => sum(n),
          { name: "RangeError", message: /Number\.MAX_SAFE_INTEGER/ },
          `${name}(${n})`,
        );
      }
    });

    it("throws a TypeError for everything that is not a safe integer", () => {
      for (const [label, value] of notSafeIntegers) {
        assert.throws(
          () => sum(value),
          { name: "TypeError", message: /safe integer/ },
          `${name}(${label})`,
        );
      }
      assert.throws(() => sum(), { name: "TypeError" });
    });
  });
}

describe("consistency", () => {
  it("all three match the BigInt reference for every n from -5 to 2000", () => {
    for (let n = -5; n <= 2000; n++) {
      for (const [name, sum] of implementations) {
        assertExact(name, sum, n);
      }
    }
  });

  it(`all three match the BigInt reference on a seeded sample of n up to 1,000,000 (seed ${SEED})`, () => {
    const rand = mulberry32(SEED);
    for (let draw = 0; draw < 100; draw++) {
      const n = randomInt(rand, 0, 1_000_000);
      for (const [name, sum] of implementations) {
        assertExact(`${name} [draw ${draw}]`, sum, n);
      }
    }
  });

  it(`b and c match the BigInt reference on a seeded sample over the whole range (seed ${SEED})`, () => {
    assertSubLinear();
    const rand = mulberry32(SEED);
    for (let draw = 0; draw < 20_000; draw++) {
      const n = randomInt(rand, 0, MAX_N);
      for (const [name, sum] of subLinear) {
        assertExact(`${name} [draw ${draw}]`, sum, n);
      }
    }
  });

  it("b and c are exact for every n near the boundary and near the first unsafe n * (n + 1)", () => {
    assertSubLinear();
    const windows = [
      [MAX_N - 200_000, MAX_N],
      [FIRST_UNSAFE_PRODUCT - 100_000, FIRST_UNSAFE_PRODUCT + 100_000],
    ];
    for (const [from, to] of windows) {
      for (let n = from; n <= to; n++) {
        for (const [name, sum] of subLinear) {
          assertExact(name, sum, n);
        }
      }
    }
  });

  it("b and c are exact around every power of two", () => {
    assertSubLinear();
    for (let power = 0; 2 ** power <= MAX_N + 1; power++) {
      for (const n of [2 ** power - 1, 2 ** power, 2 ** power + 1]) {
        if (n > MAX_N) continue;
        for (const [name, sum] of subLinear) {
          assertExact(name, sum, n);
        }
      }
    }
  });

  it("a, b and c agree on the largest supported n", () => {
    const [a, b, c] = implementations.map(([, sum]) => sum(MAX_N));
    assert.equal(a, LARGEST_SUM);
    assert.equal(b, a);
    assert.equal(c, a);
  });

  it("the seeded generator is reproducible", () => {
    const first = mulberry32(SEED);
    const second = mulberry32(SEED);
    const other = mulberry32(SEED + 1);
    const draws = Array.from({ length: 50 }, () => first());
    assert.deepEqual(
      draws,
      Array.from({ length: 50 }, () => second()),
    );
    assert.notDeepEqual(
      draws,
      Array.from({ length: 50 }, () => other()),
    );
    assert.ok(draws.every((value) => value >= 0 && value < 1));
  });
});

describe("intermediate values stay safe at the boundary", () => {
  it("b: n * (n + 1) is unsafe from n = 94,906,266, but the halved factors never are", () => {
    const product = (n) => BigInt(n) * BigInt(n + 1);
    assert.ok(product(FIRST_UNSAFE_PRODUCT - 1) <= MAX_SAFE);
    assert.ok(product(FIRST_UNSAFE_PRODUCT) > MAX_SAFE);
    assert.ok(product(MAX_N) > MAX_SAFE);

    const probes = [FIRST_UNSAFE_PRODUCT, FIRST_UNSAFE_PRODUCT + 1, MAX_N - 1, MAX_N];
    for (const n of probes) {
      const k = BigInt(n);
      const [x, y] = k % 2n === 0n ? [k / 2n, k + 1n] : [k, (k + 1n) / 2n];
      assert.ok(x <= MAX_SAFE && y <= MAX_SAFE && x * y <= MAX_SAFE, `n = ${n}`);
      assert.equal(sum_to_n_b(n), Number(x * y), `sum_to_n_b(${n})`);
    }
  });

  it("c: every value of the halving recursion is a safe integer and none exceeds the result at MAX_N", () => {
    const { values, result } = halvingTrace(MAX_N);
    assert.equal(result, BigInt(LARGEST_SUM));
    assert.equal(values.length, 3 * 27);
    assert.ok(values.every((value) => value <= MAX_SAFE));
    assert.equal(
      values.reduce((largest, value) => (value > largest ? value : largest)),
      result,
    );
    assert.equal(sum_to_n_c(MAX_N), Number(result));
  });

  it(`c: the same holds for seeded n in the top 1,000,000 of the range (seed ${SEED})`, () => {
    assertSubLinear();
    const rand = mulberry32(SEED);
    for (let draw = 0; draw < 2000; draw++) {
      const n = randomInt(rand, MAX_N - 1_000_000, MAX_N);
      const { values, result } = halvingTrace(n);
      assert.ok(
        values.every((value) => value <= MAX_SAFE),
        `n = ${n}`,
      );
      assert.equal(result, reference(n), `n = ${n}`);
      assert.equal(sum_to_n_c(n), Number(result), `sum_to_n_c(${n})`);
    }
  });
});

describe("cost", () => {
  it("a: the O(n) loop handles MAX_N in well under 5 seconds", () => {
    const start = performance.now();
    const result = sum_to_n_a(MAX_N);
    const elapsed = performance.now() - start;
    assert.equal(result, LARGEST_SUM);
    assert.ok(elapsed < 5000, `sum_to_n_a(MAX_N) took ${elapsed.toFixed(0)} ms`);
  });

  it("b and c answer MAX_N in well under 20 ms, so there is no hidden O(n) work", () => {
    assertSubLinear();
  });

  it("c: makes bit-length(n) + 1 calls, which is O(log n)", (t) => {
    const isSafeInteger = t.mock.method(Number, "isSafeInteger");
    for (const n of [1, 2, 3, 5, 1000, 2 ** 20, MAX_N]) {
      isSafeInteger.mock.resetCalls();
      sum_to_n_c(n);
      assert.equal(isSafeInteger.mock.callCount(), n.toString(2).length + 1, `calls for n = ${n}`);
    }
    assert.equal(MAX_N.toString(2).length + 1, 28);
  });

  it("c: survives where the naive n + f(n - 1) overflows the call stack", () => {
    const naive = (n) => (n <= 0 ? 0 : n + naive(n - 1));
    assert.throws(() => naive(MAX_N), RangeError);
    assert.equal(sum_to_n_c(MAX_N), LARGEST_SUM);
  });
});

describe("command-line demo", () => {
  const modulePath = fileURLToPath(new URL("./problem1.js", import.meta.url));
  const packageDirectory = dirname(modulePath);
  const moduleUrl = pathToFileURL(modulePath).href;
  const run = (...args) =>
    execFileSync(process.execPath, args, { encoding: "utf8", cwd: packageDirectory });
  let scratch;

  before(() => {
    scratch = mkdtempSync(join(tmpdir(), "problem1-"));
  });

  after(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("prints sum_to_n_*(5) and the table for `node problem1.js`", () => {
    const output = run("problem1.js");
    for (const [name] of implementations) {
      assert.match(output, new RegExp(`^${name}\\(5\\) = 15$`, "m"));
    }
    assert.match(output, /^ +0 +0 +0 +0$/m);
    assert.match(output, /^ +1 +1 +1 +1$/m);
    assert.match(output, /^ +10 +55 +55 +55$/m);
    assert.match(output, /^134217727 +9007199187632128 +9007199187632128 +9007199187632128$/m);
  });

  it("prints nothing when another script imports the module", () => {
    const importer = join(scratch, "importer.mjs");
    writeFileSync(importer, `import ${JSON.stringify(moduleUrl)};\n`);
    assert.equal(run(importer), "");
  });

  it("prints nothing when imported from `node --eval`, where process.argv[1] is missing", () => {
    assert.equal(
      run("--input-type=module", "--eval", `await import(${JSON.stringify(moduleUrl)});`),
      "",
    );
  });

  it("is not fooled by an unrelated process.argv[1] that is not a file", () => {
    const script = `await import(${JSON.stringify(moduleUrl)});`;
    assert.equal(run("--input-type=module", "--eval", script, "not-a-file"), "");
  });

  it(
    "still runs the demo when started through a symlinked file or directory",
    { skip: process.platform === "win32" },
    () => {
      const fileLink = join(scratch, "link.js");
      const directoryLink = join(scratch, "package");
      symlinkSync(modulePath, fileLink);
      symlinkSync(packageDirectory, directoryLink, "dir");
      for (const entry of [fileLink, join(directoryLink, "problem1.js")]) {
        assert.match(run(entry), /^sum_to_n_a\(5\) = 15$/m, entry);
      }
    },
  );
});
