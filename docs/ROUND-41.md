# Round 41 — poročilo (ledena dvorana, zgrajena po referenci)

**Naročilo:** *»OKEJ, NEKAJ RAZČISTIVA. TA GRAFIKA TVOJA NI PODOBNA MOJI NA SLIKI.«* — s priloženo posnetkom igre in ciljno konceptno sliko (ledena jama, obešene svetilke, mokra odsevna tla, vojaški transportni helikopterji, vojaki v snežni maskirni obleki, goreče ustje jame z dnevno svetlobo, jeklene galerije s transparenti, zaboji z svetlobnimi trakovi).

Verzija: **v1.41.0 · ROUND 41 · 2026-10-25**, kodno ime **GLACIER VAULT LIT** (izpisana na začetnem zaslonu).

---

## 0) Kaj je bilo narobe

Prejšnja dvorana je bila **enotna bleda modra megla**: ravnina tal z eno barvo, stene iz treh velikih ploskev, figure iz kapsul (torzo + glava = "blob"), helikopterji brez jasne silhuete. Vse je bilo premalo kontrastno in premalo "prostorsko", da bi bralo kot jama — zato je slika delovala kot risba, ne kot prostor.

Ta round tega ni popravljal s številkami barv, ampak je **zamenjal zgradbo prizorišča**: druga geometrija jame, druga osvetlitev, druga figura, druga tla in drugačno ustje jame. Igralski del (faze, sovražniki, helikopterji, Frostwing, HUD) je ostal nespremenjen.

---

## 1) Jama: obok, stene, tla

- **Obok** je zdaj pokončno prerezan valj (`CylinderGeometry`, 46 × 32 segmentov), ki je **obrnjen navznoter** (indeksna winding zavrtena) — prej so bile ploskve obrnjene navzven, zato se je streha "snežila" in brala kot zunanja polica. Nato je deformiran z dvema oktavama šuma (`rockify`) in pobarvan po višini: **sneg na policah, globoka modra v razpokah, temneje proti temenu**, kjer svetloba ne pride.
- **Stene** so razdeljene na zahodno in vzhodno ploskev z 72 × 18 segmenti, deformirane in pobarvane po istem pravilu.
- **Tla** so mokra ledena plošča: temno-modra podlaga s svetlimi razpokami, **ploščami** (4 × 4 mreža) in lužami staljene vode. Ker v prizorišču ni okoljske mape, je bil prejšnji `metalness: 0.72` **napaka** — kovina brez odseva je črna. Zdaj: `metalness 0.18`, `roughness 0.38` z **roughness mapo** (luže = gladke), zato se odsevi svetilk na tleh dejansko vidijo.
- **Svetlobni bazeni**: pod vsako svetilko je aditivna elipsa na tleh + navpični "smeared" odsev — to je tisto, kar tla naredi mokra.
- **Markacije**: osrednja svetla črta, prekinjene črte ob progah in svetle kocke ob tirnici so zdaj **barva** (`markMat`), ne emisivne plošče — prej so v posnetku izgledale kot beli listi papirja na tleh.

## 2) Ustje jame

Prej: svetla ploskev na končni steni + dve ravni "rameni" — bralo se je kot **osvetljena vrata**, ne kot jama.

Zdaj je ustje **predor**: dnevna svetloba je potisnjena 30 m za konec dvorane, med dvorano in svetlobo pa so štiri deformirane ledene stene predora (levo, desno, strop, klančina) v temnejšem tonu, okoli odprtine pa **22 razbitih ledenih balvanov** nepravilnega obrisa. Rezultat: dnevna svetloba ne stoji na ravni steni, ampak sije **skozi odprtino v skali**, obris pa nikjer ne konča na ravni črti.

## 3) Figure: iz kapsul v vojake

Torzo in uda so bili kapsule — na deset korakov to bralo kot kepa. Figura je zdaj sestavljena iz **blokov**:

- stegno, golen, **ščitnik kolena**, škorenj z ločenim podplatom (ločena stoja, da ne stoji kot en steber),
- boki, torzo, **trdi naramnici** (ploščati nosilci),
- **snežno maskirni tekstil** (`snowCamoTexture`: bela podlaga, sivo-modri madeži, srež) na jopiču, hlačah in čeladi,
- čelada z **obrobom**, očala/visor pri sovražnikih,
- nahrbtnik, spalna vreča na vrhu, **antena**, puška z cevjo in nabojnikom,
- pri Shieldovih vojakih **manjši, prosojen ščit z osvetljenim robom** (prej velika bela plošča, ki je zakrivala celo figuro).

