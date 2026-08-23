/* Linework test suite.
 *
 *   node tests/run.js
 *
 * Serves the app on a local port, drives it in headless Chromium and checks the
 * geometry pipeline against fixtures whose dimensions are known exactly: the
 * scale is 3000 mm per 100 units, so 30 mm/unit, and every length asserted
 * below is arithmetic rather than an observation of what the code happens to
 * produce.
 *
 * Regenerate the fixtures with:
 *   python3 tests/fixtures.py tests/test1.pdf tests/test2.pdf
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript',
                '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

let fails = 0;
function ck(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} = ${JSON.stringify(got)}` +
    (ok ? '' : `  want ${JSON.stringify(want)}`));
}
function near(name, got, want, tol) {
  const ok = typeof got === 'number' && Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} = ${got} (want ${want}±${tol})`);
}

function serve() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(f, (e, data) => {
        if (e) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

async function load(browser, base, pdf) {
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('  [pageerror]', e.message); fails++; });
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.setInputFiles('#file', path.join(__dirname, pdf));
  await page.waitForFunction(() => window.SHEETS && window.SHEETS.length > 0, { timeout: 30000 });
  return page;
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME });

  /* ---- 1. plain sheet: read, bind, measure, clash ---------------------- */
  console.log('\n== fixture 1: linework, binding, measurement, clash ==');
  let page = await load(browser, base, 'test1.pdf');
  let r = await page.evaluate(() => {
    const S = SHEETS[0], m = {};
    S.services.forEach(s => m[s.sys] = {
      bound: !!s.line, id: s.line ? s.line.id : null, mm: runLengthMm(S, s), w: s.w, h: s.h });
    return { family: S.family, cal: S.cal && +S.cal.mmPerUnit.toFixed(2),
      total: S.geom.total, bound: S.geom.bound, svc: m,
      gx: S.findings.filter(f => /^GX/.test(f.code)).map(f => ({ c: f.code, sev: f.sev, at: f.at })),
      gxBox: (S.findings.filter(f => f.code === 'GX-01')[0] || {}).boxes,
      gxRect: (S.findings.filter(f => f.code === 'GX-01')[0] || {}).rect };
  });
  ck('family', r.family, 'CSD');
  near('scale mm/unit', r.cal, 30, 0.01);
  ck('polylines read', r.total, 16);          // 3 runs + frame + 12 hatch ticks
  ck('labels bound to a run', r.bound, 3);
  ck('runs are distinct polylines',
    new Set([r.svc.SM_SED.id, r.svc.VE_EAD.id, r.svc.CHWS.id]).size, 3);
  near('SM_SED length mm', r.svc.SM_SED.mm, 12000, 1);   // 400 units x 30
  near('VE_EAD length mm', r.svc.VE_EAD.mm, 10200, 1);   // 340 units x 30
  near('CHWS length mm', r.svc.CHWS.mm, 6000, 1);        // 200 units x 30
  ck('duct height survives binding', [r.svc.SM_SED.w, r.svc.SM_SED.h], [900, 700]);
  ck('one hard clash', r.gx.filter(f => f.c === 'GX-01').length, 1);
  ck('clash severity', r.gx[0] && r.gx[0].sev, 'E');
  ck('clash grid reference', r.gx[0] && r.gx[0].at, 'DX2 / DY2');
  /* The crossing is at (300,600) in PDF user space; the viewer boxes it there. */
  ck('clash carries one box for the viewer', r.gxBox && r.gxBox.length, 1);
  ck('box sits on the crossing', r.gxRect &&
    [r.gxRect.bx0, r.gxRect.by0, r.gxRect.bx1, r.gxRect.by1], [286, 586, 314, 614]);

  /* ---- 2. the sheet viewer can locate the clash ------------------------ */
  console.log('\n== on-sheet viewer ==');
  const vw = await page.evaluate(() => {
    const S = SHEETS[0];
    const located = locatedOnSheet(S);
    const gx = S.findings.findIndex(f => f.code === 'GX-01');
    return { located: located.length > 0, clashLocated: located.indexOf(gx) >= 0,
             hasPdf: !!S.pdf };
  });
  ck('the sheet keeps its pdf for the viewer', vw.hasPdf, true);
  ck('findings are locatable on the sheet', vw.located, true);
  ck('the clash is one of them', vw.clashLocated, true);
  await page.close();

  /* ---- 3. CTM and form XObject ----------------------------------------- */
  console.log('\n== fixture 2: CTM scale + form XObject /Matrix ==');
  page = await load(browser, base, 'test2.pdf');
  r = await page.evaluate(() => {
    const S = SHEETS[0], m = {};
    S.services.forEach(s => m[s.sys] = { mm: runLengthMm(S, s),
      bbox: s.line ? [Math.round(s.line.x0), Math.round(s.line.y0),
                      Math.round(s.line.x1), Math.round(s.line.y1)] : null });
    return { dwg: S.dwg, svc: m,
      gx: S.findings.filter(f => f.code === 'GX-01').map(f => f.at) };
  });
  ck('drawing number', r.dwg, 'OVNC-ME-CSD-202');
  ck('CTM-scaled run in user space', r.svc.SM_SED.bbox, [100, 400, 500, 400]);
  ck('XObject run in user space', r.svc.VE_EAD.bbox, [300, 300, 300, 700]);
  near('SM_SED length mm', r.svc.SM_SED.mm, 12000, 1);
  near('VE_EAD length mm', r.svc.VE_EAD.mm, 12000, 1);
  ck('clash found through both transforms', r.gx, ['DX2 / DY1']);
  await page.close();

  /* ---- 4. data drawer, including a sheet with no linework ------------- */
  console.log('\n== data drawer ==');
  page = await browser.newPage();
  page.on('pageerror', e => { console.log('  [pageerror]', e.message); fails++; });
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const d = await page.evaluate(() => {
    const bare = { family: 'CSD', page: 1, label: 'ZONE 1', blocks: 5,
      services: [{ sys: 'CHWS', dia: 100, ref: 'BOD', datum: 'RFL', elev: 2500 }],
      pipes: [], tags: [], findings: [], geom: null, cal: null };
    const withGeom = JSON.parse(JSON.stringify(bare));
    withGeom.cal = { mmPerUnit: 30 };
    withGeom.services[0].line = { id: 0, len: 200 };
    const head = dataDrawer(bare).querySelectorAll('th');
    return {
      cols: head.length,
      lastCol: head[head.length - 1].textContent,
      bareLen: dataDrawer(bare).querySelectorAll('tbody td')[5].textContent,
      geomLen: dataDrawer(withGeom).querySelectorAll('tbody td')[5].textContent
    };
  });
  ck('drawer carries the length column', d.cols, 6);
  ck('length column is labelled', /mm/.test(d.lastCol), true);
  ck('unbound run shows no length', d.bareLen, '\u2014');
  ck('bound run shows its measured length', d.geomLen, '6,000');

  /* ---- 5. electrical containment vocabulary ---------------------------
     The strings below are copied verbatim from a real lighting shop drawing
     (OVNC-MP-E-LT-005/006/007), which read as zero labels before this. */
  console.log('\n== electrical containment ==');
  const el = await page.evaluate(() => {
    const mk = lines => ({ lines: lines, text: lines.join('\n'), flat: lines.join(' '),
      x: 100, y: 100, a0: 0, a1: 60, am: 30, c: 100, h: 8, b: 0 });
    const blocks = [
      mk(['CABLE RACK 200x100-H.D.G', 'BOC=1FL+2200']),
      mk(['TRUNKING 100x100-H.D.G', 'BOT=2FL+3000']),
      mk(['CABLE FOR EXTERIOR LIGHTING', 'IN HDPE D30']),
      mk(['PVC PIPE \u00d820']),
      mk(['STEEL BOX 100x100x50', 'GALVANIZED'])       // a box, not a run
    ];
    const S = extractCSD(blocks, 1, isFS(blocks));
    return {
      isFS: isFS(blocks),
      svc: S.services.map(s => ({ sys: s.sys, w: s.w, h: s.h, dia: s.dia,
                                  mat: s.mat || null, ref: s.ref, elev: s.elev })),
      dwg: extractCSD([mk(['OVNC-MP-E-LT-005'])], 1, false).dwg
    };
  });
  const bySys = {};
  el.svc.forEach(s => bySys[s.sys] = s);
  ck('lighting sheet is recognised as FS', el.isFS, true);
  ck('cable rack read with its size', bySys['CABLE RACK'] &&
    [bySys['CABLE RACK'].w, bySys['CABLE RACK'].h], [200, 100]);
  ck('hot-dip galvanized kept as the finish', bySys['CABLE RACK'] &&
    bySys['CABLE RACK'].mat, 'HDG');
  ck('cable rack level paired from the line below', bySys['CABLE RACK'] &&
    [bySys['CABLE RACK'].ref, bySys['CABLE RACK'].elev], ['BOC', 2200]);
  ck('trunking read with its level', bySys['TRUNKING'] &&
    [bySys['TRUNKING'].w, bySys['TRUNKING'].h, bySys['TRUNKING'].elev], [100, 100, 3000]);
  ck('bare-D conduit read', bySys['HDPE'] && bySys['HDPE'].dia, 30);
  ck('diameter-sign conduit read', bySys['PVC'] && bySys['PVC'].dia, 20);
  ck('a junction box is not a run', el.svc.some(s => s.w === 100 && s.h === 100 &&
    s.sys !== 'TRUNKING'), false);
  ck('drawing number reads outside the CSD series', el.dwg, 'OVNC-MP-E-LT-005');

  await browser.close();
  server.close();
  console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
  process.exit(fails ? 1 : 0);
})();
