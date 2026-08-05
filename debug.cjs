const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  console.log('Navigating to Vercel app...');
  await page.goto('https://magizhini.vercel.app/', { waitUntil: 'networkidle2' });
  console.log('Navigation complete.');

  console.log('Attempting login...');
  await page.type('input[type="email"]', 'admin@magizhini.app');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // Wait a bit to let any useEffects run
  await new Promise(r => setTimeout(r, 3000));
  console.log('Done waiting.');

  await browser.close();
})();
