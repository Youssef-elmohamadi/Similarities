import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to parse simple key=val env file
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

// Check process.env first, then fallback to env files
let siteUrl = process.env.VITE_SITE_URL;

if (!siteUrl) {
  const envFiles = [
    path.join(projectRoot, '.env.production.local'),
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env.production'),
    path.join(projectRoot, '.env'),
  ];
  for (const envFile of envFiles) {
    const parsed = loadEnvFile(envFile);
    if (parsed.VITE_SITE_URL) {
      siteUrl = parsed.VITE_SITE_URL;
      process.env.VITE_SITE_URL = siteUrl;
      break;
    }
  }
}

if (!siteUrl) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: VITE_SITE_URL is required for build.');
  console.error('Please configure VITE_SITE_URL in your environment or .env.production file.');
  console.error('Example: VITE_SITE_URL=https://quran-similarities-sandy.vercel.app');
  process.exit(1);
}

// Normalize URL (strip trailing slashes)
const baseUrl = siteUrl.replace(/\/+$/, '');
const today = new Date().toISOString().split('T')[0];

const publicDir = path.join(projectRoot, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate robots.txt
const robotsContent = `# Robots.txt for Quran Similarities Platform
# Landing page is public and indexable; application internal routes and API are disallowed.
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /library
Disallow: /collections
Disallow: /search
Disallow: /settings
Disallow: /api

Sitemap: ${baseUrl}/sitemap.xml
`;

fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf-8');
console.log(`[SEO] Generated public/robots.txt pointing to ${baseUrl}/sitemap.xml`);

// 2. Generate sitemap.xml (Landing URL ONLY)
const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf-8');
console.log(`[SEO] Generated public/sitemap.xml for landing page with lastmod ${today}`);

