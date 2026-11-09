// One <img> per token instead of inlined SVG: no id collisions between icons, and a broken file can be detected.
const iconUrls = import.meta.glob<string>("../assets/tokens/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const urlBySymbol = new Map(
  Object.entries(iconUrls).map(([path, url]) => [
    (path.split("/").at(-1) ?? "").replace(/\.svg$/, "").toLowerCase(),
    url,
  ]),
);

export function tokenIconUrl(symbol: string): string | undefined {
  return urlBySymbol.get(symbol.toLowerCase());
}
