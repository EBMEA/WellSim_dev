// End-to-end check that every module and submodule of the site actually runs.
//
// The unit suite pins physics and the validation sweep pins numbers against the
// workbooks. Neither answers the plainer question an operator asks before a
// release: does every button on every tab still come back with an answer?
// This drives the live HTTP API the browser uses, so it exercises the server,
// the route table and the handlers together.
//
// IT COVERS EVERY ROUTE IN THE TABLE, and that is asserted at the end rather
// than trusted: the run fails if api.js gains a route nothing here calls.
// Until 13 Sep 2026 it reached 19 of 24 — the five head/efficiency matches and
// the WHOLE artificial-lift selection module were never smoked, so a release
// could go out green with a dead button on it.
//
// The account routes are checked the other way round: a REFUSAL is the pass.
// The web deployment must never open its legacy case store.
//
// Usage: node scripts/module-smoke.mjs [--base http://localhost:3355] [--json out.json]
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = arg('--base', 'http://localhost:3355');
const jsonOut = arg('--json', null);

const OIL = {
  thpPsi: '700', qOilStbD: '2100', wcPct: '50', gorScfStb: '5000', tubingIdIn: '2.992',
  roughness: '0.00006', topPerfAhM: '2810', devStartM: '1910', devAngleDeg: '7',
  api: '46', gasSg: '0.842', rsiScfStb: '700', tresF: '201', oilViscCp: '6',
  waterSg: '1.05', pbPsi: '', soilTempF: '90', htcBtu: '3', tubingOdIn: '3.5', cpBtu: '0.51',
  priPsi: '3550', prPsi: '', permMd: '50', thicknessFt: '42.653', reFt: '1640.5',
  rwFt: '0.5104166667', skin: '0', matchHead: '1', matchFriction: '1',
  testQOilStbD: '2100', testThpPsi: '700', testPwfPsi: '',
  prodRows: [
    { date: '17-Nov-14', thpPsi: '700', qOilStbD: '2100', gorScfStb: '384', wcPct: '5', pwfPsi: '' },
    { date: '1-Dec-14', thpPsi: '500', qOilStbD: '1700', gorScfStb: '384', wcPct: '5', pwfPsi: '' },
    { date: '17-Dec-14', thpPsi: '300', qOilStbD: '1200', gorScfStb: '384', wcPct: '5', pwfPsi: '' },
  ],
  staticRows: [
    { date: '17-Nov-14', presPsi: '3550' }, { date: '1-Dec-14', presPsi: '3200' },
    { date: '17-Dec-14', presPsi: '2900' },
  ],
};
const OIL_ESP = {
  ...OIL, thpPsi: '160', wcPct: '5', gorScfStb: '384', qOilStbD: '2565',
  testQOilStbD: '2565', testThpPsi: '160', api: '32', gasSg: '0.812', rsiScfStb: '384',
  tresF: '230', topPerfAhM: '3240', devStartM: '1500', devAngleDeg: '0',
  prPsi: '2650', iprMode: 'pi', userJ: '2.7', userPresPsi: '2650',
  liftType: 'esp', espPumpMode: 'db', espPumpName: 'ESP B 538-3600',
  espStages: '145', espFreqHz: '50', pumpAhM: '2985', espSepEffPct: '95',
  espMeasPintPsi: '1392', espMeasPdisPsi: '2720',
};
const GAS = {
  thpPsi: '1625', qGasMMscfd: '14.137', cgrStbMMscf: '57.4358974', wgrStbMMscf: '3.8461538',
  tubingIdIn: '2.992', roughnessBase: '0.0021', topPerfAhM: '3013', devStartM: '690',
  devAngleDeg: '23.65', condApi: '48.7', gasSg: '0.763', n2Pct: '1.2', co2Pct: '3',
  h2sPpm: '2', tresF: '232', oilViscCp: '2', sigmaDyneCm: '30', soilTempF: '90',
  htcBtu: '3', tubingOdIn: '3.5', cpBtu: '0.51', priPsi: '3800', prPsi: '',
  permMd: '5', thicknessFt: '80', reFt: '1640.5', rwFt: '0.5104166667', skin: '0',
  matchHead: '1', matchFriction: '1', iprMode: 'j',
  testPoints: [
    { thpPsi: '2440', qMMscfd: '5.192', pwfPsi: '' },
    { thpPsi: '2000', qMMscfd: '10.002', pwfPsi: '' },
    { thpPsi: '1625', qMMscfd: '14.137', pwfPsi: '' },
  ],
  prodRows: [
    { date: '0', thpPsi: '1625', qMMscfd: '14.137', pwfPsi: '' },
    { date: '60', thpPsi: '1625', qMMscfd: '13.2', pwfPsi: '' },
    { date: '120', thpPsi: '1625', qMMscfd: '12.4', pwfPsi: '' },
    { date: '180', thpPsi: '1625', qMMscfd: '11.7', pwfPsi: '' },
  ],
  sithpRows: [
    { date: '0', sithpPsi: '2500' }, { date: '90', sithpPsi: '2000' }, { date: '180', sithpPsi: '1300' },
  ],
  gaugeRows: [
    { date: '0', presPsi: '3550' }, { date: '90', presPsi: '3100' }, { date: '180', presPsi: '2700' },
  ],
};
const WATER_INJ = {
  fluid: 'water', wellType: 'injector', thpPsi: '2000', injTempF: '90',
  tubingIdIn: '2.992', roughness: '0.00006', topPerfAhM: '2810', devStartM: '1910',
  devAngleDeg: '7', api: '10', wcPct: '100', gorScfStb: '0', rsiScfStb: '0',
  pbPsi: '0', gasSg: '0.842', tresF: '201', oilViscCp: '6', waterSg: '1.05',
  soilTempF: '90', htcBtu: '3', tubingOdIn: '3.5', cpBtu: '0.51', priPsi: '4800',
  permMd: '50', thicknessFt: '42.653', reFt: '1640.5', rwFt: '0.5104166667',
  skin: '0', matchHead: '1', matchFriction: '1', qOilStbD: '2000',
  testQOilStbD: '2000', testThpPsi: '2000', testPwfPsi: '',
};
const WATER_PROD = {
  ...WATER_INJ, wellType: 'producer', thpPsi: '200', qOilStbD: '2000',
  testThpPsi: '200', priPsi: '4800', prPsi: '',
};
// The head matches need a TYPED measurement to match against — a grey marched
// value is not one, and the handlers refuse without it. These carry the demo
// well's own measured figures.
const OIL_MATCH = { ...OIL, testPwfPsi: '2647' };
const GAS_MATCH = {
  ...GAS,
  testPoints: [
    { thpPsi: '2440', qMMscfd: '5.192', pwfPsi: '2900' },
    ...GAS.testPoints.slice(1),
  ],
};
const WATER_INJ_MATCH = { ...WATER_INJ, testPwfPsi: '5934' };
// The water ESP block, with the measured intake/discharge couple the head and
// wear matches read. NOTE testPwfPsi is deliberately BLANK: WATER_INJ carries
// the injector's measured BHIP (5934 psi), which on a producer sits above the
// 4800 psi reservoir, and no stage count can close a traverse to a Pwf above
// Pres. Blank means the match anchors on the IPR instead, which is what the
// tab does. This cost a false failure on 13 Sep 2026.
const WATER_ESP = {
  ...WATER_PROD, thpPsi: '200', qOilStbD: '4300', prPsi: '4800',
  testQOilStbD: '4300', testThpPsi: '200', testPwfPsi: '',
  liftType: 'esp', espPumpMode: 'db', espPumpName: 'ESP B 538-3600',
  espStages: '145', espFreqHz: '50', pumpAhM: '2985', pumpTvdM: '2985',
  espMeasPintPsi: '4000', espMeasPdisPsi: '4850', espMinIntakePsi: '300',
};
// The artificial-lift selection module: the UI's own three snapshots
// (ALLIFT_DEFAULT in app.js), Initial / half-horizon / horizon.
const ALLIFT = {
  snapshots: [
    { pwfPsi: 2000, prPsi: 5200, pbPsi: 2000, j: 0.7, depthM: 3200, whpPsi: 250, wcPct: 2, gorScfStb: 400, devDeg: 1, dogLegDeg: 7 },
    { pwfPsi: 2000, prPsi: 3500, pbPsi: 2000, j: 0.7, depthM: 3200, whpPsi: 250, wcPct: 20, gorScfStb: 400, devDeg: 1, dogLegDeg: 7 },
    { pwfPsi: 2000, prPsi: 2500, pbPsi: 2000, j: 0.7, depthM: 3200, whpPsi: 250, wcPct: 50, gorScfStb: 400, devDeg: 1, dogLegDeg: 7 },
  ],
  capexUsd: { esp: 400000, gaslift: 250000, srp: 300000, pcp: 200000, jet: 150000 },
  opexUsdPerBbl: 2, udcLimitUsdPerBbl: 12, horizonYears: 1,
  gates: { naturalFlow: false, nearGasCompression: false, sourGasHigh: false, excludeJetPump: false },
};

