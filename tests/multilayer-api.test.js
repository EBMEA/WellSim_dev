// Multi-layer Darcy IPR through the API — oil and gas nodal solves with the
// optional layer block (core collapse itself is pinned in multilayer.test.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oilNodal, gasNodal, oilCalibrate, gasCalibrate, handlers } from '../src/server/api.js';

const OIL_BASE = {
  thpPsi: 700, qOilStbD: 2100, wcPct: 50, gorScfStb: 5000, tubingIdIn: 2.992,
  roughness: 0.00006, topPerfAhM: 2810, devStartM: 1910, devAngleDeg: 7,
  api: 46, gasSg: 0.842, rsiScfStb: 700, tresF: 201, oilViscCp: 6,
  waterSg: 1.05, soilTempF: 90, htcBtu: 3, tubingOdIn: 3.5, cpBtu: 0.51,
  priPsi: 3550, permMd: 50, thicknessFt: 42.653, reFt: 1640.5,
  rwFt: 0.5104166667, skin: 0, matchHead: 1, matchFriction: 1, liftType: 'natural',
};

const GAS_BASE = {
  thpPsi: 1625, qGasMMscfd: 14.137, cgrStbMMscf: 57.4358974, wgrStbMMscf: 3.8461538,
  tubingIdIn: 2.992, roughnessBase: 0.0021, topPerfAhM: 3013, devStartM: 690,
  devAngleDeg: 23.65, condApi: 48.7, gasSg: 0.763, n2Pct: 1.2, co2Pct: 3,
  h2sPpm: 2, tresF: 232, oilViscCp: 2, sigmaDyneCm: 30, soilTempF: 90,
  htcBtu: 3, tubingOdIn: 3.5, cpBtu: 0.51, priPsi: 3800, permMd: 5,
  thicknessFt: 80, reFt: 1640.5, rwFt: 0.5104166667, skin: 0,
  matchHead: 1, matchFriction: 1, iprMode: 'j',
};

// Zone Active box and Zone name (30 Sep 2026). An unticked zone leaves the
// composite entirely; a blank name falls back to L<row number> so the other
// names do not shift; a row without the field is active (older cases).
const OIL_3 = [
  { permMd: 50, thicknessFt: 42.653, skin: 0, prPsi: 3550, wcPct: 50, gorScfStb: 5000 },
  { permMd: 20, thicknessFt: 30, skin: 0, prPsi: 3000, wcPct: 60, gorScfStb: 4000 },
  { permMd: 35, thicknessFt: 25, skin: 0, prPsi: 3300, wcPct: 40, gorScfStb: 4500 },
];

test('an inactive zone leaves the oil composite entirely, and zone names label the layers', () => {
  const three = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: OIL_3 });
  assert.equal(three.error, undefined);
  assert.equal(three.multiLayer.layersAtOp.layers.length, 3);

  // switch the middle zone off: identical to never having typed it
  const middleOff = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: OIL_3.map((l, i) => (i === 1 ? { ...l, active: false } : l)) });
  const twoOnly = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: [OIL_3[0], OIL_3[2]] });
  assert.equal(middleOff.error, undefined);
  assert.equal(middleOff.multiLayer.layersAtOp.layers.length, 2);
  assert.equal(middleOff.multiLayer.prAvgPsi, twoOnly.multiLayer.prAvgPsi);
  assert.equal(middleOff.multiLayer.jFinal, twoOnly.multiLayer.jFinal);
  assert.equal(middleOff.op.qOilStbD, twoOnly.op.qOilStbD);
  // and the composite is not the 3-layer one
  assert.notEqual(middleOff.multiLayer.jFinal, three.multiLayer.jFinal);

  // fallback names are by ROW: the survivors are L1 and L3, not L1 and L2
  assert.deepEqual(middleOff.multiLayer.layersAtOp.layers.map((l) => l.name), ['Layer1', 'Layer3']);
  assert.deepEqual(middleOff.multiLayer.curves.layers.map((l) => l.name), ['Layer1', 'Layer3']);

  // a typed zone name labels the layer everywhere; the string form of the
  // box (a grid sends "false" as text on some paths) is honoured too
  const named = oilNodal({
    ...OIL_BASE, mlMode: 'multi',
    mlLayers: [{ ...OIL_3[0], name: 'Upper Sand' }, { ...OIL_3[1], active: 'false', name: 'Shale streak' }, { ...OIL_3[2], name: '  ' }],
  });
  assert.deepEqual(named.multiLayer.layersAtOp.layers.map((l) => l.name), ['Upper Sand', 'Layer3']);
  assert.deepEqual(named.multiLayer.curves.layers.map((l) => l.name), ['Upper Sand', 'Layer3']);

  // the rule counts ACTIVE zones: one left is not a multi-layer
  const oneLeft = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: OIL_3.map((l, i) => (i === 0 ? l : { ...l, active: false })) });
  assert.match(oneLeft.error, /at least 2 ACTIVE layers/);
});

