// Built-UI integration check with synthetic provider geometry, NOT evidence of live routing.
// Install Playwright separately, then set PLAYWRIGHT_MODULE to its index.mjs.
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createApp({ apiKey: '' });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const home = [-95.397052, 29.684561], other = [-95.3, 29.77];
const address = '2250 Holly Hall St, Houston, TX 77054';
const params = ([lng, lat]) => new URLSearchParams({ lat: String(lat), lng: String(lng), addr: lng === home[0] ? address : 'Second Houston test point', all: '1' }).toString();
const haversine = (a,b) => {
  const r=Math.PI/180, dLat=(b[1]-a[1])*r, dLon=(b[0]-a[0])*r;
  return 6371008.8*2*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2));
};
const fixture = ([a,b]) => {
  const pts = [a,[a[0],b[1]],b];
  return { coordinates:pts, distanceM:haversine(pts[0],pts[1])+haversine(pts[1],pts[2]) };
};
const errors=[];
async function context() {
  const c=await browser.newContext();
  // External tiles/geocoding are outside this integration check.
  await c.route('https://**/*', r => r.abort());
  const p=await c.newPage();
  p.setDefaultTimeout(10_000);
  p.on('pageerror',e => errors.push(e.message));
  return [c,p];
}
const ready = p => p.getByText('Estimated walking route ·', {exact:false}).first().waitFor();
const navigate = (p, screen, point = home) => p.evaluate(hash => { location.hash=hash; }, `/${screen}?${params(point)}`);
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const [c,p]=await context();
  let calls=0;
  await c.route('**/api/walk', async route => {
    calls++;
    await route.fulfill({ json: fixture(route.request().postDataJSON().coordinates) });
  });
  // Verify the legacy link is preserved by the latest UI's redirect.
  await p.goto(`${origin}/#/?${params(home)}`);
  await ready(p);
  assert.match(p.url(), /#\/walk\?/);
  assert.equal(await p.locator('.addr-line').innerText(),address);
  assert.match(await p.locator('.route-distance').innerText(), /mapped walking route/);
  const distance = (await p.locator('.route-distance').innerText()).match(/\d+\.\d+ mi/)[0];
  const hazardNames=await p.locator('.hz-name').allTextContents();
  assert.ok(hazardNames.length > 0, 'fixture exercises displayed hazards');
  assert.match(await p.locator('.route-svg').getAttribute('aria-label'), /potential intersections/);
  if (process.env.SMOKE_SCREENSHOT) {
    await p.locator('.splash').waitFor({state:'detached'});
    await p.screenshot({path:process.env.SMOKE_SCREENSHOT,fullPage:true});
    await p.setViewportSize({width:390,height:844});
    await p.screenshot({path:process.env.SMOKE_SCREENSHOT.replace('.png','-mobile.png'),fullPage:true});
    await p.setViewportSize({width:1280,height:720});
  }
  await p.getByRole('link', {name:'Print a walk plan', exact:true}).click();
  await ready(p);
  assert.ok((await p.locator('.plan-walk').innerText()).includes(distance));
  assert.deepEqual(await p.locator('.hz-name').allTextContents(), hazardNames);
  if (process.env.SMOKE_SCREENSHOT) {
    await p.emulateMedia({media:'print'});
    await p.screenshot({path:process.env.SMOKE_SCREENSHOT.replace('.png','-plan-print.png'),fullPage:true});
    await p.emulateMedia({media:'screen'});
  }
  await p.getByRole('link', {name:'Get the page for HISD →',exact:true}).click();
  await ready(p);
  const copy=await p.locator('textarea').inputValue();
  assert.ok(copy.includes(distance));
  assert.ok(copy.includes(address));
  assert.ok(!copy.includes('crosses at least'));
  assert.deepEqual(await p.locator('.conditions table tbody tr td:nth-child(2)').allTextContents(), hazardNames);
  if (process.env.SMOKE_SCREENSHOT) {
    await p.emulateMedia({media:'print'});
    await p.screenshot({path:process.env.SMOKE_SCREENSHOT.replace('.png','-packet-print.png'),fullPage:true});
    await p.emulateMedia({media:'screen'});
  }
  assert.equal(calls,1,'identical old/new destination and page navigation reuse cached route');
  for (const screen of ['help','bus','schoolzone']) {
    await navigate(p, screen);
    await ready(p);
    assert.equal(calls,1,'new follow-up screens share cached route');
  }
  await navigate(p,'schoolzone');
  assert.deepEqual(await p.locator('.hz-name').allTextContents(),hazardNames);
  await p.goto(`${origin}/?lang=es#/walk?${params(home)}`);
  await p.getByText('Camino peatonal estimado ·',{exact:false}).first().waitFor();
  assert.match(await p.locator('.route-distance').innerText(), /camino peatonal del mapa/);
  await c.close();

  const [fc,fp]=await context();
  await fp.goto(`${origin}/#/walk?${params(home)}`); // actual production server missing key
  for (const screen of ['walk','plan','packet']) {
    if (screen !== 'walk') await navigate(fp,screen);
    await fp.getByText('Walking route unavailable.',{exact:false}).first().waitFor();
    assert.match(await fp.locator('main').innerText(), /straight.line/);
  }
  await fc.close();

  const [ic,ip]=await context();
  await ic.route('**/api/walk', r => r.fulfill({json:{coordinates:[[0,0],[1,1]],distanceM:1}}));
  await ip.goto(`${origin}/#/walk?${params(home)}`);
  await ip.getByText('Walking route unavailable.',{exact:false}).first().waitFor();
  assert.match(await ip.locator('.route-distance').innerText(), /straight line/);
  await ic.close();

  const [sc,sp]=await context();
  let release, requested;
  const waiting=new Promise(r => requested=r), gate=new Promise(r => release=r);
  await sc.route('**/api/walk', async route => {
    const coords=route.request().postDataJSON().coordinates;
    if (coords[0][0]===home[0]) { requested(); await gate; }
    await route.fulfill({json:fixture(coords)}).catch(()=>{});
  });
  await sp.goto(`${origin}/#/walk?${params(home)}`);
  await waiting;
  await sp.getByText('Finding a walking route.',{exact:false}).first().waitFor();
  await navigate(sp,'walk',other);
  await ready(sp);
  const second=await sp.locator('.route-distance').innerText();
  const secondHazards=await sp.locator('.hz-name').allTextContents();
  release();
  await sp.waitForTimeout(100); // deliberately late first-address response
  assert.equal(await sp.locator('.route-distance').innerText(),second);
  assert.deepEqual(await sp.locator('.hz-name').allTextContents(),secondHazards);
  assert.ok(sp.url().includes(params(other)));
  await navigate(sp,'plan',other); await ready(sp);
  assert.ok((await sp.locator('.plan-walk').last().innerText()).includes(second));
  await navigate(sp,'packet',other); await ready(sp);
  assert.ok((await sp.locator('textarea').inputValue()).includes(second));
  await sc.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: built Walk Check/Plan/Packet and follow-up screens, supplied/second address, shared cache and hazards, Spanish, real missing-key fallback, invalid response and stale-address race. Synthetic route geometry only.');
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise(r=>server.close(r));
}