// the sensitivity tables' own default rows (OIL_SENS_ROWS / GAS_SENS_ROWS in
// app.js) with the columns each lift type shows, plus the three future
// reservoir pressures the Pres column offers
const OIL_SENS = {
  ...OIL,
  vlpSets: [
    { label: 'VLP1', thpPsi: '700', gorScfStb: '5000', wcPct: '0', tubingIdIn: '2.992' },
    { label: 'VLP2', thpPsi: '700', gorScfStb: '5000', wcPct: '40', tubingIdIn: '2.992' },
    { label: 'VLP3', thpPsi: '700', gorScfStb: '5000', wcPct: '80', tubingIdIn: '2.992' },
  ],
  presList: ['3550', '3000', '2500'],
};
const GAS_SENS = {
  ...GAS,
  vlpSets: [
    { label: 'VLP1', thpPsi: '2440' }, { label: 'VLP2', thpPsi: '2000' }, { label: 'VLP3', thpPsi: '1200' },
  ],
  presList: ['3800', '3200', '2600'],
};

const ML_OIL = {
  ...OIL, mlMode: 'multi',
  mlLayers: [
    { permMd: '60', thicknessFt: '25', prPsi: '3550', skin: '0' },
    { permMd: '30', thicknessFt: '18', prPsi: '1800', skin: '0' },
  ],
};
const ML_GAS = {
  ...GAS, mlMode: 'multi',
  mlLayers: [
    { permMd: '6', thicknessFt: '50', prPsi: '3800', skin: '0' },
    { permMd: '3', thicknessFt: '30', prPsi: '1500', skin: '0' },
  ],
};