test('the multi-layer K fit skips an inactive zone, and names its rows', () => {
  const r = oilCalibrate({
    ...OIL_BASE, mlMode: 'multi', testQOilStbD: 2100, testThpPsi: 700,
    mlLayers: OIL_3.map((l, i) => (i === 1 ? { ...l, active: false, name: 'off' } : { ...l, name: i === 0 ? 'A' : '' })),
  });
  assert.equal(r.error, undefined);
  // only rows 0 and 2 are fitted; row 1's K is never touched
  assert.deepEqual(r.mlFit.layers.map((l) => l.idx), [0, 2]);
  assert.deepEqual(r.mlFit.layers.map((l) => l.name), ['A', 'Layer3']);
  for (const l of r.mlFit.layers) assert.ok(Math.abs(l.kNew / l.kOld - r.mlFit.scale) < 1e-12);
});

test('an inactive zone leaves the gas composite entirely, exact collapse on the survivors', () => {
  const GAS_3 = [
    { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 57.4, wgrStbMMscf: 3.8 },
    { permMd: 3, thicknessFt: 50, skin: 0, prPsi: 3300, cgrStbMMscf: 40, wgrStbMMscf: 2 },
    { permMd: 4, thicknessFt: 60, skin: 0, prPsi: 3600, cgrStbMMscf: 50, wgrStbMMscf: 3 },
  ];
  const middleOff = gasNodal({ ...GAS_BASE, mlMode: 'multi', mlLayers: GAS_3.map((l, i) => (i === 1 ? { ...l, active: false, name: 'Tight zone' } : { ...l, name: i === 0 ? 'Main' : '' })) });
  const twoOnly = gasNodal({ ...GAS_BASE, mlMode: 'multi', mlLayers: [GAS_3[0], GAS_3[2]] });
  assert.equal(middleOff.error, undefined);
  assert.equal(middleOff.multiLayer.jFinal, twoOnly.multiLayer.jFinal);
  assert.equal(middleOff.op.qMMscfd, twoOnly.op.qMMscfd);
  assert.deepEqual(middleOff.multiLayer.layersAtOp.layers.map((l) => l.name), ['Main', 'Layer3']);
  const oneLeft = gasNodal({ ...GAS_BASE, mlMode: 'multi', mlLayers: GAS_3.map((l, i) => (i === 2 ? l : { ...l, active: false })) });
  assert.match(oneLeft.error, /at least 2 ACTIVE layers/);
});