Na vhodu v dvorano so zdaj **4 statične straže** (dekor, ne sovražniki) in **6 skladov zabojev** z označenimi svetlobnimi trakovi in snegom na pokrovu — to je "kramarija", ki je v referenci polovica slike in je dvorani dala merilo.

## 4) Helikopterji

- Trup je potemnejši (`0x71858f`), da se **silhueta** bere proti svetlemu ustju.
- Dodan je **disk zamegljenega rotorja** (prosojna ploskev, ki se vrti z listi) — brez njega mirujoč štirikraki rotor v posnetku izgleda kot križ.
- Dodana sta **bradna puška** in usta cevi pod nosom.

## 5) Osvetlitev

- Ambient `0x3d7196` **1.15**, hemisfera `0x9fd6f2 / 0x12222c` **1.05**, dnevna smerna `0xd8f1ff` **2.1**, vhodna `0xa8d8ee` **0.8**.
- Dva nova reflektorja nad vhodom (en pravi `PointLight` 330/90 + bazeni na tleh), da vhod ni črn.
- **Proračun luči je ostal v mejah**: 8 točkovnih luči (12 skupaj) — harneš to preverja in v tem roundu ne opozarja.

## 6) Meritve (harneš, 1 680 posnetih sličic = 27 s igre)

```
ok   1680 frames without an exception
     scene: 1819 meshes (3 instanced), 12 lights, 37 sprites, 1 point cloud, 0 NaN
ok   forward-render light budget (8 point lights, 12 total)
ok   floor is at y=0
ok   the vault arches over the hall (apex y=34.0)
ok   the hall is walled on both sides (-64 … 65)
ok   the mouth of the cave is at the far end (z=-330)
ok   lamp bloom and light pools present (37 sprites)
ok   the Frostwing launch hands back to the surface (plane=true, kills=22)
ok   HUD is rendering (GLACIER VAULT / SECTOR 3 … ICE GUARDS 0 … SHIELD PLATOON 20/20 … DOWNED 22)
```

Igralski tok je nespremenjen: prehod **vrata → dvorana → hangar → frost**, 20 shieldovcev, **2 gunshipa** iz jaškov, ledene straže, izstrelitev Frostwinga, HUD in `onExit` statistika — vse preverjeno v istem harnešu.

## 7) Kako je bilo preverjeno brez brskalnika

V tem okolju ni Chromiuma, zato si za ta round nisem mogel posneti zaslona igre. Namesto tega sem napisal **programski rasterizator** (`snap.ts`), ki vzame pravo prizorišče iz komponente (prava geometrija, pravi materiali, prava svetlobna postava, megla, ACES + gama) in ga izriše v sliko z z-bufferjem, skupaj s teksturami iz canvasa in aditivnimi spritei.

To ni igra in ni WebGL — **je pa dovolj, da se vidi kompozicija, paleta, kje svetloba pade in ali kamera stoji v steni**. Štirje posnetki so v `docs/round-41/`:

| slika | kje |
| --- | --- |
| `gl-01-gate.png` | vhod v dvorano, straže, skladi zabojev |
| `gl-02-hall.png` | sredina dvorane, galerije, luči, markacije |
| `gl-03-wells.png` | jaška, dvignjeni gunship, rakete na nosilcih |
| `gl-04-frost.png` | frost zaliv in ustje jame z dnevno svetlobo |

Omejitev, ki jo je treba povedati naravnost: rasterizator ne zna senčenja odsevov (GGX) in globinskih senc, zato so tla na slikah **manj mokra** in manj odsevna, kot bodo v brskalniku, kjer `roughnessMap` + točkovne luči naredijo prave bleščice. Prav tako so aditivni spritei približek bloomа.

## 8) Kaj je ostalo nespremenjeno

- Nič ni bilo odstranjeno ali poenostavljeno; vse spremembe so **dodane** plasti.
- Druge zahteve iz prejšnjih roundov (celozaslonski gumb ob različici, brez valov helikopterjev po pobegu iz zapora, razvijalski konzol z neomejenimi življenji samo na izbiro, 1 000-članska parada, nedotakljiva vojaška baza, prevzemljive kupole) niso bile v tem roundu niti omenjene niti spremenjene.
- Spremenjena datoteka: `src/components/Glacier3D.tsx` (+ `src/game/version.ts`, `docs/`). `tsc --noEmit` čist, `npm run build` uspešen.

## 9) Velikost paketa

`dist/index.html` **1 658,30 kB / gzip 484,33 kB** (prejšnji round: 1 629,78 kB / 475,79 kB).
