// Stav sezóny a HTML bloky pro úvodní stránku. Data bere z data/season.json
// (zapisuje scripts/update.mjs), bloky vkládá scripts/build.mjs do src/pages/index.html
// na místa {{hero-tag}}, {{ticker}}, {{next-match}}, {{season-stats}}, {{table-body}} …

import { SEASON, US, URL_TABLE } from "./config.mjs";

// Oficiální názvy jsou dlouhé („TJ Jiskra Staré Křečany, z.s./TJ Krásná Lípa, z.s. "B"“),
// tým se pozná podle klíče `match`. table = název v tabulce, short = ve výsledcích,
// ticker = v běžícím pásu, logo = soubor v repu, noc = iniciály, když logo není.
export const TEAMS = [
  { match: "Dobkovice", table: "SK Dobkovice", short: "Dobkovice", logo: "logo.png" },
  { match: "Lokomotiva Děčín", table: "TJ Lokomotiva Děčín", short: "Lokomotiva Děčín", ticker: "Loko Děčín", logo: "logos/lokomotiva-decin.jpg" },
  { match: "Bynovec", table: "Bynovec", short: "Bynovec", logo: "logos/bynovec.jpg" },
  { match: "Staré Křečany", table: "Staré Křečany", short: "Staré Křečany", ticker: "St. Křečany", logo: "logos/stare-krecany.jpg" },
  { match: "Jiříkov", table: "TJ Spartak Jiříkov B", short: "Jiříkov B", logo: "logos/jirikov.jpg" },
  { match: "Dolní Podluží", table: "FK Dolní Podluží", short: "Dolní Podluží", ticker: "D. Podluží", logo: "logos/dolni-podluzi.jpg" },
  { match: "Březiny", table: "SK Březiny", short: "Březiny", logo: "logos/breziny.jpg" },
  { match: "Malšovice", table: "FK Malšovice B", short: "Malšovice B", logo: "logos/malsovice.jpg" },
  { match: "Huntířov", table: "Huntířov", short: "Huntířov", logo: "logos/huntirov.jpg" },
  { match: "Verneřice", table: "Verneřice", short: "Verneřice", logo: "logos/vernerice.jpg" },
  { match: "Františkov", table: "Františkov", short: "Františkov", logo: "logos/frantiskov.jpg" },
  { match: "Starý Šachov", table: "Starý Šachov", short: "Starý Šachov", ticker: "St. Šachov", logo: "logos/stary-sachov.jpg" },
];

/* ---------- pomocné ---------- */

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 1 výhra · 2–4 výhry · 0, 5+ výher
export const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

// „ze 4 zápasů“, ale „z 5 zápasů“ (ze tří, ze čtyř, ze šesti, ze sedmi, ze třinácti…)
const ZE = new Set([3, 4, 6, 7, 13, 14, 16, 17]);
const zPrep = (n) => (ZE.has(n) ? "ze" : "z");

const ORDINALS = ["", "první", "druzí", "třetí", "čtvrtí", "pátí", "šestí", "sedmí", "osmí", "devátí", "desátí", "jedenáctí", "dvanáctí"];
const DAYS = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

export function team(official) {
  const known = TEAMS.find((t) => official.includes(t.match));
  if (known) return { ticker: known.short, ...known };
  // neznámý tým (nová sezóna): očistit právní formu, iniciály jako chip
  const name = official
    .replace(/\/.*$/, "")
    .replace(/,?\s*(z\.\s*s\.|spolek|-\s*spolek)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const noc = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).slice(-2).map((w) => w[0]).join("");
  return { match: official, table: name, short: name, ticker: name, noc: noc || "?" };
}

/* ---------- výpočet stavu ---------- */

export function buildState(matches, table, now = new Date()) {
  const me = table.find((r) => r.name.includes(US));
  if (table.length < 4 || !me) throw new Error(`Tabulka nevypadá dobře (${table.length} řádků, ${US} ${me ? "ano" : "ne"})`);
  if (!matches.length) throw new Error("Nenašel jsem žádné zápasy");

  const ours = matches.filter((m) => m.home.includes(US) || m.away.includes(US));
  const played = ours
    .filter((m) => m.score)
    .map((m) => {
      const atHome = m.home.includes(US);
      const [gf, ga] = atHome ? m.score : [m.score[1], m.score[0]];
      return { ...m, atHome, gf, ga, outcome: gf > ga ? "w" : gf < ga ? "l" : "d", rival: team(atHome ? m.away : m.home) };
    })
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  // příští = nejbližší neodehraný; 3 h po výkopu ho ještě držíme („Právě hrajeme!“)
  const cutoff = now.getTime() - 3 * 3600 * 1000;
  const next = ours
    .filter((m) => !m.score && new Date(m.kickoff).getTime() > cutoff)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0] ?? null;

  const leaguePlayed = matches.filter((m) => m.score);
  const round = leaguePlayed.reduce((max, m) => Math.max(max, m.round), 0);
  const lastDay = leaguePlayed.map((m) => m.kickoff.slice(0, 10)).sort().at(-1) ?? null;

  return { me, table, played, next, round, lastDay };
}