// Which routes solve on the layers. Until 30 Sep 2026 only Solve well and
// Calibrate did; the ESP coupled solve, the gas-lift curve, the sensitivities
// and the head / ESP matches built their own single-layer IPR and ignored the
// block. The reserve and forecast routes still do, by design -- pinned here
// so that a change to either boundary is a deliberate one.
test('every WELL-MODEL route solves on the layers and honours an inactive zone; reserve and forecast stay single-layer', () => {
  const ESP = {
    liftType: 'esp', espPumpMode: 'db', espPumpName: 'ESP B 538-3600', espStages: 145, espFreqHz: 50,
    pumpAhM: 2985, espSepEffPct: 95, espMeasPintPsi: 1392, espMeasPdisPsi: 2720, prPsi: 3550,
  };
  const GL = { liftType: 'gaslift', injDepthTvdM: 2490.92, injRateMMscfd: 1.5 };
  const OIL_T = { ...OIL_BASE, testQOilStbD: 2100, testThpPsi: 700, testPwfPsi: 2647 };
  // the ESP routes need a pump that is not gas-locked at intake: on the natural
  // fixture (GOR 5000, WC 50) the theoretical dP is zero and the wear match
  // returns -Infinity in every mode, which says nothing about the layers
  const OIL_E = { ...OIL_T, thpPsi: 160, wcPct: 5, gorScfStb: 384, rsiScfStb: 384, api: 32, gasSg: 0.812, qOilStbD: 2565, testQOilStbD: 2565, testThpPsi: 160, testPwfPsi: '' };
  const OIL_3E = OIL_3.map((l, i) => ({ ...l, wcPct: 5, gorScfStb: 384, ...(i === 1 ? { active: false } : {}) }));
  const GAS_T = {
    ...GAS_BASE,
    testPoints: [{ thpPsi: 2440, qMMscfd: 5.192, pwfPsi: 2900 }, { thpPsi: 2000, qMMscfd: 10.002 }],
    vlpSets: [{ label: 'VLP1', thpPsi: 2440 }, { label: 'VLP2', thpPsi: 2000 }], presList: [3800, 3200],
    prodRows: [{ date: 0, thpPsi: 1625, qMMscfd: 14.137 }, { date: 60, thpPsi: 1625, qMMscfd: 13.2 }, { date: 120, thpPsi: 1625, qMMscfd: 12.4 }],
  };
  const GAS_3 = [
    { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 57.4, wgrStbMMscf: 3.8 },
    { permMd: 3, thicknessFt: 50, skin: 0, prPsi: 3300, cgrStbMMscf: 40, wgrStbMMscf: 2, active: false },
    { permMd: 4, thicknessFt: 60, skin: 0, prPsi: 3600, cgrStbMMscf: 50, wgrStbMMscf: 3 },
  ];
  const OIL_3I = OIL_3.map((l, i) => (i === 1 ? { ...l, active: false } : l));
  // a stable fingerprint of what each route answers
  const sig = (r) => JSON.stringify([
    // marchedPsi as well as matchHead: a head factor can pin to its 0.8 / 1.2
    // bound in both modes while the march underneath it moved with the blend
    r.error, r.op?.qOilStbD, r.op?.qMMscfd, r.matchHead, r.marchedPsi, r.stages, r.wearFactor, r.jMatched, r.pwfTargetPsi, r.sepEffPct, r.dpMeasPsi,
    r.cases?.length && r.cases.map((c) => c.op?.qOilStbD), r.vlpFamily?.length, r.iprFamily?.map((x) => x.j ?? x.prPsi),
    r.points?.map((p) => p.qOilStbD), r.optimum?.qOilStbD, r.fit?.giipBscf, r.rows?.[0]?.presPsi, r.eurMMstb, r.eurBscf,
  ]);
  const run = (route, base, Z3, extra = {}) => ({
    three: handlers[route]({ ...base, ...extra, mlMode: 'multi', mlLayers: Z3 }),
    two: handlers[route]({ ...base, ...extra, mlMode: 'multi', mlLayers: [Z3[0], Z3[2]] }),
    one: handlers[route]({ ...base, ...extra, mlMode: 'single' }),
  });

  const wellModel = [
    ['oil/esp', OIL_E, OIL_3E, ESP], ['oil/espwear', OIL_E, OIL_3E, ESP], ['oil/espsepeff', OIL_E, OIL_3E, ESP],
    ['oil/espsens', OIL_E, OIL_3E, ESP], ['oil/gaslift', OIL_T, OIL_3I, GL], ['oil/matchhead', OIL_T, OIL_3I],
    ['oil/sensitivity', { ...OIL_T, vlpSets: [{ label: 'VLP1', thpPsi: 700, gorScfStb: 5000, wcPct: 0, tubingIdIn: 2.992 }], presList: [3550, 3000] }, OIL_3I],
    ['gas/sensitivity', GAS_T, GAS_3], ['gas/matchhead', GAS_T, GAS_3],
  ];
  for (const [route, base, Z3, extra] of wellModel) {
    const { three, two, one } = run(route, base, Z3, extra);
    assert.equal(three.error, undefined, `${route}: ${three.error}`);
    assert.notEqual(sig(three), sig(one), `${route} must solve on the layers, not the single-layer IPR`);
    assert.equal(sig(three), sig(two), `${route} must leave an inactive zone out entirely`);
    assert.ok(three.multiLayer, `${route} must report the composite it solved on`);
  }
  // the ESP coupled solve ships its layers at the operating point, named
  const esp = run('oil/esp', OIL_E, OIL_3E, ESP).three;
  assert.deepEqual(esp.multiLayer.layersAtOp.layers.map((l) => l.name), ['Layer1', 'Layer3']);

  const singleByDesign = [
    ['oil/forecast', { ...OIL_T, fcMethod: 'tarner', prodRows: [{ date: '17-Nov-14', thpPsi: 700, qOilStbD: 2100, gorScfStb: 384, wcPct: 5 }, { date: '1-Dec-14', thpPsi: 500, qOilStbD: 1700, gorScfStb: 384, wcPct: 5 }, { date: '17-Dec-14', thpPsi: 300, qOilStbD: 1200, gorScfStb: 384, wcPct: 5 }] }, OIL_3I],
    ['gas/reserve', { ...GAS_T, presSource: 'prod' }, GAS_3], ['gas/forecast', GAS_T, GAS_3],
  ];
  for (const [route, base, Z3] of singleByDesign) {
    const { three, one } = run(route, base, Z3);
    assert.equal(sig(three), sig(one), `${route} is single-layer by design; if that changed, it was meant to`);
  }
});

