# Specification: case portability (Save as / Open) and the account gate

**Status:** normative. Written 12 September 2026 to support a clean
reimplementation of `src/ui/export.js`, the export-related parts of
`src/ui/app.js`, and the account-store gate in `src/server/accounts.js`.

**Implement from this document alone.** Do not read the existing
implementations of those files while writing the replacements. If this
specification is ambiguous, resolve it against the sources listed below and
extend this document — do not resolve it by looking at the current code.

## Where this specification comes from

Every requirement below is derived from artefacts that are **not** the
implementation being replaced:

| Source | What it fixes |
|---|---|
| `src/ui/help.html` §"Save as / Open" and §"Header bar" | the user-visible contract, platform behaviour, and guarantees |
| Real saved case files under `data/cases/` (81 files) | the on-disk JSON format, normatively |
| `src/ui/index.html` | the DOM surface: control ids and the file input's `accept` |
| The live API surface | the endpoint names the gate must answer for |
| `sea-config.json` | the fact that the export module is embedded in the portable exe |

The file format is **fixed by data that already exists**, not by a design
decision now open for revision. Existing cases must continue to open.

---

## 1. Case file format

### 1.1 Envelope

A saved case is a single UTF-8 JSON file. The top level is an object:

| Key | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | human-readable case name |
| `savedBy` | string | yes | who saved it; the account name where known, otherwise a local marker |
| `savedAt` | ISO-8601 string | yes | envelope save time |
| `case` | object | yes | the payload, §1.2 |

### 1.2 Payload

| Key | Type | Required | Meaning |
|---|---|---|---|
| `app` | string | yes | product identifier, so a foreign JSON can be rejected with a clear message |
| `version` | string/number | yes | payload schema version |
| `savedAt` | ISO-8601 string | yes | payload save time |
| `activeTab` | string | yes | which of Oil / Water / Gas was in front |
| `inputs` | object | yes | every text/number field, keyed by DOM id |
| `computed` | object | yes | program-filled values, §3.3 |
| `radios` | object | yes | radio-group selections, keyed by group name |
| `selects` | object | yes | dropdown selections, keyed by DOM id |
| `grids` | object | yes | every tabular input (production data, sensitivity sets, multi-rate tests), keyed by table id, each a 2-D array of cell strings |

### 1.3 Rules

1. **Round-trip fidelity.** Saving a case and opening it again must restore
   the application to a state that solves to the same numbers. This is the
   acceptance test, not an aspiration.
2. **All three tabs.** The payload covers Oil, Water **and** Gas regardless of
   which tab was active. Switching tabs after an Open must show the restored
   state, not defaults.
3. **Unknown keys are preserved on load and ignored.** A case written by a
   newer build must not be destroyed by an older one.
4. **Reject foreign files by `app`**, with a message naming the problem. Do
   not attempt partial import.

---

## 2. Save as

### 2.1 Guarantees (from the manual, and binding)

- The case is written **locally only**. No network request is made. This holds
  whether or not an account exists, and whether or not a server case store is
  reachable.
- The user chooses the folder and the file name.
- Program-filled cells stay program-filled after a later Open (§3.3).

### 2.2 Three platform paths, in priority order

1. **Desktop with a file-save dialog.** Use the File System Access API so the
   browser's own Save dialog appears and the user picks folder and name.
   Retain the chosen directory handle so a later Open starts in the same
   folder.
