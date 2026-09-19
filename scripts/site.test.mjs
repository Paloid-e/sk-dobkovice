// node --test scripts/site.test.mjs
// Fixtures = stránky IS FAČR uložené 19. 9. 2026 (po 4. kole, před zápasem v Březinách).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync, readFileSync as read, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseMatches, parseTable, parseNews, pragueOffset } from "./update.mjs";
import { buildState, render, team, plural } from "./season.mjs";
import { renderSponsors } from "./sponsors.mjs";
import { renderNews, renderTeam, renderShop } from "./content.mjs";
import { build, fill, parsePage } from "./build.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const matches = parseMatches(fixture("zapasy.html"));
const table = parseTable(fixture("tabulka.html"));
const BEFORE_R5 = new Date("2026-09-19T10:00:00+02:00");

test("zápasy: celý rozpis včetně kola, času a skóre", () => {
  assert.equal(matches.length % 6, 0); // 12 týmů = 6 zápasů na kolo
  assert.deepEqual(matches.find((m) => m.round === 1 && m.away.includes("Dobkovice")), {
    round: 1,
    kickoff: "2026-08-23T15:00:00+02:00",
    home: "Sportovní klub Starý Šachov, z.s.",
    away: "SK Dobkovice z.s.",
    score: [2, 6],
    pitch: "Starý Šachov",
  });
  const r5 = matches.find((m) => m.round === 5 && m.away.includes("Dobkovice"));
  assert.equal(r5.score, null);
  assert.equal(r5.home, "SK Březiny z.s.");
});