// The UI defaults (30 Sep 2026): rows named Layer1..Layer4, only the first two
// ticked; a case saved before checkboxes were stored reopens with every
// complete row active; and the ESP catalogue view's IPR/VLP chart draws the
// zone curves, so its legend carries the names. app.js is not a module, so
// this reads the shipped source.
test('multi-layer UI defaults: Layer1..Layer4, first two active, names reach every IPR/VLP legend', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  for (const table of ['OIL_ML_ROWS', 'GAS_ML_ROWS']) {
    const block = src.match(new RegExp(`const ${table} = \\[([\\s\\S]*?)\\n\\];`))?.[1];
    assert.ok(block, `${table} defaults found`);
    const rows = block.split('\n').filter((l) => l.includes('name:'));
    assert.deepEqual(rows.map((l) => l.match(/name: '([^']+)'/)[1]), ['Layer1', 'Layer2', 'Layer3', 'Layer4'], table);
    assert.deepEqual(rows.map((l) => /active: true/.test(l)), [true, true, false, false], `${table}: only the first two active`);
  }
  // both nodal plots that can carry layers pass them to the legend
  assert.equal((src.match(/extra: mlLayerTraces\(r,/g) ?? []).length, 3, 'Solve well (oil), Solve well (gas) and the ESP view');
  // the trace name is the zone name
  assert.match(src, /name: `\$\{L\.name\} · Pr/);
  // old cases: every complete row comes back active
  assert.match(src, /if \(!c\.checks\) \{/);
  // a cleared name falls back to Layer<row>, server and UI alike
  const r = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: [{ ...OIL_3[0], name: '' }, OIL_3[1]] });
  assert.deepEqual(r.multiLayer.layersAtOp.layers.map((l) => l.name), ['Layer1', 'Layer2']);
});

test('oil nodal with 2 Darcy layers: PrAvg between layer Prs, layers sum to the op rate', () => {
  const r = oilNodal({
    ...OIL_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 50, thicknessFt: 42.653, skin: 0, prPsi: 3550, wcPct: 50, gorScfStb: 5000 },
      { permMd: 20, thicknessFt: 30, skin: 0, prPsi: 3000, wcPct: 60, gorScfStb: 4000 },
    ],
  });
  assert.ok(!r.error, r.error);
  assert.ok(r.multiLayer, 'multiLayer block expected');
  assert.ok(r.multiLayer.prAvgPsi > 3000 && r.multiLayer.prAvgPsi < 3550, `PrAvg=${r.multiLayer.prAvgPsi}`);
  assert.equal(r.computed.prPsi, r.multiLayer.prAvgPsi);
  assert.ok(r.multiLayer.blended.wcPct > 50 && r.multiLayer.blended.wcPct < 60);
  assert.equal(r.opStatus, 'ok');
  const t = r.multiLayer.layersAtOp.totals;
  // the equivalent J is matched at the solution point, so the layer sum at
  // the op Pwf tracks the equivalent-record rate within a few percent
  const qEq = r.op.qOilStbD;
  assert.ok(Math.abs(t.qOilStbD - qEq) / qEq < 0.1, `layers ${t.qOilStbD} vs op ${qEq}`);
  assert.equal(r.multiLayer.layersAtOp.layers.length, 2);
});

test('oil multi-layer needs at least 2 layers', () => {
  const r = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: [{ permMd: 50, thicknessFt: 40, prPsi: 3550 }] });
  assert.ok(/at least 2 ACTIVE layers/.test(r.error));
});

test('gas nodal with 2 Darcy layers: exact collapse — layers sum equals the op rate', () => {
  const r = gasNodal({
    ...GAS_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 57.4, wgrStbMMscf: 3.8 },
      { permMd: 3, thicknessFt: 50, skin: 0, prPsi: 3300, cgrStbMMscf: 40, wgrStbMMscf: 2 },
    ],
  });
  assert.ok(!r.error, r.error);
  assert.ok(r.multiLayer, 'multiLayer block expected');
  assert.ok(r.multiLayer.prAvgPsi > 3300 && r.multiLayer.prAvgPsi < 3800, `PrAvg=${r.multiLayer.prAvgPsi}`);
  assert.equal(r.opStatus, 'ok');
  const t = r.multiLayer.layersAtOp.totals;
  // gas J-form collapse is exact at EVERY Pwf
  const rel = Math.abs(t.qMMscfd - r.op.qMMscfd) / r.op.qMMscfd;
  assert.ok(rel < 1e-6, `layers ${t.qMMscfd} vs op ${r.op.qMMscfd} (rel ${rel})`);
  assert.ok(r.multiLayer.blended.cgrStbMMscf > 40 && r.multiLayer.blended.cgrStbMMscf < 57.4);
});

test('oil multi-layer fit to Jones: scaled layer Ks land the total J on the test J', () => {
  const layers = [
    { permMd: 50, thicknessFt: 42.653, skin: 0, prPsi: 3550, wcPct: 50, gorScfStb: 5000 },
    { permMd: 20, thicknessFt: 30, skin: 0, prPsi: 3000, wcPct: 60, gorScfStb: 4000 },
  ];
  const f = { ...OIL_BASE, mlMode: 'multi', mlLayers: layers, testQOilStbD: 2100, testThpPsi: 700 };
  const cal = oilCalibrate(f);
  assert.ok(!cal.error, cal.error);
  assert.ok(cal.mlFit, 'mlFit expected');
  assert.ok(cal.mlFit.scale > 0);
  assert.equal(cal.mlFit.layers.length, 2);
  // apply the solved Ks and re-solve: total J must equal the Jones J exactly
  const scaled = layers.map((l, i) => ({ ...l, permMd: cal.mlFit.layers[i].kNew }));
  const r = oilNodal({ ...OIL_BASE, mlMode: 'multi', mlLayers: scaled });
  assert.ok(!r.error, r.error);
  const rel = Math.abs(r.multiLayer.jFinal - cal.mlFit.jTestMl) / cal.mlFit.jTestMl;
  assert.ok(rel < 1e-6, `jFinal ${r.multiLayer.jFinal} vs jTestMl ${cal.mlFit.jTestMl} (rel ${rel})`);
  // PrAvg is scale-invariant
  assert.ok(Math.abs(r.multiLayer.prAvgPsi - cal.mlFit.prAvgPsi) < 1e-6);
});

test('gas multi-layer fit to the test J: exact by linearity', () => {
  const layers = [
    { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 57.4, wgrStbMMscf: 3.8 },
    { permMd: 3, thicknessFt: 50, skin: 0, prPsi: 3300, cgrStbMMscf: 40, wgrStbMMscf: 2 },
  ];
  const f = {
    ...GAS_BASE, mlMode: 'multi', mlLayers: layers,
    testPoints: [{ qMMscfd: 14.137, thpPsi: 1625 }],
  };
  const cal = gasCalibrate(f);
  assert.ok(!cal.error, cal.error);
  assert.ok(cal.mlFit, 'mlFit expected');
  const scaled = layers.map((l, i) => ({ ...l, permMd: cal.mlFit.layers[i].kNew }));
  const r = gasNodal({ ...GAS_BASE, mlMode: 'multi', mlLayers: scaled });
  assert.ok(!r.error, r.error);
  const rel = Math.abs(r.multiLayer.jFinal - cal.mlFit.jTestMl) / cal.mlFit.jTestMl;
  assert.ok(rel < 1e-9, `jFinal ${r.multiLayer.jFinal} vs jTestMl ${cal.mlFit.jTestMl} (rel ${rel})`);
});

test('gas C&n mode ignores the multi-layer block (no exact collapse)', () => {
  const r = gasNodal({
    ...GAS_BASE,
    iprMode: 'cn', cValue: 0.005, nValue: 0.9,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 5, thicknessFt: 80, prPsi: 3800 },
      { permMd: 3, thicknessFt: 50, prPsi: 3300 },
    ],
  });
  assert.ok(!r.error, r.error);
  assert.equal(r.multiLayer, null);
});

// ---- per-layer curves for the chart, and the crossflow flag ----
// Added 2 Sep 2026 with the per-layer IPR plot. The chart's "IPR" is the
// collapsed one-final-J equivalent, so the API also ships the TRUE commingled
// sum -- otherwise the layers visibly fail to add up to the curve beside them
// and it reads as a bug rather than as the equivalent's known drift.
test('oil nodal ships per-layer IPR curves that sum to the true composite', () => {
  const r = oilNodal({
    ...OIL_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 50, thicknessFt: 42.653, skin: 0, prPsi: 3550, wcPct: 50, gorScfStb: 5000 },
      { permMd: 20, thicknessFt: 30, skin: 0, prPsi: 3000, wcPct: 60, gorScfStb: 4000 },
    ],
  });
  assert.ok(!r.error, r.error);
  const c = r.multiLayer.curves;
  assert.ok(c, 'curves block expected');
  assert.equal(c.layers.length, 2);

  for (let i = 0; i < c.total.length; i++) {
    const summed = c.layers.reduce((a, L) => a + L.curve[i].qOilStbD, 0);
    assert.ok(
      Math.abs(summed - c.total[i].qOilStbD) < 1e-9,
      `at Pwf ${c.total[i].pwfPsi}: layers ${summed} vs total ${c.total[i].qOilStbD}`
    );
  }
  // the legend and the table both read these off the curve block
  for (const L of c.layers) {
    assert.ok(L.name, 'layer name');
    assert.ok(L.prPsi > 0 && L.j > 0, `Pr ${L.prPsi} J ${L.j}`);
  }
  // grid spans the highest layer Pr down to zero
  assert.equal(c.total[0].pwfPsi, 3550);
  assert.equal(c.total.at(-1).pwfPsi, 0);
});

test('a depleted layer below the operating Pwf is reported as taking fluid in', () => {
  // 1800 psi sits well under the ~2700 psi operating Pwf of this well, so the
  // layer must show NEGATIVE rate -- that sign is what the chart colours red
  // and the table highlights, so it is pinned here rather than left to the UI.
  const r = oilNodal({
    ...OIL_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 50, thicknessFt: 42.653, skin: 0, prPsi: 3550, wcPct: 50, gorScfStb: 5000 },
      { permMd: 20, thicknessFt: 30, skin: 0, prPsi: 1800, wcPct: 60, gorScfStb: 4000 },
    ],
  });
  assert.ok(!r.error, r.error);
  assert.equal(r.opStatus, 'ok');
  const weak = r.multiLayer.layersAtOp.layers[1];
  assert.ok(weak.qGrossStbD < 0, `depleted layer should take fluid in, got ${weak.qGrossStbD}`);
  assert.ok(
    r.multiLayer.layersAtOp.warnings.some((w) => /crossflow/i.test(w)),
    `expected a crossflow warning, got ${JSON.stringify(r.multiLayer.layersAtOp.warnings)}`
  );
  // and the producing layer must carry MORE than the well makes, because part
  // of it is going back down the hole
  const strong = r.multiLayer.layersAtOp.layers[0];
  assert.ok(
    strong.qGrossStbD > r.multiLayer.layersAtOp.totals.qGrossStbD,
    'producing layer must exceed the well total when another layer is thieving'
  );
});

test('gas nodal ships per-layer curves, and its exact collapse shows on the chart', () => {
  const r = gasNodal({
    ...GAS_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 60, wgrStbMMscf: 4 },
      { permMd: 3, thicknessFt: 40, skin: 0, prPsi: 3200, cgrStbMMscf: 10, wgrStbMMscf: 20 },
    ],
  });
  assert.ok(!r.error, r.error);
  const c = r.multiLayer.curves;
  assert.ok(c, 'curves block expected');
  assert.equal(c.layers.length, 2);
  for (let i = 0; i < c.total.length; i++) {
    const summed = c.layers.reduce((a, L) => a + L.curve[i].qMMscfd, 0);
    assert.ok(
      Math.abs(summed - c.total[i].qMMscfd) < 1e-12,
      `at Pwf ${c.total[i].pwfPsi}: layers ${summed} vs total ${c.total[i].qMMscfd}`
    );
  }
  for (const L of c.layers) assert.ok(L.name && L.prPsi > 0 && L.j > 0, JSON.stringify(L.name));
  assert.equal(c.total[0].pwfPsi, 3800);
});

test('gas: a depleted layer below the operating Pwf is reported as taking gas in', () => {
  const r = gasNodal({
    ...GAS_BASE,
    mlMode: 'multi',
    mlLayers: [
      { permMd: 5, thicknessFt: 80, skin: 0, prPsi: 3800, cgrStbMMscf: 60, wgrStbMMscf: 4 },
      { permMd: 3, thicknessFt: 40, skin: 0, prPsi: 1500, cgrStbMMscf: 10, wgrStbMMscf: 20 },
    ],
  });
  assert.ok(!r.error, r.error);
  assert.equal(r.opStatus, 'ok');
  const weak = r.multiLayer.layersAtOp.layers[1];
  assert.ok(weak.qMMscfd < 0, `depleted layer should take gas in, got ${weak.qMMscfd}`);
  assert.ok(r.multiLayer.layersAtOp.warnings.some((w) => /crossflow/i.test(w)), 'crossflow warning');
});
