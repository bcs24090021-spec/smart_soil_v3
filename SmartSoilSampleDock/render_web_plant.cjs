const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/alvin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.join(__dirname, 'output/tft-concept');
(async () => {
  const server = http.createServer((req,res) => {
    const filename = path.join(root, req.url === '/' ? 'render-web-plant.html' : path.basename(req.url));
    res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : 'text/html');
    fs.readFile(filename, (err,data) => { res.statusCode=err?404:200;res.end(err?'Not found':data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport:{width:360,height:390},deviceScaleFactor:1});
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.renderReady === true, {timeout:60000});
    await page.locator('canvas').screenshot({path:path.join(root,'web_plant_render.png')});
    console.log('Rendered original Web model.');
  } finally { if(browser) await browser.close(); server.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
