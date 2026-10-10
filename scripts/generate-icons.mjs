#!/usr/bin/env node
/**
 * Renders assets/icon.svg into the PNG sizes the manifest names.
 *
 * Chrome requires PNG for extension icons. Rendering with Playwright's
 * Chromium, which the test suite already installs, avoids adding an image
 * library just for this. Run it after editing the SVG and commit the PNGs.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const iconsDir = join(root, 'public/icons');
const svg = readFileSync(join(root, 'assets/icon.svg'), 'utf8');
const SIZES = [16, 32, 48, 128];

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
    );
    await page.screenshot({ path: join(iconsDir, `icon${size}.png`), omitBackground: true });
    await page.close();
    console.log(`✔ icon${size}.png`);
  }
} finally {
  await browser.close();
}
