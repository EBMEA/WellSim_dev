// Contract tests for src/ui/export.js, written against
// docs/specs/export-contract.md. The module is a classic script that installs
// one global, so it is imported for its side effect and read off globalThis —
// the same way the browser and the portable exe load it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../src/ui/export.js');
const exporter = globalThis.WellSimExport;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CASE = {
  app: 'WellSim',
  version: 1,
  savedAt: '2026-09-02T00:00:00.000Z',
  activeTab: 'oil',
  inputs: { 'oil-thpPsi': '700', 'oil-note': 'normal text' },
  computed: ['oil-prPsi'],
  radios: { 'oil-lift': 'natural' },
  selects: { 'oil-pump': 'Demo pump' },
  grids: { oilProd: [{ date: '2026-09-01', rate: '2100' }] },
};

const FIELD_META = { 'oil-thpPsi': { label: 'FTHP', unit: 'psi', section: 'oil' } };
const GRID_META = { oilProd: { rate: { label: 'Oil rate', unit: 'STB/d', valueType: 'number' } } };

test('the contract is frozen and declares exactly the two case formats', () => {
  assert.equal(exporter.contractVersion, 1);
  assert.equal(exporter.caseSchemaId, 'wellsim.case.v1');
  assert.equal(exporter.workbookSchemaId, 'wellsim.case-workbook.v1');
  assert.deepEqual(exporter.formatsFor('case').map((f) => f.id), ['case-json', 'case-inputs-csv']);
  assert.equal(exporter.formats.find((f) => f.id === 'case-json').roundTrip, true);
  assert.equal(exporter.formats.find((f) => f.id === 'case-inputs-csv').roundTrip, false);
  assert.equal(exporter.workbookCapability.modelSchemaId, exporter.workbookSchemaId);
  assert.ok(Object.isFrozen(exporter));
  assert.ok(Object.isFrozen(exporter.formats));
});

test('JSON is the restorable format and survives a round trip untouched', () => {
  const artifact = exporter.createArtifact(CASE, 'case-json', { baseName: 'Well A-12' });
  assert.equal(artifact.filename, 'Well A-12.json');
  assert.equal(artifact.mediaType, 'application/vnd.wellsim.case+json');
  assert.equal(artifact.roundTrip, true);
  assert.deepEqual(JSON.parse(artifact.content), CASE);
  assert.ok(Object.isFrozen(artifact));
});

test('every real saved case round-trips through case-json', () => {
  const dir = path.join(root, 'data', 'cases');
  if (!fs.existsSync(dir)) return; // gitignored client data; absent on a clean clone
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => fs.readdirSync(path.join(dir, e.name)).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, e.name, f)));
  assert.ok(files.length > 0, 'expected saved cases to exercise the format against');
  for (const file of files) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const payload = saved.case ?? saved; // envelope or bare payload
    const back = JSON.parse(exporter.createArtifact(payload, 'case-json').content);
    assert.deepEqual(back, payload, `${path.basename(file)} did not round-trip`);
  }
});

test('CSV is BOM-prefixed, CRLF, fully quoted and labelled from metadata', () => {
  const artifact = exporter.createArtifact(CASE, 'case-inputs-csv', {
    baseName: 'Well A inputs',
    fieldMeta: FIELD_META,
    gridMeta: GRID_META,
  });
  assert.equal(artifact.filename, 'Well A inputs.csv');
  assert.equal(artifact.roundTrip, false);
  assert.ok(artifact.content.startsWith('﻿"record_type","section","row","field","label","unit","value"\r\n'));
  assert.match(artifact.content, /"input","oil","","oil-thpPsi","FTHP","psi","700"/);
  assert.match(artifact.content, /"grid","oilProd","1","rate","Oil rate","STB\/d","2100"/);
  assert.ok(artifact.content.endsWith('\r\n'));
});

test('computed fields export as a placeholder, never as a number', () => {
  const csv = exporter.createArtifact(CASE, 'case-inputs-csv', { fieldMeta: FIELD_META }).content;
  assert.match(csv, /"computed","oil","","oil-prPsi","oil-prPsi","","calculated by WellSim"/);
});

