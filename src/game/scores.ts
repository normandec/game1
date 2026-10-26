export interface ScoreEntry {
  name: string;
  score: number;
  wave: number;
  date: number;
}

/* THE OLD KEY STILL READS.
 * The game shipped for a year under the working title IRON VEIL, and the table lives under
 * `ironveil.*`. Renaming the key would have deleted every score and every callsign on the
 * first load after the update, so the new name is written alongside the old one and the old
 * one is still read as a fallback. Nothing is lost either way. */
const KEY = 'solar-eclipse.highscores.v1';
const NAME_KEY = 'solar-eclipse.callsign';
const LEGACY_KEY = 'ironveil.highscores.v1';
const LEGACY_NAME_KEY = 'ironveil.callsign';

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10);
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
    // Keep the table the old build reads in step, so a downgrade does not look like a wipe.
    localStorage.setItem(LEGACY_KEY, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  return top;
}

export function bestScore(): number {
  const l = loadScores();
  return l.length ? l[0].score : 0;
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? localStorage.getItem(LEGACY_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
    localStorage.setItem(LEGACY_NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

export function renameEntry(date: number, name: string): ScoreEntry[] {
  const list = loadScores().map((e) => (e.date === date ? { ...e, name } : e));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