/* ---------- HTML bloky ---------- */

const czDate = (iso) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;
const shortDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
const OUTCOME = { w: ["V", "Výhra"], d: ["R", "Remíza"], l: ["P", "Prohra"] };

const fixture = (m, key) => {
  const rival = m.rival[key];
  return m.atHome ? [US, rival] : [rival, US];
};

export function render(s, root = "") {
  const { me, played, next, round } = s;
  const unbeaten = me.played > 0 && me.l === 0;
  const blocks = {};

  /* hero */
  blocks["hero-tag"] = me.played === 0
    ? `      <p class="hero-tag rise-3">
        Nová sezóna je tady. Klub z labského údolí jde za <strong>okresním přeborem</strong>.
      </p>`
    : `      <p class="hero-tag rise-3">
        Po ${round}. kole <strong>${me.pos === 1 ? "vedeme tabulku" : `jsme na ${me.pos}. místě`}</strong>${unbeaten ? " — bez porážky" : ""},
        skóre <strong>${me.gf}:${me.ga}</strong>. ${me.pos === 1 ? "Klub z labského údolí se dívá na tabulku shora." : "Klub z labského údolí jde za okresním přeborem."}
      </p>`;

  /* ticker — obsah dvakrát za sebou kvůli plynulé smyčce */
  const items = [
    `${me.pos}. místo po ${round}. kole`,
    ...played.slice(-4).reverse().map((m) => {
      const [h, a] = fixture(m, "ticker");
      return `${esc(h)} <b>${m.score[0]}:${m.score[1]}</b> ${esc(a)}`;
    }),
    `Skóre ${me.gf}:${me.ga} · ${unbeaten ? "bez porážky" : `${me.pts} ${plural(me.pts, "bod", "body", "bodů")}`}`,
  ];
  const set = `    <div class="ticker-set">\n${items.map((i) => `      <span>${i}</span><span class="sep"></span>`).join("\n")}\n    </div>`;
  blocks["ticker"] = `${set}\n${set}`;

  /* příští zápas */
  if (next) {
    const crest = (t) => (t.logo ? `<img class="crest" src="${root}${esc(t.logo)}" alt="">\n        ` : "");
    const home = team(next.home), away = team(next.away);
    const [y, mo, d] = next.kickoff.slice(0, 10).split("-").map(Number);
    const day = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
    blocks["next-match"] = `    <div>
      <p class="eyebrow">Příští zápas · ${next.round}. kolo</p>
      <div class="match-teams">
        ${crest(home)}${esc(home.table)}
        <span class="vs">vs</span>
        ${crest(away)}${esc(away.table)}
      </div>
      <p class="match-meta">${day} <b>${czDate(next.kickoff)}</b> · výkop <b>${next.kickoff.slice(11, 16)}</b>${next.pitch ? ` · hřiště ${esc(next.pitch)}` : ""}</p>
    </div>

    <div class="countdown" id="countdown" data-kickoff="${next.kickoff}" role="timer" aria-label="Odpočet do výkopu">
      <div class="cd-cell"><div class="cd-num" id="cd-d">–</div><div class="cd-lbl">dny</div></div>
      <div class="cd-cell"><div class="cd-num" id="cd-h">–</div><div class="cd-lbl">hod</div></div>
      <div class="cd-cell"><div class="cd-num" id="cd-m">–</div><div class="cd-lbl">min</div></div>
      <div class="cd-cell"><div class="cd-num" id="cd-s">–</div><div class="cd-lbl">sek</div></div>
    </div>`;
  } else {
    blocks["next-match"] = `    <div>
      <p class="eyebrow">Příští zápas</p>
      <div class="match-teams">Rozpis připravujeme</div>
      <p class="match-meta">Termíny dalších zápasů doplníme, jakmile je svaz vypíše.</p>
    </div>`;
  }

  /* sezóna */
  blocks["season-eyebrow"] = `    <p class="eyebrow reveal">Sezóna 20${SEASON} · po ${round}. kole</p>`;

  const pct = (n) => (me.played ? Math.round((n / me.played) * 1000) / 10 : 0);
  const bar = [["w", me.w], ["d", me.d], ["l", me.l]]
    .filter(([, n]) => n > 0)
    .map(([cls, n]) => `        <div class="${cls}" style="width: ${pct(n)}%"></div>`)
    .join("\n");
  const form = played.slice(-5).map((m) => {
    const [letter, word] = OUTCOME[m.outcome];
    return `      <i class="${m.outcome}" title="${word} ${m.gf}:${m.ga} · ${esc(m.rival.short)} (${m.atHome ? "doma" : "venku"})">${letter}</i>`;
  }).join("\n");
  const results = played.slice(-6).reverse().map((m) => {
    const [h, a] = fixture(m, "short");
    return `      <div class="result">
        <span class="tag ${m.outcome}">${OUTCOME[m.outcome][0]}</span>
        <span class="date">${shortDate(m.kickoff)}</span>
        <span class="fixture">${esc(h)} — ${esc(a)}</span>
        <span class="venue">${m.atHome ? "doma" : "venku"}</span>
        <span class="score">${m.score[0]} : ${m.score[1]}</span>
      </div>`;
  }).join("\n");

  blocks["season-stats"] = `    <div class="stats reveal">
      <div class="stat gold">
        <div class="num"><span data-count="${me.pos}">${me.pos}</span><em>. místo</em></div>
        <div class="lbl">Okresní soutěž</div>
      </div>
      <div class="stat">
        <div class="num"><span data-count="${me.pts}">${me.pts}</span></div>
        <div class="lbl">${plural(me.pts, "Bod", "Body", "Bodů")} ${zPrep(me.played)} ${me.played} ${plural(me.played, "zápasu", "zápasů", "zápasů")}</div>
      </div>
      <div class="stat">
        <div class="num"><span data-count="${me.gf}">${me.gf}</span><em>:${me.ga}</em></div>
        <div class="lbl">Skóre</div>
      </div>
      <div class="stat">
        <div class="num"><span data-count="${me.l}">${me.l}</span></div>
        <div class="lbl">${plural(me.l, "Porážka", "Porážky", "Porážek")}</div>
      </div>
    </div>

    <div class="reveal">
      <div class="record" aria-hidden="true">
${bar}
      </div>
      <div class="record-legend">
        <span class="lw"><i></i>${me.w} ${plural(me.w, "výhra", "výhry", "výher")}</span>
        <span class="ld"><i></i>${me.d} ${plural(me.d, "remíza", "remízy", "remíz")}</span>
        <span class="ll"><i></i>${me.l} ${plural(me.l, "prohra", "prohry", "proher")}</span>
      </div>
    </div>

    <div class="form reveal">
      <span class="flbl">Forma</span>
${form}
    </div>

    <div class="results reveal">
${results}
    </div>`;

  /* tabulka */
  blocks["table-title"] = `    <h2 class="reveal">Tabulka po ${round}. kole</h2>`;
  blocks["table-body"] = s.table.map((r) => {
    const t = team(r.name);
    const badge = t.logo ? `<img src="${root}${esc(t.logo)}" alt="">` : `<span class="noc">${esc(t.noc)}</span>`;
    return `          <tr${r === me ? ' class="me"' : ""}>
            <td class="pos">${r.pos}</td>
            <td class="team"><span class="team-cell">${badge}${esc(t.table)}</span></td>
            <td class="n">${r.played}</td><td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td>
            <td class="n">${r.gf}:${r.ga}</td><td class="n pts">${r.pts}</td>
          </tr>`;
  }).join("\n");
  blocks["table-note"] = `    <p class="table-note reveal">
      Zdroj: <a href="${esc(URL_TABLE)}" target="_blank" rel="noopener">fotbal.cz · IS FAČR</a>${s.lastDay ? ` · stav po zápasech ${czDate(s.lastDay)}` : ""}
    </p>`;

  /* ambice */
  blocks["ladder-now"] = `      <div class="rung now"><span class="lvl">Okres</span><span>Okresní soutěž · ${me.pos}. místo ${SEASON}</span></div>`;
  blocks["season-note-pos"] = me.played ? ` — letos zatím ${ORDINALS[me.pos] ?? `${me.pos}.`}` : "";

  return blocks;
}

// bloky uvnitř věty — bez zalomení řádku kolem obsahu