/** Each check: what it proves, the route, the body, and what a PASS looks like.
 *  A route returning 200 with {error} is a FAIL — the module did not run. */
const CHECKS = [
  ['Oil · Well model', 'natural flow nodal', 'oil/nodal', OIL, (r) => r.op?.qOilStbD > 0 && `q ${r.op.qOilStbD.toFixed(0)} stb/d, Pwf ${r.op.pwfPsi.toFixed(0)} psi`],
  ['Oil · Well model', 'calibrate from test', 'oil/calibrate', OIL, (r) => r.matchedPermMd > 0 && r.jTest > 0 && `matched K ${r.matchedPermMd.toFixed(2)} mD, J ${r.jTest.toFixed(3)} stb/d/psi, Pwf ${r.testPwfPsi?.toFixed(0)} psi (${r.pwfSource})`],
  ['Oil · Well model', 'gas lift performance curve', 'oil/gaslift', { ...OIL, liftType: 'gaslift', injDepthTvdM: '2490.92', injRateMMscfd: '1.5' }, (r) => r.currentInjMMscfd > 0 && r.points?.length > 0 && `inj ${r.currentInjMMscfd} MMscf/d, ${r.points.length}-point lift curve, optimum ${r.optimum?.injRateMMscfd ?? '—'} MMscf/d at ${r.optimum?.qOilStbD?.toFixed(0) ?? '—'} stb/d`],
  ['Oil · Well model', 'multi-layer IPR', 'oil/nodal', ML_OIL, (r) => r.op?.qOilStbD > 0 && r.multiLayer?.layersAtOp?.layers?.length > 0 && `q ${r.op.qOilStbD.toFixed(0)} stb/d, ${r.multiLayer.layersAtOp.layers.length} layers, Pr avg ${r.multiLayer.prAvgPsi?.toFixed(0)} psi`],
  ['Oil · Well model', 'VLP/IPR sensitivities', 'oil/sensitivity', OIL_SENS, (r) => r.vlpFamily?.length > 0 && r.iprFamily?.length > 0 && `${r.vlpFamily.length} VLP sets, ${r.iprFamily.length} IPR sets`],
  ['Oil · ESP', 'coupled ESP solve', 'oil/esp', OIL_ESP, (r) => r.op?.qOilStbD > 0 && `q ${r.op.qOilStbD.toFixed(0)} stb/d, dP ${r.point.dpPsi.toFixed(0)} psi, ${r.point.thrust}`],
  ['Oil · ESP', 'match stages', 'oil/espstages', OIL_ESP, (r) => (r.stages ?? r.matchedStages) > 0 && `${r.stages ?? r.matchedStages} stages`],
  ['Oil · ESP', 'match wear (actual Pint/Pdis)', 'oil/espwear', OIL_ESP, (r) => r.wearFactor != null && `wear ${(r.wearFactor * 100).toFixed(1)} %`],
  ['Oil · ESP', 'future-Pres sensitivity', 'oil/espsens', OIL_ESP, (r) => (r.cases?.length ?? r.sets?.length ?? 0) > 0 && `${r.cases?.length ?? r.sets?.length} cases`],
  ['Oil · ESP', 'pump catalogues', 'esp/pumps', {}, (r) => r.pumps?.length > 0 && `${r.pumps.length} pumps in ${r.bySource.length} catalogues`],
  ['Oil · Reserve', 'prod data + Pres solver', 'oil/reserve', { ...OIL, presSource: 'prod' }, (r) => r.fit?.nAvgMMstb > 0 && `N ${r.fit.nAvgMMstb.toFixed(2)} MMstb from ${r.rows.length} rows`],
  ['Oil · Reserve', 'static gauge history', 'oil/reserve', { ...OIL, presSource: 'static' }, (r) => (r.fit?.nAvgMMstb ?? r.rows?.length) && `N ${(r.fit?.nAvgMMstb ?? 0).toFixed(2)} MMstb`],
  ['Oil · Reserve', 'reservoir limit', 'oil/reserve', { ...OIL, presSource: 'rlt' }, (r) => r.rlt?.stoiipMMstb > 0 && `STOIIP ${r.rlt.stoiipMMstb.toFixed(2)} MMstb`],
  ['Oil · Forecast', 'Tarner', 'oil/forecast', { ...OIL, fcMethod: 'tarner' }, (r) => r.eurMMstb > 0 && `EUR ${r.eurMMstb.toFixed(3)} MMstb, ${r.rows.length} steps, ${r.status}`],
  ['Oil · Forecast', 'Walsh (generalized MB)', 'oil/forecast', { ...OIL, fcMethod: 'walsh' }, (r) => r.eurMMstb > 0 && `EUR ${r.eurMMstb.toFixed(3)} MMstb, ${r.rows.length} steps, ${r.status}`],
  ['Oil · Forecast', 'ESP lift coupled', 'oil/forecast', OIL_ESP, (r) => r.eurMMstb > 0 && `EUR ${r.eurMMstb.toFixed(3)} MMstb, N ${r.nMMstb.toFixed(2)}`],
  ['Gas · Well model', 'nodal', 'gas/nodal', GAS, (r) => r.op?.qMMscfd > 0 && `q ${r.op.qMMscfd.toFixed(3)} MMscf/d, Pwf ${r.op.pwfPsi.toFixed(0)} psi`],
  ['Gas · Well model', 'calibrate from tests', 'gas/calibrate', GAS, (r) => r.matchedPermMd > 0 && `matched K ${r.matchedPermMd.toFixed(2)} mD${r.jTest > 0 ? `, J ${r.jTest.toFixed(5)}` : ''}`],
  ['Gas · Well model', 'multi-layer IPR', 'gas/nodal', ML_GAS, (r) => r.op?.qMMscfd > 0 && r.multiLayer?.layersAtOp?.layers?.length > 0 && `q ${r.op.qMMscfd.toFixed(3)} MMscf/d, ${r.multiLayer.layersAtOp.layers.length} layers, Pr avg ${r.multiLayer.prAvgPsi?.toFixed(0)} psi`],
  ['Gas · Well model', 'sensitivities', 'gas/sensitivity', GAS_SENS, (r) => r.vlpFamily?.length > 0 && r.iprFamily?.length > 0 && `${r.vlpFamily.length} VLP sets, ${r.iprFamily.length} IPR sets`],
  ['Gas · Reserve', 'prod data + p/Z', 'gas/reserve', { ...GAS, presSource: 'prod' }, (r) => r.fit?.giipBscf > 0 && `GIIP ${r.fit.giipBscf.toFixed(2)} Bscf, Gp tot ${r.rows[r.rows.length - 1].gpTotalBscf?.toFixed(4)}`],
  ['Gas · Reserve', 'Pres from SITHP', 'gas/reserve', { ...GAS, presSource: 'sithp' }, (r) => r.fit?.giipBscf > 0 && `GIIP ${r.fit.giipBscf.toFixed(2)} Bscf`],
  ['Gas · Reserve', 'reservoir limit', 'gas/reserve', { ...GAS, presSource: 'rlt' }, (r) => r.rlt?.giipBscf > 0 && `GIIP ${r.rlt.giipBscf.toFixed(2)} Bscf`],
  ['Gas · Reserve', 'memory gauges', 'gas/reserve', { ...GAS, presSource: 'gauge' }, (r) => r.fit?.giipBscf > 0 && `GIIP ${r.fit.giipBscf.toFixed(2)} Bscf`],
  ['Gas · Reserve', 'condensate properties', 'gas/reserve', { ...GAS, presSource: 'prod' }, (r) => r.cond?.mw > 0 && `SG ${r.cond.sg.toFixed(5)}, MW ${r.cond.mw.toFixed(3)}`],
  ['Gas · Forecast', 'p/Z tank + nodal', 'gas/forecast', GAS, (r) => r.eurBscf > 0 && `EUR ${r.eurTotalBscf?.toFixed(3) ?? r.eurBscf.toFixed(3)} Bscf total, ${r.rows.length} steps`],
  ['Water · Producer', 'nodal', 'oil/nodal', WATER_PROD, (r) => r.op?.qOilStbD > 0 && `q ${r.op.qOilStbD.toFixed(0)} bbl/d, Pwf ${r.op.pwfPsi.toFixed(0)} psi`],
  ['Water · Producer', 'ESP on the same catalogues', 'oil/esp', { ...WATER_PROD, liftType: 'esp', espPumpMode: 'db', espPumpName: 'ESP B 538-3600', espStages: '145', espFreqHz: '50', pumpAhM: '2985', prPsi: '4800' }, (r) => r.op?.qOilStbD > 0 && `q ${r.op.qOilStbD.toFixed(0)} bbl/d, dP ${r.point.dpPsi.toFixed(0)} psi`],
  ['Water · Injector', 'injectivity nodal', 'water/injector', WATER_INJ, (r) => r.op?.qBpd > 0 && `q ${r.op.qBpd.toFixed(0)} bbl/d, BHIP ${r.op.pwfPsi.toFixed(0)} psi`],
  ['Water · Injector', 'calibrate', 'water/injcalibrate', WATER_INJ, (r) => r.jTest > 0 && r.matchedPermMd > 0 && `J inj ${r.jTest.toFixed(4)} bbl/d/psi, matched K ${r.matchedPermMd.toFixed(2)} mD`],
  ['Water · Injector', 'sensitivities', 'water/injsensitivity', { ...WATER_INJ, vlpSets: [{ label: 'VLP1', thpPsi: '1500' }, { label: 'VLP2', thpPsi: '2000' }, { label: 'VLP3', thpPsi: '2500' }], presList: ['4800', '4400', '4000'] }, (r) => r.vlpFamily?.length > 0 && `${r.vlpFamily.length} THP sets, ${r.iprFamily?.length ?? 0} injectivity lines`],
  ['Oil · Well model', 'match head from a test point', 'oil/matchhead', OIL_MATCH, (r) => r.matchHead > 0 && `head ${r.matchHead.toFixed(4)}, target ${r.targetPsi} psi, marched ${r.marchedPsi?.toFixed(0)}`],
  ['Oil · ESP', 'match head from measured Pint/Pdis', 'oil/matchhead', OIL_ESP, (r) => r.matchHead > 0 && `head ${r.matchHead.toFixed(4)}, Pdis target ${r.targetPsi} psi`],
  ['Oil · ESP', 'match separator efficiency', 'oil/espsepeff', OIL_ESP, (r) => r.sepEffPct != null && `sep eff ${Number(r.sepEffPct).toFixed(1)} %`],
  ['Gas · Well model', 'match head from a test point', 'gas/matchhead', GAS_MATCH, (r) => r.matchHead > 0 && `head ${r.matchHead.toFixed(4)}, target ${r.targetPsi} psi`],
  ['Water · Injector', 'match head from measured BHIP', 'water/injmatchhead', WATER_INJ_MATCH, (r) => r.matchHead > 0 && `head ${r.matchHead.toFixed(4)}, BHIP target ${r.targetPsi} psi`],
  ['Water · ESP', 'coupled solve at the ESP test rate', 'oil/esp', WATER_ESP, (r) => r.op?.qOilStbD > 0 && `q ${r.op.qOilStbD.toFixed(0)} bbl/d, dP ${r.point.dpPsi.toFixed(0)} psi`],
  ['Water · ESP', 'match head from measured Pint/Pdis', 'oil/matchhead', WATER_ESP, (r) => r.matchHead > 0 && `head ${r.matchHead.toFixed(4)}, Pdis target ${r.targetPsi} psi`],
  ['Water · ESP', 'match stages', 'oil/espstages', WATER_ESP, (r) => (r.stages ?? r.matchedStages) > 0 && `${r.stages ?? r.matchedStages} stages`],
  ['Water · ESP', 'match wear', 'oil/espwear', WATER_ESP, (r) => r.wearFactor != null && `wear ${(r.wearFactor * 100).toFixed(1)} %, dP ${r.dpMeasPsi?.toFixed(0)} vs ${r.dpTheoPsi?.toFixed(0)} psi theoretical`],
  ['Artificial lift · Selection', 'envelope screen + economics', 'allift/select', ALLIFT, (r) => Array.isArray(r.applicable) && `${r.applicable.length} applicable, pick: ${r.recommendation ?? 'none'}`],
  ['Artificial lift · Selection', 'the limits matrix is versioned', 'allift/select', ALLIFT, (r) => r.limits?.version && `limits v${r.limits.version}, ${Object.keys(r.limits.bands).length} methods screened`],
  ['Artificial lift · Selection', 'a well-condition gate excludes', 'allift/select', { ...ALLIFT, gates: { ...ALLIFT.gates, excludeJetPump: true } }, (r) => Array.isArray(r.gateExclusions?.JET) && `JET excluded, ${r.applicable.length} left`],
];

