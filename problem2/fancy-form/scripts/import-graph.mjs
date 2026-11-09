// Which source files, shadcn components and npm packages does an entry point really reach?
// Usage: node scripts/import-graph.mjs <projectRoot> <entryRelativeToRoot>
//   e.g. node scripts/import-graph.mjs . src/main.tsx
// Used to decide, from evidence, which components and dependencies could be dropped.
import fs from "node:fs";
import path from "node:path";

const [root, entry] = process.argv.slice(2);
if (root === undefined || entry === undefined) {
  console.error("usage: node scripts/import-graph.mjs <projectRoot> <entry>");
  process.exit(2);
}

const EXTENSIONS = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];
const seen = new Set();
const packages = new Set();

function resolveImport(from, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(from), specifier);
  const clean = base.replace(/\?[a-z]+$/, "");
  for (const extension of EXTENSIONS) {
    const candidate = clean + extension;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!/\.(tsx?|jsx?)$/.test(file)) return;

  const source = fs.readFileSync(file, "utf8");
  const pattern =
    /(?:import|export)[^'"`]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier === undefined) continue;
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const target = resolveImport(file, specifier);
      if (target === null) console.error("UNRESOLVED", specifier, "in", path.relative(root, file));
      else visit(target);
    } else if (!specifier.endsWith(".css")) {
      packages.add(
        specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0],
      );
    }
  }
}

visit(path.resolve(root, entry));

const files = [...seen].map((file) => path.relative(root, file)).sort();
const uiDir = path.join(root, "src/shared/components/ui");
const allUi = fs.existsSync(uiDir) ? fs.readdirSync(uiDir) : [];
const usedUi = files
  .filter((file) => file.includes("components/ui/"))
  .map((file) => path.basename(file));

console.log("reachable source files:", files.length);
console.log("shadcn components used:", usedUi.join(", ") || "-");
console.log(
  `shadcn components never imported (${allUi.length - usedUi.length}):`,
  allUi.filter((f) => !usedUi.includes(f)).join(", ") || "-",
);
console.log("npm packages imported at runtime:", [...packages].sort().join(", "));
