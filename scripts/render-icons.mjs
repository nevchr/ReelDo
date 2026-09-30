import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const svg = await readFile('public/icon.svg', 'utf8');
await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.locator('svg').screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true });
  }
  console.log('Rendered extension icons at 16, 32, 48, and 128 pixels.');
} finally { await browser.close(); }