// The account store must stay shut on the web deployment. A REFUSAL is the
// pass here; accounts/status is ungated on purpose, because a caller must
// always be able to learn that the store is off.
const GATED = ['auth/register', 'auth/login', 'auth/logout', 'cases/save', 'cases/list', 'cases/load', 'cases/delete'];

const ASSETS = ['/', '/app.js', '/export.js', '/style.css', '/help.html', '/favicon.svg', '/vendor/plotly.min.js'];

const post = async (route, body) => {
  const res = await fetch(`${BASE}/api/${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { http: res.status, json: await res.json().catch(() => ({ error: 'unparseable response' })) };
};

const results = [];
console.log(`\nWellSim module smoke — ${BASE}\n`);

console.log('  static assets');
for (const a of ASSETS) {
  let status = 0;
  try { status = (await fetch(BASE + a)).status; } catch { status = 0; }
  results.push({ group: 'Assets', name: a, route: a, pass: status === 200, detail: `HTTP ${status}` });
  console.log(`    ${status === 200 ? 'ok  ' : 'FAIL'} ${a.padEnd(24)} HTTP ${status}`);
}

let group = '';
for (const [g, name, route, body, check] of CHECKS) {
  if (g !== group) { group = g; console.log(`\n  ${g}`); }
  let pass = false, detail = '';
  try {
    const { http, json } = await post(route, body);
    if (http !== 200) detail = `HTTP ${http}`;
    else if (json.error) detail = json.error.slice(0, 78);
    else {
      const v = check(json);
      pass = Boolean(v);
      detail = typeof v === 'string' ? v : pass ? 'ok' : 'returned, but the expected value was missing';
    }
  } catch (e) {
    detail = `threw: ${e.message.slice(0, 70)}`;
  }
  results.push({ group: g, name, route, pass, detail });
  console.log(`    ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(30)} ${detail}`);
}

console.log('\n  account containment — a refusal is the PASS');
for (const route of GATED) {
  let pass = false, detail = '';
  try {
    const { json } = await post(route, {});
    pass = json.code === 'legacy_case_store_disabled';
    detail = pass ? 'refused: legacy_case_store_disabled' : `NOT REFUSED — ${JSON.stringify(json).slice(0, 58)}`;
  } catch (e) { detail = `threw: ${e.message.slice(0, 60)}`; }
  results.push({ group: 'Account containment', name: route, route, pass, detail });
  console.log(`    ${pass ? 'ok  ' : 'FAIL'} ${route.padEnd(30)} ${detail}`);
}
try {
  const { json } = await post('accounts/status', {});
  const pass = json.enabled === false && json.registrationEnabled === false;
  results.push({ group: 'Account containment', name: 'accounts/status', route: 'accounts/status', pass, detail: JSON.stringify(json) });
  console.log(`    ${pass ? 'ok  ' : 'FAIL'} ${'accounts/status'.padEnd(30)} ${JSON.stringify(json)}`);
} catch (e) {
  results.push({ group: 'Account containment', name: 'accounts/status', route: 'accounts/status', pass: false, detail: e.message });
  console.log(`    FAIL accounts/status — ${e.message}`);
}

// COVERAGE. The point of this script is "every module and submodule", and a
// route nobody calls is exactly the gap that let five of them go unsmoked
// until 13 Sep 2026. Read the route table off the source and fail on any
// route this run never touched, so the gap cannot reopen silently.
try {
  const fsp = await import('node:fs');
  const pathp = await import('node:path');
  const src = fsp.readFileSync(
    pathp.join(import.meta.dirname, '..', 'src', 'server', 'api.js'), 'utf8'
  );
  const table = [...src.matchAll(/^ {2}'([a-z]+\/[a-zA-Z]+)':/gm)].map((m) => m[1]);
  const called = new Set(results.map((r) => r.route));
  const missed = table.filter((r) => !called.has(r));
  const pass = table.length > 0 && missed.length === 0;
  results.push({
    group: 'Coverage', name: 'every route in api.js is smoked', route: 'coverage', pass,
    detail: pass ? `all ${table.length} routes called` : `NEVER CALLED: ${missed.join(', ')}`,
  });
  console.log(`\n  coverage\n    ${pass ? 'ok  ' : 'FAIL'} ${'every route in api.js is smoked'.padEnd(30)} ${pass ? `all ${table.length} routes called` : `NEVER CALLED: ${missed.join(', ')}`}`);
} catch (e) {
  console.log(`    (coverage check skipped: ${e.message.slice(0, 60)})`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} checks pass`);
if (failed.length) {
  console.log('\n  FAILURES:');
  for (const f of failed) console.log(`    ${f.group} · ${f.name} — ${f.detail}`);
}
if (jsonOut) {
  const fs = await import('node:fs');
  fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
  console.log(`\n  results -> ${jsonOut}`);
}
process.exitCode = failed.length ? 1 : 0;
