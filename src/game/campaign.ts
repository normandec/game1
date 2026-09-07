export type OperationPhase = 'recon' | 'convoy' | 'bombard' | 'assault' | 'siege';
export interface StoryEntry { id: string; channel: string; title: string; text: string }

export const PROLOGUE: StoryEntry = {
  id: 'prologue', channel: 'S.H.I.E.L.D. / LAST SECURE TRANSMISSION', title: 'The night the badges changed.',
  text: 'At 03:17, five S.H.I.E.L.D. installations went silent. HYDRA did not break through the gates. They already had the keys. Our aircraft, archives and supply columns now answer to their command network. You are the last operative outside their registry. Enter the occupied territory, recover Carter\'s lost intelligence, and sever all five command nodes. The Black Vault is still ours. Trust the signal, not the uniform.',
};

export const PHASE_STORY: Record<OperationPhase, StoryEntry> = {
  recon: { id: 'recon', channel: 'FIELD CONTROL / CHAPTER 01', title: 'The perimeter wakes.', text: 'HYDRA has noticed missing check-ins. Patrols are searching in formation while transports prepare in the motor pool. Stay outside the searchlight cones. If a lamp identifies you, the entire network will track you and dispatch thirty troops.' },
  convoy: { id: 'convoy', channel: 'LOGISTICS INTERCEPT / CHAPTER 02', title: 'Every road leads to Goliath.', text: 'The warehouse fortress is feeding the occupation. Convoy crews are boarding with ammunition and replacement troops. Their routes are predictable; their destination is your last known position. Break a roadblock, destroy a transport, or follow the column back to its source.' },
  bombard: { id: 'bombard', channel: 'AIR WATCH / CHAPTER 03', title: 'Boots from the sky.', text: 'Atlas cargo aircraft and MANTIS heavy transports are inbound. Watch for parachutes and two fast-ropes below hovering helicopters. Grenadiers are trying to push you out of cover. Your own rockets can now cut a new entrance through the fortifications.' },
  assault: { id: 'assault', channel: 'CARTER ARCHIVE / CHAPTER 04', title: 'The library that forgot its name.', text: 'A pre-war index survived in the Mnemosyne Library. Carter hid an identification cipher among three volumes: the last watch, the first oath, the second dawn. Recover it and the search network will briefly see you as one of its own.' },
  siege: { id: 'siege', channel: 'COMMAND INTERCEPT / CHAPTER 05', title: 'No more borrowed flags.', text: 'HYDRA has committed its combined reserves. Crossing the main perimeter or entering the aviation hangars calls eight transports, each carrying eight soldiers. The command mainframes are the target. Make your own breach, hold a route out, and bring our aircraft home.' },
};

export const PHASE_TACTICS: Record<OperationPhase, string[]> = {
  recon: ['column', 'pincer', 'phalanx', 'column'],
  convoy: ['phalanx', 'column', 'turtle', 'pincer'],
  bombard: ['bombers', 'phalanx', 'bombers', 'column'],
  assault: ['pincer', 'blitz', 'phalanx', 'bombers'],
  siege: ['turtle', 'phalanx', 'bombers', 'encircle'],
};

export const LIBRARY_VOLUMES: StoryEntry[] = [
  { id: 'volume-1', channel: 'MNEMOSYNE / VOLUME I', title: 'The first oath.', text: '1946. Carter wrote that a uniform could be copied, but a promise could not. This volume holds the first half of an obsolete S.H.I.E.L.D. transponder handshake.' },
  { id: 'volume-2', channel: 'MNEMOSYNE / VOLUME II', title: 'The second dawn.', text: 'The last page is not paper. It is a thin encrypted wafer, warmed by the reading lamp. Read the watch, the oath, then the dawn. The sleeping network will open its eyes for you.' },
  { id: 'volume-3', channel: 'MNEMOSYNE / VOLUME III', title: 'The last watch.', text: 'A margin note in Carter\'s handwriting: "Start at the end. Last watch. First oath. Second dawn." Three volumes form one identification cipher. HYDRA catalogued the shelves but never understood the order.' },
];