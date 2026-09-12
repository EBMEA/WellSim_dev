// Server case database — client-company accounts with username/password.
// The free version stays: every calculation endpoint works without signing
// in; accounts only add per-company case storage on the server.
//
// Storage (zero-dependency, JSON on disk under data/):
//   data/users.json                       [{company, username, salt, hash}]
//   data/cases/<company>/<case>.json      {name, savedBy, savedAt, case}
// Passwords: scrypt (random salt, timing-safe compare). Sessions: in-memory
// tokens (crypto.randomUUID) — a server restart signs everyone out.
// NOTE: served over plain HTTP; put TLS in front for internet deployment.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.WELLSIM_DATA_DIR ?? path.join(process.cwd(), 'data');
const usersFile = () => path.join(DATA_DIR, 'users.json');
const casesRoot = () => path.join(DATA_DIR, 'cases');

/* The account gate. Specified in
 * docs/specs/case-portability-and-account-gate.md §4 — read that before
 * changing anything here.
 *
 * WHY THIS STORE IS SHUT. Registration asks the visitor to type a company
 * name, and a typed name is not evidence of belonging to that company.
 * Leave registration open and a stranger picks an existing customer's name
 * and lands inside their namespace. Nothing here verifies identity, so
 * nothing here may be reachable until something does.
 *
 * TWO INDEPENDENT SWITCHES, and the second is the point. Enabling the store
 * does NOT enable registration: an operator must also set an invite word.
 * One switch would mean a single careless environment variable reopens public
 * sign-up on a live site.
 *
 * Visitor calculations, the browser autosave and Save as / Open are outside
 * this gate entirely and must stay that way — the app is fully usable with
 * the store shut, which is how it runs in production today.
 */
const caseStoreEnabled = () => process.env.WELLSIM_ENABLE_LEGACY_CASE_STORE === '1';
const registrationOpen = () => caseStoreEnabled() && Boolean(process.env.WELLSIM_INVITE);

// Kept as a machine-readable code so the UI can distinguish "shut" from
// "broken" without parsing prose.
const storeShut = () => ({
  error: 'server-side case storage is switched off on this deployment — use Save as / Open instead',
  code: 'legacy_case_store_disabled',
});

// One wrapper instead of the same guard line copied into every handler: a
// handler added later is gated by being listed below, not by remembering to
// paste a line at the top of it. accountStatus is deliberately NOT wrapped —
// it is the gate's own answer and has to work while the store is shut.
const gated = (handler) => (body) => (caseStoreEnabled() ? handler(body) : storeShut());

export { caseStoreEnabled as legacyCaseStoreEnabled };

const sessions = new Map(); // token -> { company, username }

/** Path-safe slug: lowercase, [a-z0-9-_], spaces -> dashes, max 60. */
const slug = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 60);

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile(), 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(usersFile(), JSON.stringify(users, null, 1));
}

const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');

// brute-force throttle: after 5 failed logins for a username within 15
// minutes, further attempts are rejected until the window cools down
const failedLogins = new Map(); // username -> { count, firstAt }
const THROTTLE_MAX = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

function throttled(u) {
  const f = failedLogins.get(u);
  if (!f) return false;
  if (Date.now() - f.firstAt > THROTTLE_WINDOW_MS) {
    failedLogins.delete(u);
    return false;
  }
  return f.count >= THROTTLE_MAX;
}

function noteFailure(u) {
  const f = failedLogins.get(u);
  if (!f || Date.now() - f.firstAt > THROTTLE_WINDOW_MS) {
    failedLogins.set(u, { count: 1, firstAt: Date.now() });
  } else {
    f.count += 1;
  }
}

