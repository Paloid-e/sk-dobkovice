// Složí web do dist/: src/layout.html + src/pages/*.html + data/*.json.
// Bez závislostí, Node 20+.
//
//   node scripts/build.mjs            sestaví dist/
//   node scripts/build.mjs --serve    sestaví a pustí náhled na http://localhost:8080
//
// Stránka src/pages/x.html → dist/x/index.html (index.html zůstává v kořeni).
// Na začátku stránky je komentář s „title:“ a „description:“. V šablonách fungují
// {{zástupné-bloky}}; {{root}} je cesta ke kořeni webu ("" nebo "../").

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildState, render as renderSeason } from "./season.mjs";
import { renderSponsors } from "./sponsors.mjs";
import { renderNews, renderTeam, renderShop } from "./content.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// href bez {{root}}; položky s # míří na úvodní stránku
export const NAV = [
  { label: "Aktuality", href: "aktuality/", page: "aktuality" },
  { label: "Tým", href: "tym/", page: "tym" },
  { label: "Zápasy", href: "#zapasy" },
  { label: "Tabulka", href: "#tabulka" },
  { label: "Historie", href: "historie/", page: "historie" },
  { label: "Klub", href: "klub/", page: "klub" },
  { label: "Sponzoři", href: "sponzori/", page: "sponzori" },
  { label: "Fanshop", href: "fanshop/", page: "fanshop" },
];

export function fill(template, vars) {
  const value = (name) => {
    if (!(name in vars)) throw new Error(`Neznámý blok {{${name}}}`);
    return vars[name];
  };
  return template
    // blok na vlastním řádku si nese vlastní odsazení
    .replace(/^[ \t]*\{\{([\w-]+)\}\}[ \t]*$/gm, (_, name) => value(name))
    .replace(/\{\{([\w-]+)\}\}/g, (_, name) => value(name));
}

export function parsePage(source) {
  const head = source.match(/^<!--\s*\n([\s\S]*?)-->\s*\n/);
  if (!head) throw new Error("Stránka nemá úvodní komentář s title/description");
  const meta = Object.fromEntries(
    head[1].split("\n").filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
  );
  return { meta, body: source.slice(head[0].length).trimEnd() };
}

function nav(root, current) {
  return NAV.map(({ label, href, page }) => {
    const here = page && page === current;
    const url = href.startsWith("#") ? (current === "index" ? href : `${root}${href}`) : `${root}${href}`;
    return `      <a href="${url}"${here ? ' aria-current="page"' : ""}>${label}</a>`;
  }).join("\n");
}

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 8);
const json = async (file) => JSON.parse(await readFile(path.join(ROOT, "data", file), "utf8"));

export async function build(out = path.join(ROOT, "dist"), now = new Date()) {
  const [layout, css, js, season, sponsors, team, shop, news] = await Promise.all([
    readFile(path.join(ROOT, "src/layout.html"), "utf8"),
    readFile(path.join(ROOT, "src/assets/styles.css"), "utf8"),
    readFile(path.join(ROOT, "src/assets/site.js"), "utf8"),
    json("season.json"),
    json("sponsors.json"),
    json("team.json"),
    json("shop.json"),
    json("news.json").catch(() => []), // články jsou doplněk, web se složí i bez nich
  ]);
  const state = buildState(season.matches, season.table, now);

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(path.join(ROOT, "public"), out, { recursive: true });
  await cp(path.join(ROOT, "src/assets"), path.join(out, "assets"), { recursive: true });

  const pages = (await readdir(path.join(ROOT, "src/pages"))).filter((f) => f.endsWith(".html"));
  for (const file of pages) {
    const name = file.replace(/\.html$/, "");
    const root = name === "index" ? "" : "../";
    const { meta, body } = parsePage(await readFile(path.join(ROOT, "src/pages", file), "utf8"));
    const blocks = {
      root,
      ...renderSeason(state, root),
      ...renderSponsors(sponsors, root),
      ...renderNews(news),
      ...renderTeam(team),
      ...renderShop(shop, root),
    };
    const html = fill(layout, {
      root,
      home: root || "./",
      title: attr(meta.title ?? "SK Dobkovice"),
      description: attr(meta.description ?? ""),
      nav: nav(root, name),
      content: fill(body, blocks),
      "css-version": hash(css),
      "js-version": hash(js),
    });
    const target = name === "index" ? path.join(out, "index.html") : path.join(out, name, "index.html");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html);
  }
  return { pages: pages.length, state };
}

/* ---------- náhled ---------- */

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

function serve(dir, port = 8080) {
  createServer(async (req, res) => {
    let file = path.normalize(path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (!path.extname(file)) file = path.join(file, "index.html");
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(data);
    } catch {
      res.writeHead(404).end("404");
    }
  }).listen(port, () => console.log(`Náhled: http://localhost:${port}`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(ROOT, "dist");
  build(out)
    .then(({ pages, state }) => {
      console.log(`dist/ hotovo — ${pages} stránky, ${state.me.pos}. místo po ${state.round}. kole.`);
      if (process.argv.includes("--serve")) serve(out);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
