# Round 36 — poročilo (zamrznitev med letom, policaji, spawn)

**Naročilo:** med letom z letalom se je igra ustavila in pokazala zamrznjeno sliko, nato si umrl, ne da bi videl igro · datoteke `.md` ni nikjer · odstrani policaje iz okolice S.H.I.E.L.D. baze · poskrbi, da se ne spawnaš v S.H.I.E.L.D. bazi ali kaki drugi zgradbi.

---

## 1) Zamrznitev med letom — najden pravi vzrok

Zamrznjena slika + smrt brez prikazane igre ni bila počasen računalnik in ne simulacija. Simulacija teče **2,8 ms/frame**, risanje **1,4 ms/frame**. Vzrok je bil **izjema med risanjem enega samega okvirja**:

1. V `updatePickups` / `dropPickup` je lahko nastal paketek vrste `weapon` z vsebino `"ammo"` (seznam padlih vojakov v `onEnemyKilled` je vseboval `'ammo'` v seznamu orožij).
2. `drawPickups` je nato bral `WEAPONS['ammo'].color` → `undefined.color` → **TypeError**.
3. Ker je `requestAnimationFrame` na vrhu zanke že naročen, se je zanka nadaljevala, risanje pa je vsak okvir vrglo izjemo → **slika je obstala, simulacija pod njo pa je tekla dalje**. Zato si umrl »brez da bi videl igro«.

**Popravki:**

- `onEnemyKilled`: `'ammo'` je zdaj pravi paketek (`kind: 'ammo'`), v seznamu orožij ga ni več.
- `drawPickups`: barva se bere varno (`WEAPONS[...]?.color || '#8ce8ff'`), neznan ključ ne more več vreči izjeme.
- `updatePickups`: vsak neveljaven paketek (neznano orožje, NaN koordinata) se tiho odstrani, preden pride do risanja.
- **Glavna zanka je zdaj zaščitena:** `update`, `render` in `pushHud` tečejo v `try/catch` (`survive()`); napaka se izpiše v konzolo **enkrat na sporočilo**, igra pa teče naprej. Preverjeno s testom, ki tri okvire zapored vrže izjemo v risanju: igra preživi in nadaljuje.
- `enterNextSector`: če se svet sektorja ne zgradi, run ne obtiči v tranziciji.

Preizkus: 24 naključnih iger × 4 000 okvirjev (6 sektorjev, hoja/letenje/bombardiranje/teleporti/reset) → **0 napak**; 30 000 okvirjev z aktivnim streljanjem → **0 neveljavnih paketkov**, 0 izjem.

## 2) Policaji odstranjeni iz okolice S.H.I.E.L.D. baze

- Peš poti policije (»custody beats«) se **ne ustvarjajo več** okoli tajnih točk in okoli S.H.I.E.L.D. kovčka: vsaka pot, ki bi se približala **1 500 px** od vhoda v bazo, se izpusti (prej sta bili tam dve patrulji, 4 policaji).
- Tudi če bi val sovražnikov policaja dostavil v to območje, se ta **spremeni v navadnega vojaka** (`grunt`) — aretacija na pragu lastne baze ni več mogoča.
- V samem kompleksu (do **760 px** od vhoda) **aretacija ni mogoča**, tudi če policaj od drugod zaide tja.
- Preverjeno: v vseh sektorjih je zdaj **0 policajev v 1 600 px** od baze (prej 4).

## 3) Spawn nikoli več v zgradbi ali v S.H.I.E.L.D. bazi

Nov `pickSpawnPoint()` zamenjuje staro `settle()` logiko za začetek sektorja. Kandidat je veljaven samo če:

- ni v nobenem trdnem objektu (30 px odmika) in ni v vodi,
- **ni v nobeni stavbi/objektu kompleksa** (`facilities`, 46 px odmika) — to je bil glavni krivec,
- ni znotraj **1 000 px** od S.H.I.E.L.D. baze (kovčka),
- ima **vsaj 4 od 8 smeri** prostih na 160 px in **vsaj 3 od 8** na 520 px (da se ne rodiš v kotu med dvema skladiščema).

Izbira med kandidati kaznuje bližino sovražnikov (do 780 px), preferira cesto/ploščad in bližino avtorizirane vstopne točke. Preizkus: **36 generiranih svetov** (6 × 6 sektorjev) → **0 neveljavnih spawnov**; igralec tudi po 6 s mirovanja ne zdrsne v zid.

## 4) Kje so poročila

Poročila so zdaj **v repozitoriju**, ne več samo v delovnem imeniku:

- `docs/ROUND-35.md` — prejšnji krog (vozila, zračni odziv, letalo, ledena baza),
- `docs/ROUND-36.md` — ta krog (zamrznitev, policaji, spawn).

## Tehnično

- `src/game/engine.ts`: `survive()`, `crashLog`, `crashCount`; `try/catch` v `loop()` za `update`/`render`/`pushHud`; `try/catch` v `enterNextSector()`; varen `drawPickups`; čiščenje paketkov v `updatePickups`; popravljen seznam orožij v `onEnemyKilled`; `pickSpawnPoint()`; filter policijskih poti (`beatIsClean`, `shieldGuard`); prepoved aretacije v kompleksu; `custodian` → `grunt` pri spustu v kompleks.
- Preverjeno: `npx tsc --noEmit` čist, `npm run build` **1 589,21 kB / gzip 463,63 kB**, regresijski testi (vožnja rekvizirancev, prestreznik + zračni odziv, ledena baza, zajem topa, 6 000-okvirni soak) → vse brez napak.
