# Objava na itch.io — PROTOCOL SOLAR ECLIPSE: Black Vault

Pripravljen paket: `release/protocol-solar-eclipse-itch.zip` (359 KB, vsebuje eno samo
`index.html` v korenu zipa — točno tako, kot zahteva itch.io).
Če igro spremeniš, paket obnoviš z: `npm run build` → zapakiraj `dist/index.html` v nov zip.

---

## 1. Koraki objave (15–30 min)

1. Brezplačen račun na https://itch.io/register
2. Zgoraj desno: puščica pri uporabniškem imenu → **Upload new project**
3. Izpolni (glej spodnje predloge):
   - **Title:** PROTOCOL SOLAR ECLIPSE: Black Vault
   - **Project URL:** `protocol-solar-eclipse`
   - **Short description:** glej spodaj
   - **Kind of project:** HTML
   - **Classification:** Games · **Release status:** Released
4. **Uploads → Upload files** → izberi `release/protocol-solar-eclipse-itch.zip`
   → obkljukaj **"This file will be played in the browser"** ⚠️ (brez tega igre ni mogoče igrati v brskalniku)
5. **Embed options:**
   - **Embed in page**, viewport **1280 × 720**
   - ☑ Enable fullscreen button · ☑ Click to launch in fullscreen (priporočeno)
   - **Frame options:** Mobile friendly — igra ima touch kontrole
   - ☐ SharedArrayBuffer support — NE rabiš
6. Naloži **cover image 630 × 500 px** (obvezno za prikaz v iskanju!) + **3–5 posnetkov zaslona**
   (posnemi jih med igranjem — akcija, vozila, 3D trezor; animiran GIF deluje še boljše)
7. **Pricing:** No payments (brezplačno — glej opozorilo v poglavju 3)
8. **Visibility & access** (na dnu): ☑ **Public** → **Save & view page** → preigraj vdelano različico!

Opomba: stran včasih potrebuje **nekaj dni**, da se pojavi v itch-ovem iskanju (indeksiranje).
To je normalno. Pogoj: javna stran + cover image + vsaj en posnetek zaslona + oznake (tags).

---

## 2. Besedilo za skopirati na itch stran (angleško — občinstvo na itch.io je angleško)

**Short description (ena vrstica):**

> Top-down tactical military sandbox: infiltrate five occupied strongholds, hijack convoys, gunships and bombers — every enemy reinforcement physically drives to you. Play in browser, no download.

**Opis (Description):**

> **One operative. Five occupied strongholds. An enemy that never teleports.**
>
> PROTOCOL SOLAR ECLIPSE: Black Vault is a huge top-down tactical sandbox shooter that runs entirely in your browser. Infiltrate five 98 km² warzones on foot, in hijacked transports, tanks, gunships and a heavy bomber. Trip a searchlight and thirty troops will board vans in the motor pool, drive the roads and dismount on your position — seal a hydraulic gate and the convoy has to find another way. Knock out the HELIOS power grid and the whole sector goes dark: searchlights die, soldiers switch on helmet lamps and hunting columns move on your last known position.
>
> Somewhere in the southwest (X 980 / Y 7040) hides the Black Vault — a fully 3D safehouse with an aircraft hangar, quartermaster, medical bay and a classified archive. Find it, requisition aircraft, then return to the exact battlefield you left.
>
> **Features**
> - 5 handcrafted sectors, 24+ enemy types, formations, morale and an adaptive AI commander
> - Fully simulated logistics: boarding, road convoys, airfield traffic, paratroopers, rope drops
> - Destructible walls, gates, crates and facilities — blast your own breach
> - Drivable/flyable vehicles with fuel, damage and hangar servicing
> - A separate explorable 3D vault, puzzles, blackout mode, local highscores
> - Keyboard/mouse and touch controls. No install, no account — just press play.
>
> **Controls:** WASD move/drive/fly · Mouse aim & fire · F interact/enter vehicle · G grenade/rockets/bombs · C AEGIS shield · L gate lock · Space dash · Esc pause

**Genre:** Action, Shooter
**Oznake / Tags (največ 10):**
`top-down-shooter, military, sandbox, tactical, singleplayer, browser, vehicles, stealth, Open World, free`

**Dodatne nastavitve strani:**
- ☐ "This game contains AI generated textures..." — pusti, kar velja za igro (grafika je proceduralna/canvas)
- Comments: Enabled (komentarji pomagajo pri vidnosti)
- Community: lahko dodaš Discussion board

---

## 3. ⚠️ Pred objavo preveri: težava z imeni (Marvel IP)

Igra uporablja **S.H.I.E.L.D., HYDRA, Peggy Carter, Tesseract** — to so blagovne znamke/liki **Marvela (Disney)**.
itch.io tega ne preverja vnaprej, a imetnik pravic lahko kadarkoli zahteva odstranitev (DMCA) — in to
velja tudi, če je igra brezplačna. Pričakovano tveganje za majhno brezplačno igro je nizko, ampak:

- igre **nikakor ne prodajaj** in ne vključuj donacij, dokler vsebuje tuje IP,
- na stran dodaj: *"Unofficial fan project. Not affiliated with Marvel."* (pomaga, ne ščiti pa pravno),
- **najvarneje:** preimenuj v izvirna imena (npr. S.H.I.E.L.D. → "AEGIS DIRECTORATE", HYDRA → "LEVIATHAN",
  Carter → izmisli si arhivistko). Mehanike in zgodba delujejo brez Marvel imen — in šele takrat je igra
  zares "tvoja" tudi za morebitno prodajo kasneje.

---

## 4. Po objavi (kar dejansko prinese igralce)

itch.io **nima** Steamu podobnega algoritma — igra sama od sebe skoraj ne dobi prometa. Deluje pa:

1. **Cover GIF + posnetki** — najpomembnejša stvar na strani; pokaži konvoje/eksplozije, ne menija.
2. **Devlog** ob objavi in ob vsaki posodobitvi (vsak devlog te potisne v feed).
3. Deli povezavo zunaj itcha: Reddit (r/WebGames, r/itchio, r/indiegames), Discord, prijatelji.
4. Kratki video/GIF posnetki igranja (TikTok/YouTube Shorts) — "sovražniki se res pripeljejo do tebe" je dober hook.
5. Majhni YouTube/Twitch ustvarjalci, ki igrajo brskalniške igre, odgovorijo presenetljivo pogosto.
6. Game jami na itchu so najlažji način do prvih igralcev in ocen — a ta igra je že narejena, jam raje uporabi za naslednjo.
