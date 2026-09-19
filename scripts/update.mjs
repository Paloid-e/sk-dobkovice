// Stáhne rozpis, výsledky a tabulku z IS FAČR (is.fotbal.cz — oficiální data fotbal.cz)
// a uloží je do data/season.json. Web z nich skládá scripts/build.mjs.
// Bez závislostí, Node 20+. Spouští .github/workflows/web.yml (so + ne večer).
//
//   node scripts/update.mjs            stáhne data a zapíše data/season.json + data/news.json
//   node scripts/update.mjs --dry      jen vypíše, co našel

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { COMPETITION, URL_MATCHES, URL_TABLE, URL_NEWS, NEWS_BASE, USER_AGENT } from "./config.mjs";
import { buildState } from "./season.mjs";

/* ---------- pomocné ---------- */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function text(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const pad = (n) => String(n).padStart(2, "0");

// Poslední neděle v měsíci (UTC den v měsíci) — pro letní čas
function lastSunday(year, month) {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}

// Offset Europe/Prague pro místní datum a čas: letní čas platí od poslední
// neděle v březnu do poslední neděle v říjnu.
export function pragueOffset(y, m, d, h = 12) {
  const stamp = m * 10000 + d * 100 + h;
  const from = 3 * 10000 + lastSunday(y, 2) * 100 + 2;
  const to = 10 * 10000 + lastSunday(y, 9) * 100 + 3;
  return stamp >= from && stamp < to ? "+02:00" : "+01:00";
}

/* ---------- parsování IS FAČR ---------- */

export function parseMatches(html) {
  const matches = [];
  // stránka = hlavičky kol (<h2 class="nadpis">5. kolo …) střídané tabulkami zápasů
  const parts = html.split(/<h2 class="nadpis">/).slice(1);
  for (const part of parts) {
    const round = parseInt(text(part.slice(0, part.indexOf("</h2>"))), 10);
    if (!round) continue;
    for (const row of part.match(/<tr class="type_[^"]*">[\s\S]*?<\/tr>/g) ?? []) {
      const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((m) => ({ attrs: m[1], html: m[2] }));
      const cell = (key) => cells.find((c) => c.attrs.includes(key));
      const home = cell("tdDomaci"), away = cell("tdHoste"), score = cell("tdScore");
      const when = text(cells[0]?.html ?? "").match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (!home || !away || !score || !when) continue;
      const [, dd, mm, yyyy, hh, min] = when;
      const iso = `${yyyy}-${mm}-${dd}T${pad(hh)}:${min}:00${pragueOffset(+yyyy, +mm, +dd, +hh)}`;
      const result = text(score.html).match(/^(\d+)\s*:\s*(\d+)/);
      const clean = (c) => text(c.html.replace(/<i>[\s\S]*?<\/i>/g, "")); // bez „(12)“
      const pitch = cells[cells.indexOf(score) + 1];
      matches.push({
        round,
        kickoff: iso,
        home: clean(home),
        away: clean(away),
        score: result ? [+result[1], +result[2]] : null,
        pitch: pitch ? text(pitch.html) : "",
      });
    }
  }
  return matches;
}

export function parseTable(html) {
  // první tabulka = celková (další jsou doma / venku)
  const start = html.indexOf("<table class='vysledky-tabulky'>");
  if (start < 0) return [];
  const block = html.slice(start, html.indexOf("</table>", start));
  const rows = [];
  for (const m of block.matchAll(/<tr\s*>([\s\S]*?)<\/tr>/g)) {
    const td = (cls) => {
      const c = m[1].match(new RegExp(`<td class='tab-item-${cls}[^']*'>([\\s\\S]*?)</td>`));
      return c ? text(c[1]) : null;
    };
    const name = td("druzstvo");
    const score = td("skore")?.match(/(\d+)\s*:\s*(\d+)/);
    if (!name || !score) continue;
    rows.push({
      pos: +td("cislo"), name,
      played: +td("zapasu"), w: +td("plus"), d: +td("nula"), l: +td("minus"),
      gf: +score[1], ga: +score[2], pts: +td("body"),
    });
  }
  return rows;
}

/* ---------- články klubu (estranky.cz) ---------- */

// Jen titulek, datum a odkaz — text článku zůstává na webu klubu.
export function parseNews(html) {
  const items = [];
  for (const block of html.split('<div class="article">').slice(1)) {
    const link = block.match(/<h2>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const date = block.match(/<p class="first">\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (!link || !date) continue;
    items.push({
      title: text(link[2]),
      date: `${date[3]}-${pad(date[2])}-${pad(date[1])}`,
      url: new URL(link[1], NEWS_BASE).href,
    });
  }
  return items;
}

/* ---------- běh ---------- */

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "cs" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

// bez časového razítka — soubor se změní jen tehdy, když se změní data
async function save(name, data, dry) {
  const file = path.join(DATA, name);
  const after = JSON.stringify(data, null, 1) + "\n";
  const before = await readFile(file, "utf8").catch(() => "");
  if (after === before) return console.log(`data/${name}: beze změny.`);
  if (dry) return console.log(`data/${name}: změna by se zapsala (--dry).`);
  await mkdir(DATA, { recursive: true });
  await writeFile(file, after);
  console.log(`data/${name}: aktualizováno.`);
}

async function main() {
  const dry = process.argv.includes("--dry");

  const matches = parseMatches(await get(URL_MATCHES));
  const table = parseTable(await get(URL_TABLE));
  // kontrola, že data dávají smysl — rozbitá stránka zdroje nesmí přepsat poslední dobrá data
  const { me, played, next } = buildState(matches, table);

  console.log(`${me.pos}. místo · ${me.played} záp. · ${me.w}-${me.d}-${me.l} · ${me.gf}:${me.ga} · ${me.pts} b.`);
  console.log(`Odehráno ${played.length}, příští: ${next ? `${next.home} — ${next.away} (${next.kickoff})` : "—"}`);
  if (played.length !== me.played) console.warn(`Pozor: tabulka uvádí ${me.played} zápasů, ve výsledcích jich je ${played.length}.`);
  await save("season.json", { competition: COMPETITION, table, matches }, dry);

  // články jsou doplněk — jejich výpadek nesmí zastavit aktualizaci výsledků
  try {
    const news = parseNews(await get(URL_NEWS));
    if (!news.length) throw new Error("na stránce jsem nenašel žádný článek");
    console.log(`Články: ${news.length}, nejnovější „${news[0].title}“ (${news[0].date})`);
    await save("news.json", news, dry);
  } catch (err) {
    console.warn(`Články se nepodařilo načíst (${err.message}) — nechávám poslední uložené.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
