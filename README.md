# IRON VEIL: Black Vault

A five-sector, canvas-based tactical campaign with a separate Three.js S.H.I.E.L.D. sanctuary.

## Find The Vault

The concealed north entrance is at **X 980, Y 7040**. The insertion point is X 6000, Y 6800. Travel west, then slightly south; approach on foot from the north and press **F** near the hatch. **V** toggles an optional directional guide. The HUD displays the operative's coordinates.

The original continuous north wall has been split into two physical sections. Random structures are excluded from the entrance approach. Entering pauses the battlefield and opens the 3D vault; returning to the surface resumes the same campaign state.

## Controls

- WASD / arrows: move, drive or fly. Mouse / right touch stick: aim and fire.
- F: interact, enter the vault, seize a vehicle or disembark.
- L: lock or unlock a nearby hydraulic gate. Unlocked gates open automatically on approach.
- C: consume one AEGIS cell for a three-second invulnerable forward shield. It does not protect the rear.
- G / right mouse: grenade, aircraft rockets or bomber payload.
- Space / Shift: dash on foot; Shift boosts a driven van.
- Escape / P: pause the battlefield.

Inside the 3D vault, WASD moves the operative, dragging rotates the camera and the wheel zooms. The numbered station tabs move the camera to the air wing, operations, quartermaster and Carter archive. Aircraft requisitions and supplies work only after reaching the vault in the campaign. The menu's 3D tour does not grant rewards.

## Systems

- Clearance-aware A* routes, collision-checked steering, staged infantry boarding and slower convoy dismounts.
- Hydraulic gate leaves that block sight, projectiles and ground movement; locked gates can be breached.
- Destructible world crates, supply caches and consumable AEGIS drops.
- Assigned aircraft hangars, rotor startup, taxi, takeoff, return, landing and servicing.
- Armed captured transports; bomber and gunship hull damage, fuel and emergency ejection.
- Local garrison sight detection with a radio alert to nearby units.
- A detailed 3D safehouse with instanced architecture, aircraft models, tactical hologram, consoles, medical facilities and SSR archive.

## Field Installations

- Six new site types: security checkpoints, bioresearch laboratories, radar stations, armored workshops, power substations and munitions bunkers.
- The generator targets 12 installations in sector one, increasing to 20 in sector five. Plots are reserved before random cover, with two wide entrances and clear central lanes.
- Each site has 8 to 10 additional defenders: a commander, shield troops, sentries, patrols and support. Wardens hold entrances; Pathfinders take flanking positions. Site guards use their own clearance-aware infantry routes and shared radio alerts.
- Nearby facility names and defender counts appear on the HUD. Discovered sites receive minimap markers. Clearing a site grants a one-time score bonus and supplies.
- Cached facility art includes containment chambers, radar dishes, vehicle lifts, transformers, cooling tanks and weapon racks. Roof cutaways reveal the laboratory, workshop and armory interiors.
- Assault waves now deploy 4 to 8 fireteams. Distant garrisons sleep, and infantry separation uses neighboring spatial buckets.

## Verification

The production build is verified with the supplied build tool. Browser playthroughs, WebGL appearance and device-specific frame rates still need manual verification.

Suggested manual checks: enter and exit the vault without losing progress; seal and reopen a gate; watch a convoy load, route around cover and dismount; watch a gunship return to a hangar; break crates and use an AEGIS cell; take frontal and rear damage; damage and lose a bomber; check keyboard and touch controls; complete a sector transfer; approach each facility type, check its cutaway and patrols, then clear its garrison and collect the one-time reward.

## Nightfall Protocol

- A skippable pre-insertion dossier explains HYDRA's takeover. Each combat phase has a story transmission; all five phase descriptions are also available under Dossier in the main menu.
- Searchlight cones now have real exposure and line-of-sight tests. Detection links the entire online searchlight network and orders exactly 30 troops in five six-person vans. Twelve seconds out of sight drops tracking. A 75-second dispatch cooldown prevents per-frame reserve spam.
- The first on-ground intrusion into the command perimeter and the first intrusion into the aviation hangars each order eight vans carrying eight troops. Each zone alarm is latched once per sector. The physical vehicle queue is staggered and capped concurrently; queued orders are not silently discarded.
- ATLAS cargo aircraft deploy paratroopers; MANTIS twin-rotor transports hover and lower troops on two visible ropes. Airborne troops become ground enemies only after their descent. Transports can be intercepted and return to the airfield when empty.
- Explosions damage every world structure, including fortified walls, hangars, equipment and hydraulic doors. Long walls are split into independently destructible sections; destroyed geometry stops blocking navigation and sight. The edge of the playable map remains bounded.
- Goliath Logistics Fortress, centered at X 2800 / Y 4520, contains four defended warehouses, cargo yards and sixteen additional transport vehicles. Crews load in the nearest available motor pool and follow physical routes to the battle.
- Mnemosyne Library, farther north, contains three Carter volumes. Use F to read nearby volumes. The correct sequence is III, I, II: the last watch, the first oath, the second dawn. Solving it awards a 60-second searchlight identity mask, score and an EMP upgrade; existing convoys are not cancelled.
- Airfield and depot patrols move in two-column formations. Regular attack rosters follow phase doctrine rather than random tactic selection; the general still reacts to the player's mobility and use of cover.
- The Nightjar has a revised swept-wing silhouette, four engine nacelles, panel seams, cockpit glass, markings and an animated bomb bay. Its carpet bombs now descend from altitude instead of bouncing along walls.

Additional manual checks: stand in a searchlight cone and count the five reserve vans; hide behind a wall until tracking ends; breach each guarded zone and check eight crews of eight; watch rope and parachute landings; destroy a wall section and drive through a wide enough breach; solve the library index; verify return trips and congestion recovery in narrow convoy lanes.