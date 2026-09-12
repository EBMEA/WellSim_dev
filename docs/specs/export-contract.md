# Specification: the WellSim browser export contract (`WellSimExport`)

**Status:** normative. Written 12 September 2026 to support a clean
reimplementation of `src/ui/export.js`.

**This supersedes the export half of
`case-portability-and-account-gate.md`**, which described Save as / Open. That
was a mis-targeting: Save as / Open lives in `app.js` (`collectCase`) and is
*not* in scope. `export.js` is the **artifact contract** — a format registry
and file builder shared by the website and the portable exe.

The account-gate half of that document stands unchanged and is still the
specification for `src/server/accounts.js`.

## 1. Shape and placement

A dependency-free classic script (not an ES module) that installs exactly one
frozen global. It is loaded by `index.html`, embedded in the portable exe via
`sea-config.json`, and listed in the service-worker precache, so it must not
import anything and must work identically under Node (tests) and the browser.

```js
globalThis.WellSimExport = Object.freeze({
  contractVersion, caseSchemaId, workbookSchemaId, workbookCapability,
  formats, formatsFor, createArtifact, createWorkbookModel,
  safeBaseName, safeSheetName, spreadsheetSafe,
});
```

Constants are fixed by existing data and callers:

| | |
|---|---|
| `contractVersion` | `1` |
| `caseSchemaId` | `'wellsim.case.v1'` |
| `workbookSchemaId` | `'wellsim.case-workbook.v1'` |

The global and its `formats` array must be frozen.

## 2. The case object

Produced by `collectCase()` in `app.js`; this module only consumes it.

```
{ app, version, savedAt, activeTab,
  inputs:   { fieldId: string },
  computed: [ fieldId ],            // NOTE: an array of ids, not an object
  radios:   { groupName: value },
  selects:  { selectId: value },
  grids:    { gridId: [ { columnKey: string } ] } }
```

`createArtifact` and `createWorkbookModel` must reject a non-object case with
a `TypeError` naming the problem.

## 3. Formats

`formats` is a frozen array of two frozen descriptors; `formatsFor('case')`
returns them in this order:

| id | extension | mediaType | roundTrip |
|---|---|---|---|
| `case-json` | `json` | `application/vnd.wellsim.case+json` | **true** |
| `case-inputs-csv` | `csv` | `text/csv;charset=utf-8` | false |

`workbookCapability` is a declared-but-unimplemented capability describing an
Excel renderer that must run server-side:

```
id 'case-xlsx', extension 'xlsx', dataTypes ['case'], roundTrip false,
execution 'queued', modelSchemaId = workbookSchemaId
mediaType application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

**`case-json` is the only restorable format.** Everything else is one-way and
must say so in its own description, because a user who round-trips through CSV
loses the case.

## 4. `spreadsheetSafe(value)` — the security control

This is the reason this module exists in one place rather than per-caller. A
case field can contain anything a user typed, and a spreadsheet treats a
leading `=`, `+`, `-` or `@` as a formula. Opening an exported file must never
execute anything.

Required behaviour:

1. **Numeric strings become numbers.** `'-12.5'` → `-12.5` (number),
   `'700'` → `700`. A negative number must **not** be mangled into text; that
   is the trap this control usually falls into.
2. **Any other value whose first non-space character is `=`, `+`, `-` or `@`
   is returned as text prefixed with a single apostrophe**, which spreadsheets
   treat as a literal marker: `'=1+1'` → `"'=1+1"`, `'-cmd|calc'` →
   `"'-cmd|calc"`, `'@SUM(A1:A2)'` → `"'@SUM(A1:A2)"`.
3. **Leading whitespace is stripped before the test and not reinstated**:
   `'  +danger'` → `"'+danger"`. Otherwise the check is trivially bypassed.
4. Field **names and labels** go through the same control, not just values —
   a hostile field id is as dangerous as a hostile value.

## 5. `safeBaseName(value)` and `safeSheetName(value)`

`safeBaseName` produces a portable filename stem; `createArtifact` appends
`.<extension>` unless already present. Default stem `wellsim-case`.

`safeSheetName` obeys Excel's rules — at most 31 characters, and none of
`[ ] : * ? / \`. Invalid characters split the name into words, each word is
capitalised, and the words are joined with `-`: `'same/name'` and
`'same:name'` both become `'Same-Name'`. **Collisions are then disambiguated
by appending a space and an ordinal**, so those two grids yield `Same-Name`
and `Same-Name 2`. Excel silently refuses a workbook with duplicate sheet
names, so this is not cosmetic.

## 6. `createArtifact(caseData, formatId, options)`

`options`: `{ baseName, fieldMeta, gridMeta, generatedAt, title }`.
`fieldMeta[fieldId]` = `{ label, unit, section }`; `gridMeta[gridId][columnKey]`
= `{ label, unit, valueType }`. Both are advisory — every field must export
with or without metadata.

Returns a frozen object:

```
{ contractVersion, schemaId, formatId, filename, mediaType, content, roundTrip }
```

### 6.1 `case-json`

`content` is the case serialised as JSON, unchanged, such that
`JSON.parse(content)` deep-equals the input. This is the round-trip format and
must not be "cleaned", reordered or re-typed.

### 6.2 `case-inputs-csv`

- **UTF-8 BOM** (`﻿`) first, so Excel opens it as UTF-8.
- **CRLF** line endings.
- **Every cell quoted**, inner `"` doubled.
- Header, exactly:
  `"record_type","section","row","field","label","unit","value"`
