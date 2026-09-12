/* WellSim browser export contract.
 *
 * One frozen global, no imports, no DOM: the website, the portable exe and the
 * Node test runner all load this same file. Written to
 * docs/specs/export-contract.md — read that before changing any behaviour
 * here, because the CSV column order and the formula-neutralising rules are
 * relied on outside this file.
 */
(function installWellSimExport(root) {
  'use strict';

  const CONTRACT_VERSION = 1;
  const CASE_SCHEMA_ID = 'wellsim.case.v1';
  const WORKBOOK_SCHEMA_ID = 'wellsim.case-workbook.v1';
  const COMPUTED_PLACEHOLDER = 'calculated by WellSim';

  // Declared, deliberately not implemented here: rendering real XLSX needs a
  // zip writer and belongs server-side. createWorkbookModel produces the
  // renderer's input, so the capability can be advertised honestly meanwhile.
  const WORKBOOK_CAPABILITY = Object.freeze({
    id: 'case-xlsx',
    label: 'Case workbook for Excel',
    extension: 'xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dataTypes: Object.freeze(['case']),
    roundTrip: false,
    execution: 'queued',
    modelSchemaId: WORKBOOK_SCHEMA_ID,
    description:
      'Inputs, selections, tabular data and provenance as a reviewable workbook. Rendered on the server; not produced in the browser.',
  });

  const FORMATS = Object.freeze([
    Object.freeze({
      id: 'case-json',
      label: 'WellSim case file (JSON)',
      extension: 'json',
      mediaType: 'application/vnd.wellsim.case+json',
      dataTypes: Object.freeze(['case']),
      roundTrip: true,
      description: 'The whole case, exactly as it stands. This is the file WellSim can open again.',
    }),
    Object.freeze({
      id: 'case-inputs-csv',
      label: 'Inputs as a spreadsheet (CSV)',
      extension: 'csv',
      mediaType: 'text/csv;charset=utf-8',
      dataTypes: Object.freeze(['case']),
      roundTrip: false,
      description:
        'Inputs and production rows for a spreadsheet. One-way: a CSV cannot be opened back into WellSim.',
    }),
  ]);

  const formatsById = new Map(FORMATS.map((format) => [format.id, format]));

  function formatsFor(dataType) {
    return FORMATS.filter((format) => format.dataTypes.includes(dataType));
  }

  function assertCase(caseData) {
    if (!caseData || typeof caseData !== 'object' || Array.isArray(caseData)) {
      throw new TypeError('export requires a WellSim case object');
    }
    return caseData;
  }

  /* ---------------------------------------------------------------- safety */

  // A spreadsheet reads a leading = + - or @ as a formula, so an exported case
  // could execute on open. Neutralise by prefixing an apostrophe, which every
  // spreadsheet treats as "this is literal text".
  //
  // The trap this usually falls into is mangling negative numbers: '-12.5'
  // starts with '-' but must stay the NUMBER -12.5, or every negative skin,
  // depth or pressure in the case becomes text. So numbers are recognised
  // first and returned as numbers.
  const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  const FORMULA_LEAD = /^[=+\-@]/;

  function spreadsheetSafe(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const text = String(value).replace(/^\s+/, '');
    if (text === '') return '';
    if (NUMERIC.test(text)) return Number(text);
    return FORMULA_LEAD.test(text) ? `'${text}` : text;
  }

  /* -------------------------------------------------------------- filenames */

  function safeBaseName(value) {
    const stem = String(value ?? '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/, '');
    return stem === '' ? 'wellsim-case' : stem.slice(0, 120);
  }

  function withExtension(baseName, extension) {
    const stem = safeBaseName(baseName);
    return stem.toLowerCase().endsWith(`.${extension}`) ? stem : `${stem}.${extension}`;
  }

  // Excel refuses []:*?/\ and anything over 31 characters, and silently
  // refuses a workbook containing two sheets with the same name — hence the
  // ordinal suffix in uniqueSheetName below.
  function safeSheetName(value) {
    const words = String(value ?? '')
      .split(/[[\]:*?/\\\s_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    const name = words.join('-');
    return (name === '' ? 'Sheet' : name).slice(0, 31);
  }

  function uniqueSheetName(name, taken) {
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
    for (let n = 2; ; n += 1) {
      const suffix = ` ${n}`;
      const candidate = `${name.slice(0, 31 - suffix.length)}${suffix}`;
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
  }

  /* ------------------------------------------------------------- metadata */

  // Section falls back to the field id's prefix, because ids are written
  // 'oil-thpPsi' / 'gas-fthpPsi' and that prefix is the tab it belongs to.
  function sectionOf(fieldId, fieldMeta) {
    const declared = fieldMeta?.[fieldId]?.section;
    if (declared) return declared;
    const dash = String(fieldId).indexOf('-');
    return dash > 0 ? String(fieldId).slice(0, dash) : String(fieldId);
  }

  function labelOf(fieldId, fieldMeta) {
    const declared = fieldMeta?.[fieldId]?.label;
    if (declared) return declared;
    const id = String(fieldId);
    const first = id.search(/[a-z]/i);
    return first < 0 ? id : id.slice(0, first) + id.charAt(first).toUpperCase() + id.slice(first + 1);
  }

  const unitOf = (fieldId, fieldMeta) => fieldMeta?.[fieldId]?.unit ?? '';

  function columnsOf(gridId, rows, gridMeta) {
    const keys = [];
    for (const row of rows) for (const key of Object.keys(row ?? {})) if (!keys.includes(key)) keys.push(key);
    return keys.map((key) => {
      const meta = gridMeta?.[gridId]?.[key];
      const label = meta?.label ?? key;
      return Object.freeze({ key, label: meta?.unit ? `${label} (${meta.unit})` : label });
    });
  }

  const gridsOf = (caseData) =>
    Object.entries(caseData.grids ?? {}).map(([id, rows]) => [id, Array.isArray(rows) ? rows : []]);

  /* ------------------------------------------------------------------ CSV */

  const csvCell = (value) => `"${String(spreadsheetSafe(value)).replace(/"/g, '""')}"`;
  const csvRow = (cells) => cells.map(csvCell).join(',');

  const CSV_HEADER = ['record_type', 'section', 'row', 'field', 'label', 'unit', 'value'];

  function caseCsv(caseData, { fieldMeta = {}, gridMeta = {} } = {}) {
    const lines = [CSV_HEADER.map((h) => `"${h}"`).join(',')];

    for (const [fieldId, value] of Object.entries(caseData.inputs ?? {})) {
      lines.push(
        csvRow(['input', sectionOf(fieldId, fieldMeta), '', fieldId, labelOf(fieldId, fieldMeta), unitOf(fieldId, fieldMeta), value]),
      );
    }

    for (const [gridId, rows] of gridsOf(caseData)) {
      const columns = columnsOf(gridId, rows, gridMeta);
      rows.forEach((row, index) => {
        for (const column of columns) {
          const meta = gridMeta?.[gridId]?.[column.key];
          lines.push(
            csvRow(['grid', gridId, index + 1, column.key, meta?.label ?? column.key, meta?.unit ?? '', row?.[column.key] ?? '']),
          );
        }
      });
    }

    // Derived values export as a placeholder, never a number: a computed cell
    // sitting in a spreadsheet invites someone to treat it as an input.
    for (const fieldId of caseData.computed ?? []) {
      lines.push(csvRow(['computed', sectionOf(fieldId, fieldMeta), '', fieldId, fieldId, '', COMPUTED_PLACEHOLDER]));
    }

    // BOM so Excel reads it as UTF-8; CRLF because RFC 4180 says so and Excel
    // is fussier about it than most readers.
    return `﻿${lines.join('\r\n')}\r\n`;
  }

  /* ------------------------------------------------------------- workbook */

  function caseWorkbookModel(caseData, options = {}) {
    assertCase(caseData);
    const { fieldMeta = {}, gridMeta = {}, deploymentRevision = '', sourceChecksum = '' } = options;
    const generatedAt = spreadsheetSafe(options.generatedAt ?? new Date().toISOString());
    const title = spreadsheetSafe(options.title ?? 'WellSim engineering case export');

    const sheet = (id, name, columns, rows) =>
      Object.freeze({
        id,
        name,
        columns: Object.freeze(columns.map((c) => Object.freeze({ ...c }))),
        rows: Object.freeze(rows.map((r) => Object.freeze([...r]))),
      });

    const sheets = [];
    const taken = new Set();

    sheets.push(
      sheet('summary', uniqueSheetName('Summary', taken), [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Value' }], [
        ['Title', title],
        ['Generated at', generatedAt],
        ['Active tab', spreadsheetSafe(caseData.activeTab ?? '')],
        ['Case version', spreadsheetSafe(caseData.version ?? '')],
        ['Inputs', Object.keys(caseData.inputs ?? {}).length],
        ['Grids', gridsOf(caseData).length],
        // Last row, and it must stay last: the one thing a recipient needs to
        // know is that this workbook cannot be loaded back.
        ['Round trip', 'This workbook is a report, not a case — to reopen this well in WellSim, use the WellSim JSON export instead.'],
      ]),
    );

    sheets.push(
      sheet('manifest', uniqueSheetName('Manifest', taken), [{ key: 'key', label: 'Key' }, { key: 'value', label: 'Value' }], [
        ['contract_version', String(CONTRACT_VERSION)],
        ['case_schema', CASE_SCHEMA_ID],
        ['workbook_schema', WORKBOOK_SCHEMA_ID],
        ['generated_at', generatedAt],
        ['deployment_revision', spreadsheetSafe(deploymentRevision)],
        ['source_checksum', spreadsheetSafe(sourceChecksum)],
        // These four are an assertion to whoever reviews the file that it
        // carries nothing executable. Keep them last and keep them exact.
        ['round_trip', 'false'],
        ['formula_policy', 'none'],
        ['external_links', 'none'],
        ['macros', 'none'],
      ]),
    );

    const inputRows = Object.keys(caseData.inputs ?? {})
      .sort()
      .map((fieldId) => [
        spreadsheetSafe(sectionOf(fieldId, fieldMeta)),
        spreadsheetSafe(fieldId),
        spreadsheetSafe(labelOf(fieldId, fieldMeta)),
        spreadsheetSafe(caseData.inputs[fieldId]),
      ]);
    sheets.push(
      sheet(
        'inputs',
        uniqueSheetName('Inputs', taken),
        [
          { key: 'section', label: 'Section' },
          { key: 'field', label: 'Field' },
          { key: 'label', label: 'Label' },
          { key: 'value', label: 'Value' },
        ],
        inputRows,
      ),
    );

    for (const [gridId, rows] of gridsOf(caseData)) {
      const columns = columnsOf(gridId, rows, gridMeta);
      sheets.push(
        sheet(
          `grid-${gridId}`,
          uniqueSheetName(safeSheetName(gridId), taken),
          [{ key: 'row', label: 'Row' }, ...columns],
          rows.map((row, index) => [index + 1, ...columns.map((c) => spreadsheetSafe(row?.[c.key]))]),
        ),
      );
    }

    return Object.freeze({
      contractVersion: CONTRACT_VERSION,
      schemaId: CASE_SCHEMA_ID,
      workbookSchemaId: WORKBOOK_SCHEMA_ID,
      generatedAt,
      title,
      sheets: Object.freeze(sheets),
    });
  }

  /* ------------------------------------------------------------- artifacts */

  function createArtifact(caseData, formatId, options = {}) {
    assertCase(caseData);
    const format = formatsById.get(formatId);
    if (!format) throw new TypeError(`unknown export format: ${String(formatId)}`);

    // case-json is the restorable format, so the case is serialised verbatim:
    // no reordering, no coercion, no "tidying". Anything else would make the
    // round trip lossy in a way nobody would notice until a case came back
    // wrong.
    const content = format.id === 'case-json' ? JSON.stringify(caseData, null, 2) : caseCsv(caseData, options);

    return Object.freeze({
      contractVersion: CONTRACT_VERSION,
      schemaId: CASE_SCHEMA_ID,
      formatId: format.id,
      filename: withExtension(options.baseName ?? 'wellsim-case', format.extension),
      mediaType: format.mediaType,
      content,
      roundTrip: format.roundTrip,
    });
  }

  root.WellSimExport = Object.freeze({
    contractVersion: CONTRACT_VERSION,
    caseSchemaId: CASE_SCHEMA_ID,
    workbookSchemaId: WORKBOOK_SCHEMA_ID,
    workbookCapability: WORKBOOK_CAPABILITY,
    formats: FORMATS,
    formatsFor,
    createArtifact,
    createWorkbookModel: caseWorkbookModel,
    safeBaseName,
    safeSheetName,
    spreadsheetSafe,
  });
})(globalThis);