2. **Mobile.** No browser exposes a save dialog. Use the system **share
   sheet**, offering the case as a file, so the user can choose *Save to
   Files* (iOS) or *Files*/*Drive* (Android) and still pick the destination.
3. **Neither available** (e.g. Firefox, older Safari). Fall back to a
   download to wherever that browser files downloads. The case must still be
   saved; only the choice of location is lost.

Detect capability, never user-agent. Falling from 1 to 3 must be silent and
must not lose the case.

### 2.3 File name

Default to the case name, sanitised to a portable filename, with a `.json`
extension. The user may override it in the dialog.

---

## 3. Open

### 3.1 Input

- Desktop: the file picker, starting in the last-used directory where the
  platform allows it.
- Mobile: the system document picker.
- The file input accepts `.json,application/json`.

### 3.2 Restore order

Apply in an order that cannot be undone by the app's own reactivity:
selections (radios, selects) and `activeTab` before scalar inputs, grids
before any recalculation, and trigger at most one solve at the end. A restore
must not fire a solve per field.

### 3.3 Program-filled cells

Some grid cells are computed by the program and shown greyed rather than typed
by the analyst. The payload records which cells those are (`computed`). On
Open, those cells must be restored **as program-filled**, not as user input —
otherwise the next solve treats a derived value as a constraint and the case
silently changes meaning. This is the subtlest requirement here and the one
most worth a dedicated test.

### 3.4 Failure behaviour

Malformed JSON, a missing `case`, or a foreign `app` must leave the current
case untouched and report the reason. A half-applied case is worse than a
refused one.

---

## 4. The account-store gate

### 4.1 What exists

The server exposes: `accounts/status`, `auth/register`, `auth/login`,
`auth/logout`, `cases/save`, `cases/list`, `cases/load`, `cases/delete`.

### 4.2 Required behaviour

- The legacy account/case store is **off unless explicitly enabled** by the
  environment variable `WELLSIM_ENABLE_LEGACY_CASE_STORE` being exactly `1`.
  Absence, empty, `0`, `true`, or any other value means **off**.
- While off, `accounts/status` returns
  `{"enabled":false,"registrationEnabled":false,"mode":"legacy-web"}` and every
  other endpoint in §4.1 refuses with a stable machine-readable code and a
  message that points the user at Save as / Open.
- **Registration is never enabled merely because the store is enabled.** It
  requires a second, separate condition. Two independent switches, both of
  which must be on.
- The UI hides any sign-in affordance when `enabled` is false, and must not
  infer availability from anything other than `accounts/status`.

### 4.3 Why it is off (rationale, to prevent a well-meant "fix")

The company name chosen at registration is **not proof of membership of that
company**. With registration open, a stranger could register into an existing
company's namespace. Until identity is server-verified, the store stays shut.
Anyone re-enabling it must solve that first.

### 4.4 Visitor guarantee

Every calculation endpoint, the browser autosave, Save as and Open all work
with no account and no store. The gate must never touch them.

---

## 5. Acceptance criteria

The replacement is complete when all of these pass, written fresh:

1. **Round trip.** Build a non-trivial case across all three tabs, save,
   reset, open, solve — the operating point matches to full precision.
2. **Program-filled survives.** A case with program-filled grid cells opens
   with those cells still program-filled, and the next solve does not treat
   them as typed input.
3. **Grids survive.** Production data, sensitivity sets and multi-rate test
   tables restore with the same row and column counts and cell contents.
4. **Foreign file refused.** A JSON without the product's `app` marker is
   rejected, the current case is unchanged, and the message names the reason.
5. **Malformed file refused.** Truncated JSON leaves the app usable.
6. **No network on save.** Saving issues no request.
7. **Existing cases open.** Every file under `data/cases/` opens without
   error. These are real client cases and are the regression suite for the
   format.
8. **Gate closed by default.** With no environment variable set,
   `accounts/status` reports `enabled:false, registrationEnabled:false` and a
   `cases/save` attempt is refused.
9. **Gate needs both switches.** Enabling the store alone does not enable
   registration.
10. **Fallback path.** With the File System Access API absent, saving still
    produces the file.

## 6. Out of scope

The PostgreSQL tenancy foundation, per-tenant transactions and the v2 data
model were removed on 12 September 2026 and are **not** to be reimplemented.
The gate above is the whole of the account story until a server-verified
identity design exists.
