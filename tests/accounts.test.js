// The server case store: accounts, sessions, and isolation between companies.
//
// The gate that decides whether this store is reachable at all is tested
// separately in account-gate.test.js. Here the store is switched ON on purpose
// so its behaviour can be exercised; nothing below asserts anything about the
// default, and nothing below should be read as evidence that the store is
// available in production. It is not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Both of these must be set BEFORE the module is imported: the data directory
// is read once at module scope, and a real run would otherwise write accounts
// into the working tree's data/ — which holds client cases.
process.env.WELLSIM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wellsim-accounts-'));
process.env.WELLSIM_ENABLE_LEGACY_CASE_STORE = '1';
process.env.WELLSIM_INVITE = 'test-invite';

const { register, login, logout, caseSave, caseList, caseLoad, caseDelete } =
  await import('../src/server/accounts.js');

// Registration needs the invite word on every call; wrap it once rather than
// repeating the env lookup in each test.
const signUp = (body) => register({ ...body, invite: process.env.WELLSIM_INVITE });

const CASE = { app: 'WellSim', version: 1, inputs: { 'oil-thpPsi': '700' }, radios: {}, grids: {} };

test('sign-up slugs the names, returns a session, and refuses a duplicate', () => {
  const created = signUp({ company: 'Acme Oil', username: 'Ali', password: 'secret7' });
  assert.ok(!created.error, created.error);
  assert.equal(created.company, 'acme-oil', 'company is slugged for use as a directory name');
  assert.equal(created.username, 'ali');
  assert.ok(created.token);

  const duplicate = signUp({ company: 'acme-oil', username: 'ali', password: 'x1234' });
  assert.match(duplicate.error, /already exists/);
});

test('a wrong password is refused, and a fresh sign-in issues a new token', () => {
  assert.match(login({ username: 'ali', password: 'nope' }).error, /wrong username or password/);
  const first = login({ username: 'ali', password: 'secret7' });
  const second = login({ username: 'ali', password: 'secret7' });
  assert.ok(first.token && second.token);
  assert.notEqual(first.token, second.token, 'each sign-in gets its own session');
});

test('a case round-trips through save, list, load and delete', () => {
  const { token } = login({ username: 'ali', password: 'secret7' });

  assert.match(caseSave({ token: 'not-a-token', name: 'x', case: CASE }).error, /not signed in/);
  assert.match(caseSave({ token, name: 'x', case: { foo: 1 } }).error, /not a WellSim case/);

  const saved = caseSave({ token, name: 'Well A-1 match', case: CASE });
  assert.ok(!saved.error, saved.error);
  assert.equal(saved.name, 'well-a-1-match', 'the case name becomes a safe filename');

  const listed = caseList({ token });
  assert.equal(listed.cases.length, 1);
  assert.equal(listed.cases[0].savedBy, 'ali');

  assert.deepEqual(caseLoad({ token, name: 'well-a-1-match' }).case, CASE);
  assert.match(caseLoad({ token, name: 'no-such-case' }).error, /not found/);

  assert.ok(caseDelete({ token, name: 'well-a-1-match' }).ok);
  assert.equal(caseList({ token }).cases.length, 0);
});

test('five wrong passwords lock that username, and only that username', () => {
  signUp({ company: 'Gamma Co', username: 'carol', password: 'goodpw1' });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    assert.match(
      login({ username: 'carol', password: 'wrong' }).error,
      /wrong username or password/,
      `attempt ${attempt} should fail normally`,
    );
  }

  // The sixth attempt is refused even though the password is now correct —
  // otherwise the throttle would only slow down an attacker who guesses wrong
  // forever, and stop protecting the moment they guess right.
  assert.match(login({ username: 'carol', password: 'goodpw1' }).error, /too many failed attempts/);

  // The lock is per username, so one account cannot be used to deny service
  // to another.
  assert.ok(login({ username: 'ali', password: 'secret7' }).token);
});

test('the invite word must match exactly', () => {
  const original = process.env.WELLSIM_INVITE;
  process.env.WELLSIM_INVITE = 'drillbit';
  try {
    assert.match(register({ company: 'X', username: 'no-invite', password: 'pass1' }).error, /invite word/);
    assert.match(register({ company: 'X', username: 'bad-invite', password: 'pass1', invite: 'DRILLBIT' }).error, /invite word/);
    assert.ok(register({ company: 'X', username: 'good-invite', password: 'pass1', invite: 'drillbit' }).token);
  } finally {
    process.env.WELLSIM_INVITE = original;
  }
});

test('one company cannot see or load another company’s cases', () => {
  const acme = login({ username: 'ali', password: 'secret7' });
  caseSave({ token: acme.token, name: 'acme-confidential', case: CASE });

  const beta = signUp({ company: 'Beta Energy', username: 'bob', password: 'pass99' });
  const betaCases = caseList({ token: beta.token });
  assert.equal(betaCases.company, 'beta-energy');
  assert.equal(betaCases.cases.length, 0, 'Beta must not see Acme cases');
  assert.match(caseLoad({ token: beta.token, name: 'acme-confidential' }).error, /not found/);
});

test('logging out invalidates the token immediately', () => {
  const session = login({ username: 'ali', password: 'secret7' });
  assert.ok(caseList({ token: session.token }).cases);
  logout({ token: session.token });
  assert.match(caseList({ token: session.token }).error, /not signed in/);
});
