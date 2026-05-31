// One-off: rasterize public/icon.svg into PNG app icons.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icon.svg", import.meta.url));

const targets = [
  { out: "../public/icon-192.png", size: 192 },
  { out: "../public/icon-512.png", size: 512 },
  // iOS home-screen icon: opaque background, no transparency.
  { out: "../app/apple-icon.png", size: 180 },
];

for (const { out, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: "#0f172a" })
    .flatten({ background: "#0f172a" })
    .png()
    .toFile(new URL(out, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log("wrote", out, size);
}
