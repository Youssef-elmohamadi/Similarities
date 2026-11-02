import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function reproduceWithIndexedDB() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@example.com', fullName: 'Test User' }));
    localStorage.setItem('access_token', 'mock_token');
    localStorage.setItem('refresh_token', 'mock_refresh');
  });

  const page = await context.newPage();

  console.log('1. Loading app and seeding IndexedDB QuranOfflineDB...');
  await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });

  // Read dataset fixtures
  const fixturePath = path.resolve(__dirname, 'dataset_fixtures.json');
  let raw = fs.readFileSync(fixturePath, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const fixtureData = JSON.parse(raw);

  // Seed IndexedDB in browser
  await page.evaluate(async (dataset) => {
    return new Promise((resolve, reject) => {
      const openReq = indexedDB.open('QuranOfflineDB', 1);
      openReq.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata');
        if (!db.objectStoreNames.contains('surahs')) {
          const sStore = db.createObjectStore('surahs', { keyPath: 'id' });
          sStore.createIndex('by-number', 'number');
        }
        if (!db.objectStoreNames.contains('verses')) {
          const vStore = db.createObjectStore('verses', { keyPath: 'id' });
          vStore.createIndex('by-surah', 'surahId');
          vStore.createIndex('by-juz', 'juzNumber');
        }
        if (!db.objectStoreNames.contains('words')) {
          const wStore = db.createObjectStore('words', { autoIncrement: true });
          wStore.createIndex('by-verse', 'verseId');
          wStore.createIndex('by-normalized', 'normalizedWord');
          wStore.createIndex('by-phonetic', 'phoneticWord');
          wStore.createIndex('by-skeleton', 'skeletonWord');
        }
      };
      openReq.onsuccess = async () => {
        const db = openReq.result;
        const tx = db.transaction(['metadata', 'surahs', 'verses', 'words'], 'readwrite');
        tx.objectStore('metadata').put(dataset.versionHash, 'versionHash');
        for (const s of dataset.surahs) tx.objectStore('surahs').put(s);
        for (const v of dataset.verses) tx.objectStore('verses').put(v);
        for (const w of dataset.words) tx.objectStore('words').put(w);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (err) => reject(err);
      };
      openReq.onerror = (err) => reject(err);
    });
  }, fixtureData);

  console.log('IndexedDB seeded with 114 surahs, 6236 verses, 77647 words!');

  // Reload page so DatasetContext detects IndexedDB dataset is ready
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const searchInput = page.locator('input[enterkeyhint="search"]');

  // Check if isOfflineReady is detected
  const isReady = await page.evaluate(async () => {
    // Check if worker client or dataset is ready
    return new Promise(resolve => {
      const openReq = indexedDB.open('QuranOfflineDB', 1);
      openReq.onsuccess = async () => {
        const db = openReq.result;
        const tx = db.transaction('metadata', 'readonly');
        const req = tx.objectStore('metadata').get('versionHash');
        req.onsuccess = () => resolve(Boolean(req.result));
      };
    });
  });
  console.log('App detected local dataset available:', isReady);

  // 1. ONLINE TEST: type "العالم"
  console.log('\n--- 1. ONLINE TEST WITH LOCAL DATASET ---');
  await searchInput.fill('');
  await searchInput.type('العالم', { delay: 40 });
  const lastKeyOnline = Date.now();

  try {
    await page.waitForSelector('.ayah-number-badge', { timeout: 4000 });
    const renderTime = Date.now();
    console.log(`ONLINE: Results rendered in ${renderTime - lastKeyOnline}ms after last keystroke!`);
  } catch (e) {
    console.log('ONLINE timeout:', e.message);
  }

  // 2. OFFLINE TEST:
  console.log('\n--- 2. OFFLINE TEST WITH LOCAL DATASET ---');
  await context.setOffline(true);
  console.log('context.setOffline(true) called. navigator.onLine is now:', await page.evaluate(() => navigator.onLine));

  // Clear input
  await searchInput.fill('');
  await page.waitForTimeout(500);

  // Type "نعم"
  console.log('Typing "نعم" while OFFLINE...');
  await searchInput.type('نعم', { delay: 40 });
  const lastKeyOffline = Date.now();

  // Wait 600ms (debounce is 250ms)
  await page.waitForTimeout(600);

  // Inspect React Query cache state
  const cacheOffline = await page.evaluate(() => {
    const qc = (window).__queryClient;
    if (!qc) return null;
    return qc.getQueryCache().getAll().map(q => ({
      queryKey: q.queryKey,
      status: q.state.status,
      fetchStatus: q.state.fetchStatus,
      isPaused: q.state.fetchStatus === 'paused',
      hasData: Boolean(q.state.data),
    }));
  });

  console.log('\nTanStack Query cache when offline after typing "نعم":');
  console.log(JSON.stringify(cacheOffline, null, 2));

  // Check if results rendered on screen
  const badgesCount = await page.locator('.ayah-number-badge').count();
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(`\nBadges visible: ${badgesCount}, Has 'نعم': ${bodyText.includes('نعم')}`);

  if (badgesCount === 0 || !bodyText.includes('نعم')) {
    console.log('>>> BUG REPRODUCED: Even with dataset in IndexedDB, query is fetchStatus: paused and did NOT run! <<<');

    console.log('\nSimulating user pressing Enter:');
    const tEnter = Date.now();
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const postEnterCache = await page.evaluate(() => {
      const qc = (window).__queryClient;
      if (!qc) return null;
      return qc.getQueryCache().getAll().map(q => ({
        queryKey: q.queryKey,
        status: q.state.status,
        fetchStatus: q.state.fetchStatus,
        hasData: Boolean(q.state.data),
      }));
    });
    console.log('After Enter:', JSON.stringify(postEnterCache, null, 2));
  } else {
    console.log(`Results appeared in ${Date.now() - lastKeyOffline}ms!`);
  }

  await browser.close();
}

reproduceWithIndexedDB().catch(console.error);
