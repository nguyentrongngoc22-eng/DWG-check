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
      clashPts: (S.clashPts || []).length };
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
  ck('clash point recorded for the preview', r.clashPts, 1);

  /* ---- 2. the preview actually draws ----------------------------------- */
  console.log('\n== preview canvas ==');
  await page.click('details.data summary');
  await page.waitForTimeout(400);
  const cv = await page.evaluate(() => {
    const c = document.querySelector('canvas.geo');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 240 || d[i+1] < 240 || d[i+2] < 240) ink++;
    return { w: c.width, ink };
  });
  ck('canvas present', !!cv, true);
  ck('canvas has linework drawn on it', !!(cv && cv.ink > 1000), true);
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

  /* ---- 4. drawer variants, including sheets with no geometry ----------- */
  console.log('\n== drawer variants ==');
  page = await browser.newPage();
  page.on('pageerror', e => { console.log('  [pageerror]', e.message); fails++; });
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const d = await page.evaluate(() => {
    const mp = { family: 'MP', page: 1, label: 'SECTION A', dwg: 'X', blocks: 9,
      pipes: [{ sys: 'WW', mat: 'UPVC', dn: 110, view: 'A' }], valves: [], elevs: [],
      services: [], tags: [], slopes: [], findings: [], cal: { mmPerUnit: 30 },
      geom: { total: 1, bound: 0, span: 100,
        lines: [{ id: 0, pts: [[0,0],[100,0]], len: 100, x0:0, y0:0, x1:100, y1:0 }] } };
    const bare = { family: 'CSD', page: 1, label: 'ZONE 1', blocks: 5,
      services: [], pipes: [], tags: [], findings: [], geom: null };
    return {
      mpCanvas: !!dataDrawer(mp).querySelector('canvas.geo'),
      mpLegend: !!dataDrawer(mp).querySelector('.geo-key'),
      bareSaysSo: !!dataDrawer(bare).querySelector('.geo-empty'),
      bareNoCanvas: !!dataDrawer(bare).querySelector('canvas.geo')
    };
  });
  ck('MP drawer carries the preview', d.mpCanvas, true);
  ck('MP drawer carries the legend', d.mpLegend, true);
  ck('sheet without linework says so', d.bareSaysSo, true);
  ck('sheet without linework draws nothing', d.bareNoCanvas, false);

  await browser.close();
  server.close();
  console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
  process.exit(fails ? 1 : 0);
})();