- Row kinds, in this order: `input`, then `grid`, then `computed`.

| record_type | section | row | field | label | unit | value |
|---|---|---|---|---|---|---|
| `input` | `fieldMeta.section`, else the field id up to its first `-` | empty | field id | `fieldMeta.label`, else the field id | `fieldMeta.unit`, else empty | the value |
| `grid` | grid id | 1-based row number | column key | `gridMeta.label`, else the column key | `gridMeta.unit`, else empty | the cell |
| `computed` | as `input` | empty | field id | field id | empty | `calculated by WellSim` |

Computed fields export a **placeholder, never a number** — a derived value in
a spreadsheet invites someone to treat it as an input.

## 7. `createWorkbookModel(caseData, options)`

A renderer-agnostic description of a workbook — no XLSX is produced here.
Returns frozen `{ contractVersion, schemaId, workbookSchemaId, generatedAt,
title, sheets }`, sheets frozen, each `{ id, name, columns, rows }` with
`columns` = `{ key, label }` (label suffixed ` (unit)` when a unit is known).

Sheets: `summary`, `manifest`, `inputs`, then one `grid-<gridId>` per grid.

- **`inputs`** — one row per input, **sorted by field id**, as
  `[section, field, label, value]`. Label falls back to the field id with its
  first letter capitalised.
- **`grid-<id>`** — `[rowNumber, ...cells]`, row numbers 1-based.
- **`summary`** — human orientation; its last row must state that the JSON
  export is the restorable one.
- **`manifest`** — provenance, ending with exactly these four rows:
  `['round_trip','false']`, `['formula_policy','none']`,
  `['external_links','none']`, `['macros','none']`. These assert to a reviewer
  that the workbook carries no executable content.

Every cell passes through `spreadsheetSafe`.

## 8. Acceptance criteria

1. The global and `formats` are frozen; `formatsFor('case')` →
   `['case-json','case-inputs-csv']`; `case-json` has `roundTrip: true`.
2. `JSON.parse(createArtifact(c,'case-json').content)` deep-equals `c`.
3. Filenames: base `'Well A-12'` → `Well A-12.json`; `'Well A inputs'` →
   `Well A inputs.csv`.
4. CSV starts with BOM + the exact header + CRLF.
5. `'=1+1'`, `'-cmd|calc'`, `'@SUM(A1:A2)'`, `'  +danger'` all emerge
   apostrophe-prefixed; `'-12.5'` stays the number `-12.5`.
6. Two grids named `same/name` and `same:name` yield sheets `Same-Name` and
   `Same-Name 2`.
7. Computed fields appear as `calculated by WellSim`.
8. A non-object case throws `TypeError`.
9. Works unmodified under Node (no DOM, no imports) and in the browser.
10. All 81 real case files under `data/cases/` survive a `case-json` round
    trip byte-for-byte after `JSON.parse`.