function registerAccount({ company, username, password, invite }) {
  // The second switch. Even with the store enabled, sign-up stays closed until
  // an operator sets an invite word and the caller presents exactly it.
  const required = process.env.WELLSIM_INVITE;
  if (!required || String(invite ?? '') !== required)
    return { error: 'registration needs the invite word — ask the site owner' };
  const c = slug(company);
  const u = slug(username);
  if (!c) return { error: 'company name required' };
  if (!u) return { error: 'username required' };
  if (!password || String(password).length < 4)
    return { error: 'password must be at least 4 characters' };
  const users = loadUsers();
  if (users.some((x) => x.username === u))
    return { error: `username "${u}" already exists — sign in instead` };
  const salt = crypto.randomBytes(16).toString('hex');
  users.push({
    company: c,
    username: u,
    salt,
    hash: hashPw(password, salt),
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);
  return login({ username: u, password });
}

function loginAccount({ username, password }) {
  const u = slug(username);
  if (throttled(u))
    return { error: 'too many failed attempts — wait 15 minutes and try again' };
  const rec = loadUsers().find((x) => x.username === u);
  const bad = { error: 'wrong username or password' };
  if (!rec) {
    noteFailure(u);
    return bad;
  }
  const h = hashPw(password ?? '', rec.salt);
  if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(rec.hash))) {
    noteFailure(u);
    return bad;
  }
  failedLogins.delete(u);
  const token = crypto.randomUUID();
  sessions.set(token, { company: rec.company, username: rec.username });
  return { token, company: rec.company, username: rec.username };
}

function logoutAccount({ token }) {
  sessions.delete(token);
  return { ok: true };
}

const auth = (body) => sessions.get(body?.token) ?? null;
const companyDir = (company) => path.join(casesRoot(), company);

function saveCase(body) {
  const s = auth(body);
  if (!s) return { error: 'not signed in' };
  const name = slug(body.name);
  if (!name) return { error: 'case name required' };
  if (!body.case || body.case.app !== 'WellSim') return { error: 'not a WellSim case' };
  fs.mkdirSync(companyDir(s.company), { recursive: true });
  fs.writeFileSync(
    path.join(companyDir(s.company), `${name}.json`),
    JSON.stringify(
      { name, savedBy: s.username, savedAt: new Date().toISOString(), case: body.case },
      null,
      1
    )
  );
  return { ok: true, name, company: s.company };
}

function listCases(body) {
  const s = auth(body);
  if (!s) return { error: 'not signed in' };
  let files = [];
  try {
    files = fs.readdirSync(companyDir(s.company)).filter((f) => f.endsWith('.json'));
  } catch {
    /* company has no cases yet */
  }
  const cases = files
    .map((f) => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(companyDir(s.company), f), 'utf8'));
        return { name: j.name ?? f.replace(/\.json$/, ''), savedBy: j.savedBy ?? null, savedAt: j.savedAt ?? null };
      } catch {
        return { name: f.replace(/\.json$/, ''), savedBy: null, savedAt: null };
      }
    })
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  return { company: s.company, username: s.username, cases };
}

function loadCase(body) {
  const s = auth(body);
  if (!s) return { error: 'not signed in' };
  const name = slug(body.name);
  try {
    const j = JSON.parse(
      fs.readFileSync(path.join(companyDir(s.company), `${name}.json`), 'utf8')
    );
    return { name: j.name, savedBy: j.savedBy, savedAt: j.savedAt, case: j.case };
  } catch {
    return { error: `case "${name}" not found` };
  }
}

function deleteCase(body) {
  const s = auth(body);
  if (!s) return { error: 'not signed in' };
  const name = slug(body.name);
  try {
    fs.unlinkSync(path.join(companyDir(s.company), `${name}.json`));
    return { ok: true };
  } catch {
    return { error: `case "${name}" not found` };
  }
}

// The gate's own answer. Never gated: the UI asks this precisely to find out
// whether the store is shut, so it has to respond when it is.
export function accountStatus() {
  return {
    enabled: caseStoreEnabled(),
    registrationEnabled: registrationOpen(),
    mode: 'legacy-web',
  };
}

// Everything that touches accounts or stored cases goes out through gated(),
// so a handler cannot reach the filesystem while the store is off.
export const register = gated(registerAccount);
export const login = gated(loginAccount);
export const logout = gated(logoutAccount);
export const caseSave = gated(saveCase);
export const caseList = gated(listCases);
export const caseLoad = gated(loadCase);
export const caseDelete = gated(deleteCase);

export const accountHandlers = {
  'accounts/status': accountStatus,
  'auth/register': register,
  'auth/login': login,
  'auth/logout': logout,
  'cases/save': caseSave,
  'cases/list': caseList,
  'cases/load': caseLoad,
  'cases/delete': caseDelete,
};
