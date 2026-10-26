# Round 44 evidence

| File | What it shows |
|---|---|
| `layout-map.png` | the whole district drawn from the live world data at 0.32 px per world px: every zone, every structure and every named position in the base — the band structure (approach · north · inner · airfield) and where the props actually sit |
| `airfield.png` | in-engine frame at the runway: edge lighting, apron, the halls south of the tarmac, the wing's armour parked with the aircraft |
| `inner-compound.png` | in-engine frame of the parade ground, the barracks flanks and the armour park outside the west wall |
| `rotary-park.png` | in-engine frame of the old air‑park band, now the rotary park and stockade side |

Both in-engine frames are rendered head‑less at 1600 × 900 with the real draw path
(`Game.render()` on a jsdom canvas), so they are the game's own output, not mock‑ups.
