// HTML bloky sponzorů z data/sponsors.json:
//   {{sponsors-strip}}  pás log na úvodní stránce
//   {{sponsors-list}}   karty po úrovních na stránce Sponzoři
//
// Sponzor: { "name", "tier" (jedna z "tiers"), "logo": "sponsors/soubor.png" (v public/),
//            "url", "text" } — povinné je jen name a tier.

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mark = (s, root) =>
  s.logo ? `<img src="${root}${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy">` : `<span class="sponsor-name">${esc(s.name)}</span>`;

const wrap = (s, inner, cls) =>
  s.url
    ? `<a class="${cls}" href="${esc(s.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;

export function renderSponsors({ tiers = [], sponsors = [] }, root = "") {
  // pořadí podle úrovní; sponzor s neznámou úrovní je chyba v datech
  for (const s of sponsors) {
    if (!s.name || !tiers.includes(s.tier)) throw new Error(`Sponzor „${s.name ?? "?"}“ má neznámou úroveň „${s.tier}“`);
  }
  const byTier = tiers.map((tier) => [tier, sponsors.filter((s) => s.tier === tier)]).filter(([, list]) => list.length);

  if (!sponsors.length) {
    const empty = (indent) => `${indent}<p class="sponsors-empty reveal">Partnery pro sezónu právě hledáme — první místo je volné.</p>`;
    return { "sponsors-strip": empty("    "), "sponsors-list": empty("    ") };
  }

  const strip = `    <div class="sponsor-strip reveal">
${byTier.flatMap(([, list]) => list).map((s) => `      ${wrap(s, mark(s, root), "sponsor-tile")}`).join("\n")}
    </div>`;

  const list = byTier.map(([tier, items]) => `    <div class="sponsor-tier reveal">
      <h3>${esc(tier)}</h3>
      <div class="sponsor-cards">
${items.map((s) => `        <article class="sponsor-card">
          ${wrap(s, mark(s, root), "sponsor-tile")}
          <div>
            <h4>${esc(s.name)}</h4>${s.text ? `\n            <p>${esc(s.text)}</p>` : ""}${s.url ? `\n            <a class="sponsor-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : ""}
          </div>
        </article>`).join("\n")}
      </div>
    </div>`).join("\n\n");

  return { "sponsors-strip": strip, "sponsors-list": list };
}