test('formula injection is neutralised without mangling negative numbers', () => {
  const hostile = {
    ...CASE,
    computed: [],
    inputs: {
      formula: '=1+1',
      command: '-cmd|calc',
      mention: '@SUM(A1:A2)',
      leading: '  +danger',
      negative: '-12.5',
      plain: 'normal text',
    },
    grids: {},
  };
  const csv = exporter.createArtifact(hostile, 'case-inputs-csv').content;
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"'-cmd\|calc"/);
  assert.match(csv, /"'@SUM\(A1:A2\)"/);
  assert.match(csv, /"'\+danger"/); // leading whitespace stripped before the test
  assert.match(csv, /"-12\.5"/); // still a number, not text
  assert.doesNotMatch(csv, /"'-12\.5"/);
  assert.match(csv, /"normal text"/);

  // the primitive itself
  assert.equal(exporter.spreadsheetSafe('-12.5'), -12.5);
  assert.equal(exporter.spreadsheetSafe('700'), 700);
  assert.equal(exporter.spreadsheetSafe('=cmd'), "'=cmd");
  assert.equal(exporter.spreadsheetSafe('  +x'), "'+x");
  assert.equal(exporter.spreadsheetSafe(null), '');
});

test('quotes inside values are doubled, not dropped', () => {
  const csv = exporter.createArtifact({ ...CASE, computed: [], grids: {}, inputs: { q: 'say "hi"' } }, 'case-inputs-csv').content;
  assert.match(csv, /"say ""hi"""/);
});

test('workbook model is versioned, sorted, and ends with the no-executable-content manifest', () => {
  const model = exporter.createWorkbookModel(CASE, {
    generatedAt: '2026-09-02T01:00:00.000Z',
    deploymentRevision: 'test-revision',
    sourceChecksum: 'abc123',
    fieldMeta: FIELD_META,
    gridMeta: GRID_META,
  });
  assert.equal(model.workbookSchemaId, 'wellsim.case-workbook.v1');

  const inputs = model.sheets.find((s) => s.id === 'inputs');
  assert.deepEqual(inputs.rows.map((r) => r[1]), ['oil-note', 'oil-thpPsi']); // sorted by field id
  assert.equal(inputs.rows[1][2], 'FTHP');
  assert.equal(inputs.rows[1][3], 700); // numeric, not the string '700'

  const grid = model.sheets.find((s) => s.id === 'grid-oilProd');
  assert.equal(grid.columns[2].label, 'Oil rate (STB/d)');
  assert.deepEqual(grid.rows, [[1, '2026-09-01', 2100]]);

  assert.match(model.sheets.find((s) => s.id === 'summary').rows.at(-1)[1], /use the WellSim JSON export/);
  assert.deepEqual(model.sheets.find((s) => s.id === 'manifest').rows.slice(-4), [
    ['round_trip', 'false'],
    ['formula_policy', 'none'],
    ['external_links', 'none'],
    ['macros', 'none'],
  ]);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.sheets));
});

test('sheet names are Excel-legal and collisions are disambiguated', () => {
  const model = exporter.createWorkbookModel(
    { ...CASE, inputs: { '=formula': '=1+1' }, computed: [], radios: {}, selects: {},
      grids: { 'same/name': [{ value: '+danger' }], 'same:name': [{ value: '-12.5' }] } },
    { generatedAt: '2026-09-02T01:00:00.000Z' },
  );
  assert.deepEqual(model.sheets.filter((s) => s.id.startsWith('grid-')).map((s) => s.name), ['Same-Name', 'Same-Name 2']);
  assert.deepEqual(model.sheets.find((s) => s.id === 'inputs').rows[0].slice(1, 4), ["'=formula", "'=Formula", "'=1+1"]);
  assert.equal(model.sheets.find((s) => s.id === 'grid-same/name').rows[0][1], "'+danger");
  assert.equal(model.sheets.find((s) => s.id === 'grid-same:name').rows[0][1], -12.5);
  assert.ok(model.sheets.every((s) => s.name.length <= 31 && !/[[\]:*?/\\]/.test(s.name)));
});

test('a non-case and an unknown format are both refused', () => {
  assert.throws(() => exporter.createArtifact(null, 'case-json'), TypeError);
  assert.throws(() => exporter.createArtifact([], 'case-json'), TypeError);
  assert.throws(() => exporter.createArtifact(CASE, 'case-pdf'), /unknown export format/);
  assert.throws(() => exporter.createWorkbookModel('nope'), TypeError);
});

test('filenames are portable and keep an extension they already have', () => {
  assert.equal(exporter.safeBaseName('a/b:c*d?e'), 'a b c d e');
  assert.equal(exporter.safeBaseName(''), 'wellsim-case');
  assert.equal(exporter.createArtifact(CASE, 'case-json', { baseName: 'x.json' }).filename, 'x.json');
  assert.equal(exporter.createArtifact(CASE, 'case-json').filename, 'wellsim-case.json');
});
