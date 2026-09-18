# SK Dobkovice — fan site

Jednostránkový web (čistý HTML/CSS/JS, žádný build) pro fotbalový klub SK Dobkovice
(okresní soutěž / III. třída, okres Děčín). Vše je v `index.html`.

## Deploy

GitHub Pages z větve `main`, root. Live: https://paloid-e.github.io/sk-dobkovice/
Deploy = commit + push na `main`, Pages se přestaví samo do ~1 minuty.

## Design system

- Směr: „carbon & diagonála" — tmavý profesionální vzhled, červená diagonála ze znaku
  jako opakující se motiv (skewX(-30deg) akcenty, clip-path řezy sekcí, skewX(-12deg) chipy).
- Barvy (CSS tokeny v `:root`): carbon #0E0E12, červená #D6202A / #8F1118, smoke #F5F5F7,
  laurel zelená #1E8A4C — POUZE pro výhry a úspěch (V badge, forma), nikdy jako dekorace.
- Písma (Google Fonts): Anton (display/nadpisy), Archivo (text), IBM Plex Mono (skóre, tabulky, odpočet).
- Jazyk webu: čeština. Jediná barva akcentu je červená; zelená má sémantiku výhry.
- Animace: hero nástup (keyframes `rise`, `slash-in`), ticker (CSS marquee), počítadla statistik,
  scroll reveal (třída `.reveal` + IntersectionObserver). Vše respektuje prefers-reduced-motion
  a bez JS je stránka plně viditelná.

## Aktualizace obsahu (nejčastější úkoly)

- **Příští zápas / odpočet**: sekce `#zapasy` — změnit soupeře, datum v textu
  a atribut `data-kickoff` (ISO s časovou zónou, např. `2026-09-20T15:00:00+02:00`).
  Po výkopu ukazuje „Právě hrajeme!", po 2 h „Odehráno".
- **Výsledky**: sekce `#sezona` — přidat `.result` řádek (tag `w/d/l` = V/R/P),
  aktualizovat stat dlaždice, `.record` bar, `.form` piny a ticker nahoře.
- **Tabulka**: sekce `#tabulka` — ručně přepsat řádky; řádek Dobkovic má třídu `me`.

## Zdroje dat (ověřené)

- fotbalunas.cz — tým: https://fotbalunas.cz/tym/3267/ · tabulka: https://fotbalunas.cz/tabulky/soutez/294/
  (soutěž 294 = Ústecký / Děčín / III. třída). Pozor: skóre se uvádí z pohledu domácích.
- Děčínský deník: https://decinsky.denik.cz/fotbal-zapasy/sk-dobkovice-z-s/166284/
- Facebook klubu: https://www.facebook.com/people/SK-Dobkovice/61564145902029/

## Loga

- `logo.webp` — znak SK Dobkovice s průhledným pozadím (originál se smazaným bílým pozadím;
  nedotčená záloha `logo-original.webp` není v gitu).
- `logos/` — znaky soupeřů stažené z fotbalunas (breziny, jirikov-b, malsovice-b, vernerice,
  frantiskov + dobkovice.jpeg nepoužitý). Kluby bez loga na fotbalunas: Lokomotiva Děčín,
  Bynovec, Staré Křečany, Dolní Podluží, Huntířov, Starý Šachov — v tabulce mají chip
  s iniciálami (`span.noc`). Když se najde logo, dát ho do `logos/` a nahradit chip za `<img>`.

## Stav / TODO

- Tabulka a výsledky odpovídají stavu k 18. 9. 2026 (po 4. kole).
- Příští zápas: SK Březiny — SK Dobkovice, ne 20. 9. 2026 15:00, venku.
- Sdílená kopie existuje i jako Claude artifact (obrázky inline, build skript ve scratchpadu),
  ale primární je GitHub Pages.
- Nápady dál: fotogalerie z FB, soupiska hráčů, automatické stahování výsledků.
