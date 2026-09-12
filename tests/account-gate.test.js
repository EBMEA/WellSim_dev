// The account gate, tested against docs/specs/case-portability-and-account-gate.md §4.
//
// This is the control that keeps public registration shut on a live site, so
// it is tested by switch combination rather than by one "is it off" assertion.
// Each case loads the module fresh, because the gate reads process.env at call
// time and a stale import would hide exactly the bug worth catching.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let seq = 0;
async function withEnv(env) {
  for (const key of ['WELLSIM_ENABLE_LEGACY_CASE_STORE', 'WELLSIM_INVITE']) delete process.env[key];
  Object.assign(process.env, env);
  seq += 1;
  return import(`../src/server/accounts.js?gate=${seq}`);
}

test('shut by default: no environment, no store, no registration', async () => {
  const accounts = await withEnv({});
  assert.deepEqual(accounts.accountStatus(), {
    enabled: false,
    registrationEnabled: false,
    mode: 'legacy-web',
  });
});

test('every account and case handler refuses while the store is shut', async () => {
  const accounts = await withEnv({});
  const refusals = [
    ['register', accounts.register({ company: 'X', username: 'u', password: 'pass1', invite: 'w' })],
    ['login', accounts.login({ username: 'u', password: 'pass1' })],
    ['logout', accounts.logout({ token: 't' })],
    ['caseSave', accounts.caseSave({ token: 't', name: 'c', case: { app: 'WellSim' } })],
    ['caseList', accounts.caseList({ token: 't' })],
    ['caseLoad', accounts.caseLoad({ token: 't', name: 'c' })],
    ['caseDelete', accounts.caseDelete({ token: 't', name: 'c' })],
  ];
  for (const [name, result] of refusals) {
    assert.equal(result.code, 'legacy_case_store_disabled', `${name} should refuse`);
    assert.match(result.error, /Save as/, `${name} should point at the local alternative`);
  }
});

test('accountStatus answers while the store is shut — it is the gate’s own report', async () => {
  const accounts = await withEnv({});
  const status = accounts.accountStatus();
  assert.equal(status.code, undefined, 'status must not be gated');
  assert.equal(status.enabled, false);
});

test('the switch is exact: only the string "1" opens the store', async () => {
  for (const value of ['true', 'yes', 'on', '0', '', ' 1', '1 ', 'TRUE']) {
    const accounts = await withEnv({ WELLSIM_ENABLE_LEGACY_CASE_STORE: value });
    assert.equal(
      accounts.accountStatus().enabled,
      false,
      `${JSON.stringify(value)} must not enable the store`,
    );
  }
  const open = await withEnv({ WELLSIM_ENABLE_LEGACY_CASE_STORE: '1' });
  assert.equal(open.accountStatus().enabled, true);
});

test('two independent switches: enabling the store does not open registration', async () => {
  const accounts = await withEnv({ WELLSIM_ENABLE_LEGACY_CASE_STORE: '1' });
  const status = accounts.accountStatus();
  assert.equal(status.enabled, true, 'store is on');
  assert.equal(status.registrationEnabled, false, 'but sign-up stays closed without an invite word');

  const attempt = accounts.register({ company: 'X', username: 'u', password: 'pass1', invite: 'guess' });
  assert.match(attempt.error, /invite word/);
  assert.equal(attempt.code, undefined, 'refused for the invite, not by the store gate');
});

test('an invite word alone opens nothing while the store is shut', async () => {
  const accounts = await withEnv({ WELLSIM_INVITE: 'word' });
  assert.deepEqual(accounts.accountStatus(), {
    enabled: false,
    registrationEnabled: false,
    mode: 'legacy-web',
  });
  assert.equal(accounts.register({ company: 'X', username: 'u', password: 'pass1', invite: 'word' }).code,
    'legacy_case_store_disabled');
});

test('registration reports open only when both switches are set', async () => {
  const accounts = await withEnv({ WELLSIM_ENABLE_LEGACY_CASE_STORE: '1', WELLSIM_INVITE: 'word' });
  assert.deepEqual(accounts.accountStatus(), {
    enabled: true,
    registrationEnabled: true,
    mode: 'legacy-web',
  });
});

test('a wrong invite word is refused even with both switches on', async () => {
  const accounts = await withEnv({ WELLSIM_ENABLE_LEGACY_CASE_STORE: '1', WELLSIM_INVITE: 'word' });
  assert.match(
    accounts.register({ company: 'X', username: 'u', password: 'pass1', invite: 'not-the-word' }).error,
    /invite word/,
  );
  assert.match(
    accounts.register({ company: 'X', username: 'u', password: 'pass1' }).error,
    /invite word/,
    'a missing invite is as bad as a wrong one',
  );
});
