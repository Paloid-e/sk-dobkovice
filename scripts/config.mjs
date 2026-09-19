// Nastavení soutěže — na začátku nové sezóny změnit COMPETITION a SEASON.
// UUID soutěže: https://is.fotbal.cz/public/souteze/prehled-soutezi.aspx (druh „3. třída“, okres Děčín)

// 9. liga Okresní soutěž dospělých, OFS Děčín, č. 2026421A2A
export const COMPETITION = "6a5e3799-cfd0-4737-97ee-cd84691019b4";
export const SEASON = "26/27";
export const US = "Dobkovice";

const BASE = "https://is.fotbal.cz/public/souteze";
export const URL_MATCHES = `${BASE}/detail-souteze.aspx?req=${COMPETITION}&sport=fotbal`;
export const URL_TABLE = `${BASE}/tabulky-souteze.aspx?req=${COMPETITION}&sport=fotbal`;
export const USER_AGENT = "sk-dobkovice-fansite/1.0 (+https://paloid-e.github.io/sk-dobkovice/)";

// Články klubu — web je jen odkazuje (titulek + datum), texty zůstávají na webu klubu
export const NEWS_BASE = "https://skdobkovice.estranky.cz";
export const URL_NEWS = `${NEWS_BASE}/clanky/clanky-klubu/`;
