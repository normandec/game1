/* ------------------------------------------------------------------ *
 * GAME VERSION — the single place the build number lives.
 *
 * The version is shown on the start screen (and, from now on, every round gets a
 * bump here so the deployed build always says what it is). Bump `minor` for a
 * round of content, `patch` for a hotfix that ships without new content, and keep
 * `round` in step with the development round so the two never disagree.
 * ------------------------------------------------------------------ */

export interface GameVersion {
  major: number;
  minor: number;
  patch: number;
  /** Development round that produced this build. */
  round: number;
  codename: string;
  /** ISO date of the build. */
  date: string;
}

export const GAME_VERSION: GameVersion = {
  major: 1,
  minor: 37,
  patch: 0,
  round: 37,
  codename: 'SOLAR ECLIPSE',
  date: '2026-10-25',
};

/** `v1.37.0` — the short label that goes on the start screen. */
export const VERSION_LABEL = `v${GAME_VERSION.major}.${GAME_VERSION.minor}.${GAME_VERSION.patch}`;

/** `v1.37.0 · ROUND 37 · 2026-10-25` — the full stamp for the footer. */
export const BUILD_STAMP = `${VERSION_LABEL} · ROUND ${GAME_VERSION.round} · ${GAME_VERSION.date}`;
