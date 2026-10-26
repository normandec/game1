# PROTOCOL SOLAR ECLIPSE: Black Vault

A six-sector, canvas-based tactical campaign with a separate Three.js S.H.I.E.L.D. sanctuary and a Three.js glacier vault.

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
- I / Tab: open or close the kit — the operative's loadout, grouped as it is packed.
- In a seized interceptor: Shift burns, S brakes, A / D rolls, X swaps cannon and missile stations, G / Q fires a locked missile, E toggles the orbit autopilot, Space drops countermeasures and breaks hard.
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

## Iron Reserve

- The army district is new ground south of the legacy frame in sector 6: a kilometre-long parade of a thousand men, megahangars, tower blocks, radomes, a water tower, artillery casemates and a motor pool. Its ranks, hulls, gates and turrets wake in stages; the base is built to be practically indestructible.
- Every army soldier wears camouflage — woodland, desert and winter patterns are drawn per unit, so a rank does not read as one flat colour.
- Cars are everywhere: staff cars and fuel bowsers parked in the motor pool and driven on four traffic circuits that loop the perimeter road, the causeway, the air park and the east service road.
- A military prison stands inside the sector: a wire compound with two cell blocks and four guard towers. Clear the military police around it and press F to break the stockade — fourteen of the army's own fall in on your side.
- Sector 3 hides the Glacier Vault behind an ice gate at X 10 710 / Y 9 820. The door opens on a bright three-dimensional hall of blue ice: twenty shield troopers in winter camouflage, two gunships that rise out of the wells and fight for you, and the Frostwing — an ice interceptor that grants permanent clearance, +30 health and a colder, faster airframe.
- The seized interceptor has a full flight model: throttle, airbrake, afterburner, a 57-degree seeker cone, cannon and missile stations, countermeasures with a hard break, and an orbit autopilot.
- Routine life in the bases does not wait for the player: patrols walk their posts, crews service hulls, convoys load and roll out, and guards rotate through the watchtowers while the alarm net is still asleep.

## Verification

The production build is verified with the supplied build tool. Browser playthroughs, WebGL appearance and device-specific frame rates still need manual verification.

Suggested manual checks: enter and exit the vault without losing progress; seal and reopen a gate; watch a convoy load, route around cover and dismount; watch a gunship return to a hangar; break crates and use an AEGIS cell; take frontal and rear damage; damage and lose a bomber; check keyboard and touch controls; complete a sector transfer; approach each facility type, check its cutaway and patrols, then clear its garrison and collect the one-time reward.

## Nightfall Protocol

- A skippable pre-insertion dossier explains HYDRA's takeover. Each combat phase has a story transmission; all five phase descriptions are also available under Dossier in the main menu.
- Searchlight cones now have real exposure and line-of-sight tests. Detection links the entire online searchlight network and orders exactly 30 troops in five six-person vans. Twelve seconds out of sight drops tracking. A 75-second dispatch cooldown prevents per-frame reserve spam.
- The first on-ground intrusion into the command perimeter and the first intrusion into the aviation hangars each order eight vans carrying eight troops. Each zone alarm is latched once per sector. The physical vehicle queue is staggered and capped concurrently; queued orders are not silently discarded.
- ATLAS cargo aircraft deploy paratroopers; MANTIS twin-rotor transports hover and lower troops on two visible ropes. Airborne troops become ground enemies only after their descent. Transports can be intercepted and return to the airfield when empty.
- Explosions damage every world structure, including fortified walls, hangars, equipment and hydraulic doors. Long walls are split into independently destructible sections; destroyed geometry stops blocking navigation and sight. The edge of the playable map remains bounded.
- Goliath Logistics Fortress, marked at X 2600 / Y 4520 (its halls run 2 600 px east from there), contains four defended warehouses, cargo yards and sixteen additional transport vehicles. Crews load in the nearest available motor pool and follow physical routes to the battle.
- Mnemosyne Library, farther north, contains three Carter volumes. Use F to read nearby volumes. The correct sequence is III, I, II: the last watch, the first oath, the second dawn. Solving it awards a 60-second searchlight identity mask, score and an EMP upgrade; existing convoys are not cancelled.
- Airfield and depot patrols move in two-column formations. Regular attack rosters follow phase doctrine rather than random tactic selection; the general still reacts to the player's mobility and use of cover.
- The Nightjar has a revised swept-wing silhouette, four engine nacelles, panel seams, cockpit glass, markings and an animated bomb bay. Its carpet bombs now descend from altitude instead of bouncing along walls.

Iron Reserve checks: walk a camouflage rank and confirm the pattern varies per soldier; drive the four traffic circuits; count the megahangars from the causeway; clear the military police around the stockade and break it open; open the ice gate in sector 3, fight through the vault, take the Frostwing and return to the surface; in the interceptor, lock a target, fire a missile, drop flares and let the autopilot orbit.

Additional manual checks: stand in a searchlight cone and count the five reserve vans; hide behind a wall until tracking ends; breach each guarded zone and check eight crews of eight; watch rope and parachute landings; destroy a wall section and drive through a wide enough breach; solve the library index; verify return trips and congestion recovery in narrow convoy lanes.