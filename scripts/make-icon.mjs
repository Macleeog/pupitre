// Renders build/icon.svg into the PNG sizes Windows and Electron want, then packs them into an .ico.
// Run it after editing the SVG: `node scripts/make-icon.mjs`.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const full = await readFile(path.join(root, "build/icon.svg"), "utf8");
const small = await readFile(path.join(root, "build/icon-small.svg"), "utf8");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();

async function render(size) {
  const svg = size <= 32 ? small : full;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.screenshot({ omitBackground: true });
}

const pngs = new Map();
for (const size of SIZES) pngs.set(size, await render(size));
pngs.set(512, await render(512));
await browser.close();

// ICONDIR, then one ICONDIRENTRY per size, then the PNG payloads. Windows reads PNG-compressed
// entries at every size since Vista, so no BMP fallback is needed.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);

const entries = [];
const payloads = [];
let offset = 6 + SIZES.length * 16;
for (const size of SIZES) {
  const png = pngs.get(size);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  payloads.push(png);
  offset += png.length;
}

await writeFile(path.join(root, "build/icon.ico"), Buffer.concat([header, ...entries, ...payloads]));
await writeFile(path.join(root, "build/icon.png"), pngs.get(512));
await writeFile(path.join(root, "desktop/icon.png"), pngs.get(256));
console.log(`icon.ico (${SIZES.join(", ")}), icon.png 512, desktop/icon.png 256`);