test("tabulka: jen celková, 12 týmů", () => {
  assert.equal(table.length, 12);
  assert.deepEqual(table[0], { pos: 1, name: "SK Dobkovice z.s.", played: 4, w: 3, d: 1, l: 0, gf: 16, ga: 5, pts: 10 });
  assert.deepEqual(table.map((r) => r.pos), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("stav: bilance, příští zápas, poslední kolo", () => {
  const s = buildState(matches, table, BEFORE_R5);
  assert.deepEqual(s.played.map((m) => m.outcome), ["w", "w", "d", "w"]);
  assert.deepEqual(s.played.map((m) => `${m.gf}:${m.ga}`), ["6:2", "5:2", "0:0", "5:1"]);
  assert.equal(s.next.kickoff, "2026-09-20T15:00:00+02:00");
  assert.equal(s.round, 4);
  assert.equal(s.lastDay, "2026-09-13");
});

test("stav: 3 h po výkopu bez výsledku se příští zápas posune dál", () => {
  const s = buildState(matches, table, new Date("2026-09-20T18:30:00+02:00"));
  assert.equal(s.next.round, 6);
});

test("stav: rozbitá stránka vyhodí chybu místo přepsání webu", () => {
  assert.throws(() => buildState(matches, [], BEFORE_R5));
  assert.throws(() => buildState([], table, BEFORE_R5));
});

test("render: bloky úvodní stránky", () => {
  const blocks = render(buildState(matches, table, BEFORE_R5), "../");
  assert.ok(blocks["table-body"].includes('<tr class="me">'));
  assert.ok(blocks["table-body"].includes('src="../logos/breziny.jpg"'));
  assert.ok(blocks["next-match"].includes('data-kickoff="2026-09-20T15:00:00+02:00"'));
  assert.ok(blocks["season-stats"].includes("Bodů ze 4 zápasů"));
  assert.ok(blocks["ticker"].includes("<span>St. Šachov <b>2:6</b> Dobkovice</span>"));
});

test("fill + parsePage: neznámý blok je chyba, ne tichá díra ve stránce", () => {
  assert.equal(fill(["a", "  {{x}}", "b {{y}}"].join("\n"), { x: "    X", y: "Y" }), ["a", "    X", "b Y"].join("\n"));
  assert.throws(() => fill("{{nope}}", {}));
  const page = ["<!--", "title: T: s dvojtečkou", "description: D", "-->", "", "<p>x</p>", ""].join("\n");
  assert.deepEqual(parsePage(page), { meta: { title: "T: s dvojtečkou", description: "D" }, body: "<p>x</p>" });
  assert.throws(() => parsePage("<p>bez hlavičky</p>"));
});

test("sponzoři: prázdný stav, karty a kontrola úrovně", () => {
  const tiers = ["Hlavní partneři", "Partneři"];
  assert.ok(renderSponsors({ tiers, sponsors: [] })["sponsors-strip"].includes("sponsors-empty"));
  const out = renderSponsors({ tiers, sponsors: [
    { name: "Malý & syn", tier: "Partneři" },
    { name: "Velký", tier: "Hlavní partneři", logo: "sponsors/velky.png", url: "https://www.velky.cz/", text: "Popis" },
  ] }, "../");
  assert.ok(out["sponsors-list"].indexOf("Hlavní partneři") < out["sponsors-list"].indexOf("Partneři</h3>"));
  assert.ok(out["sponsors-strip"].includes('src="../sponsors/velky.png"'));
  assert.ok(out["sponsors-list"].includes("Malý &amp; syn"));
  assert.ok(out["sponsors-list"].includes(">velky.cz</a>"));
  assert.throws(() => renderSponsors({ tiers, sponsors: [{ name: "X", tier: "Neexistuje" }] }));
});

test("články: titulek, datum a absolutní odkaz z webu klubu", () => {
  const news = parseNews(fixture("clanky.html"));
  assert.equal(news.length, 10);
  assert.deepEqual(news[1], {
    title: "ROZHOVOR - LUKÁŠ BRANDEJS",
    date: "2026-09-17",
    url: "https://skdobkovice.estranky.cz/clanky/clanky-klubu/rozhovor---lukas-brandejs.html",
  });
  assert.deepEqual(parseNews("<p>rozbitá stránka</p>"), []);

  const blocks = renderNews(news);
  assert.equal(blocks["news-latest"].split('class="news-card"').length - 1, 3);
  assert.equal(blocks["news-list"].split('class="news-card"').length - 1, 10);
  assert.ok(blocks["news-list"].includes("17. 9. 2026</time> · Rozhovor"));
  assert.ok(blocks["news-list"].includes("· Ohlas zápasu"));
  assert.ok(blocks["news-list"].includes("· Pozvánka"));
  assert.ok(renderNews([])["news-list"].includes("empty-note"));
});

test("tým: soupiska po skupinách, se statistikami tabulka", () => {
  const staff = [{ role: "Hlavní trenér", name: "Radek Štol" }];
  const players = [{ name: "Jan Kyral", position: "B" }, { name: "Michal Štol", position: null }];
  const roster = renderTeam({ season: "2026/2027", staff, players });
  assert.equal(roster["team-season"], "2026/2027");
  assert.ok(roster["team-staff"].includes("Radek Štol"));
  assert.ok(roster["team-squad"].includes("Brankáři <span>1</span>"));
  assert.ok(roster["team-squad"].includes("Hráči v poli <span>1</span>"));
  assert.ok(!roster["team-squad"].includes("<table"));

  players[1].stats = { games: 4, minutes: 360, goals: 3 };
  const stats = renderTeam({ staff, players })["team-squad"];
  assert.ok(stats.includes("<table"));
  assert.ok(stats.includes('<td class="n">360</td>'));
  assert.ok(stats.includes("<td>Brankář</td>"));
  assert.throws(() => renderTeam({ players: [{ name: "X", position: "Q" }] }));
});

test("fanshop: cena, vyprodáno, prázdný stav", () => {
  const out = renderShop({ contact: "a@b.cz", items: [
    { name: "Šála", price: 250, photo: "shop/sala.jpg" },
    { name: "Kšiltovka", price: 300, soldOut: true },
  ] }, "../");
  assert.ok(out["shop-items"].includes('src="../shop/sala.jpg"'));
  assert.ok(out["shop-items"].includes("250 Kč"));
  assert.ok(out["shop-items"].includes("Vyprodáno"));
  assert.equal(out["shop-contact"], "a@b.cz");
  assert.ok(renderShop({ items: [] })["shop-items"].includes("empty-note"));
});

test("build: celý web se složí a nezůstane žádný {{blok}}", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "skd-"));
  const { pages } = await build(out, BEFORE_R5);
  assert.ok(pages >= 7);
  for (const file of ["index.html", ...["aktuality", "tym", "historie", "klub", "sponzori", "fanshop"].map((p) => `${p}/index.html`)]) {
    const html = read(path.join(out, file), "utf8");
    assert.ok(!html.includes("{{"), file);
    assert.ok(html.includes("paloid.info"), file);
  }
  assert.ok(read(path.join(out, "sponzori/index.html"), "utf8").includes('href="../#zapasy"'));
  assert.ok(read(path.join(out, "index.html"), "utf8").includes('href="#zapasy"'));
  for (const file of ["logo.png", "assets/styles.css", "assets/site.js", "logos/breziny.jpg"]) assert.ok(existsSync(path.join(out, file)), file);
});

test("pomocné funkce", () => {
  assert.equal(pragueOffset(2026, 10, 24, 15), "+02:00"); // sobota před změnou času
  assert.equal(pragueOffset(2026, 10, 25, 15), "+01:00"); // poslední říjnová neděle
  assert.equal(pragueOffset(2027, 3, 28, 15), "+02:00"); // poslední březnová neděle
  assert.equal(pragueOffset(2027, 3, 27, 15), "+01:00");
  assert.equal(team('TJ Spartak Jiříkov, z.s. "B"/FK Chřibská - spolek').table, "TJ Spartak Jiříkov B");
  assert.deepEqual([team("FK Nová Ves, z.s.").table, team("FK Nová Ves, z.s.").noc], ["FK Nová Ves", "NV"]);
  assert.deepEqual([0, 1, 3, 5].map((n) => plural(n, "výhra", "výhry", "výher")), ["výher", "výhra", "výhry", "výher"]);
});
