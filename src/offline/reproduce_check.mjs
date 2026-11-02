import { chromium } from 'playwright';

async function testOfflineSearch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Go to Search page
  await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check if offline dataset is available or wait for it
  const isReady = await page.evaluate(async () => {
    // Check IndexedDB
    return new Promise((resolve) => {
      const req = indexedDB.open('QuranOfflineDB');
      req.onsuccess = () => {
        const db = req.result;
        resolve(db.objectStoreNames.contains('verses'));
      };
      req.onerror = () => resolve(false);
    });
  });
  console.log('IndexedDB QuranOfflineDB verses store exists:', isReady);

  await browser.close();
}

testOfflineSearch().catch(console.error);

