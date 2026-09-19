// HTML bloky z ručně psaných / stažených dat:
//   data/news.json  → {{news-latest}} (úvod, 3 nejnovější), {{news-list}} (stránka Aktuality)
//   data/team.json  → {{team-season}}, {{team-staff}}, {{team-squad}}
//   data/shop.json  → {{shop-items}}, {{shop-contact}}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const czDate = (iso) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;

/* ---------- aktuality ---------- */

// Titulky na webu klubu jsou VERZÁLKAMI; rubriku poznáme podle tvaru titulku.
function newsKind(title) {
  if (/rozhovor/i.test(title)) return "Rozhovor";
  if (/\d+\s*:\s*\d+/.test(title)) return "Ohlas zápasu";
  if (/ : /.test(title)) return "Pozvánka";
  return "Klub";
}

const newsCard = (n) => `      <a class="news-card" href="${esc(n.url)}" target="_blank" rel="noopener">
        <span class="news-meta"><time datetime="${esc(n.date)}">${czDate(n.date)}</time> · ${newsKind(n.title)}</span>
        <span class="news-title">${esc(n.title)}</span>
        <span class="news-more">Číst na webu klubu →</span>
      </a>`;

export function renderNews(news = []) {
  const grid = (items) =>
    items.length
      ? `    <div class="news-grid reveal">\n${items.map(newsCard).join("\n")}\n    </div>`
      : `    <p class="empty-note reveal">Zatím tu nic není — první článek je na cestě.</p>`;
  return { "news-latest": grid(news.slice(0, 3)), "news-list": grid(news) };
}

/* ---------- tým ---------- */

const POSITIONS = { B: "Brankáři", O: "Obránci", Z: "Záložníci", U: "Útočníci" };
const POSITION_ONE = { B: "Brankář", O: "Obránce", Z: "Záložník", U: "Útočník" };
const STATS = [
  ["games", "Z", "Zápasy"], ["minutes", "Min", "Odehrané minuty"], ["goals", "G", "Góly"],
  ["assists", "A", "Asistence"], ["yellow", "ŽK", "Žluté karty"], ["red", "ČK", "Červené karty"],
];

export function renderTeam({ season = "", staff = [], players = [] }) {
  for (const p of players) {
    if (p.position != null && !POSITIONS[p.position]) throw new Error(`Hráč „${p.name}“ má neznámý post „${p.position}“`);
  }
  const staffHtml = `    <div class="staff reveal">
${staff.map((s) => `      <div class="staff-item"><span class="staff-role">${esc(s.role)}</span><span class="staff-name">${esc(s.name)}</span></div>`).join("\n")}
    </div>`;

  // skupiny podle postu; hráči bez postu (zatím většina) pod „Hráči v poli“
  const groups = [
    ...Object.entries(POSITIONS).map(([key, label]) => [label, players.filter((p) => p.position === key)]),
    ["Hráči v poli", players.filter((p) => p.position == null)],
  ].filter(([, list]) => list.length);

  const withStats = players.some((p) => p.stats);
  const squad = withStats
    ? `    <div class="table-scroll reveal">
      <table class="lg-table squad-table">
        <thead>
          <tr><th>Hráč</th><th>Post</th>${STATS.map(([, short, long]) => `<th class="n" title="${long}">${short}</th>`).join("")}</tr>
        </thead>
        <tbody>
${players.map((p) => `          <tr><td class="team">${esc(p.name)}</td><td>${p.position ? POSITION_ONE[p.position] : "–"}</td>${STATS.map(([key]) => `<td class="n">${p.stats?.[key] ?? "–"}</td>`).join("")}</tr>`).join("\n")}
        </tbody>
      </table>
    </div>`
    : groups.map(([label, list]) => `    <div class="squad-group reveal">
      <h3>${label} <span>${list.length}</span></h3>
      <ul class="squad">
${list.map((p) => `        <li>${esc(p.name)}</li>`).join("\n")}
      </ul>
    </div>`).join("\n\n");

  return { "team-season": esc(season), "team-staff": staffHtml, "team-squad": squad };
}

/* ---------- fanshop ---------- */

export function renderShop({ contact = "", items = [] }, root = "") {
  const cards = items.length
    ? `    <div class="shop-grid reveal">
${items.map((i) => `      <article class="shop-item${i.soldOut ? " sold-out" : ""}">
        ${i.photo ? `<img src="${root}${esc(i.photo)}" alt="${esc(i.name)}" loading="lazy">` : ""}
        <div class="shop-body">
          <h3>${esc(i.name)}</h3>${i.text ? `\n          <p>${esc(i.text)}</p>` : ""}
          <div class="shop-price">${i.price} Kč${i.soldOut ? ` <span class="shop-flag">Vyprodáno</span>` : ""}</div>
        </div>
      </article>`).join("\n")}
    </div>`
    : `    <p class="empty-note reveal">Nabídku právě připravujeme.</p>`;
  return { "shop-items": cards, "shop-contact": esc(contact) };
}
