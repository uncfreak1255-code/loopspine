import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = path.join(root, "demo", "latest", "receipt.json");
if (!fs.existsSync(receiptPath)) throw new Error("run `npm run demo` before rendering");
const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
if (!receipt.success) throw new Error("cannot render a failed demo receipt");

const framesDir = path.join(root, "demo", "frames");
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const scenes = [
  ["REPRODUCE", "npm test  FAIL", "quoted comma splits into two values", "#ff6b6b"],
  ["RED", "regression test added", "quoted-comma behavior is now pinned", "#ffd166"],
  ["GREEN", "smallest parser repair", "only source and focused test changed", "#66d9a3"],
  ["PROOF", "npm test  PASS", "independent verifier  PASS", "#66d9a3"],
  ["REVIEW", "PASS  0 findings", "fresh read-only reviewer", "#66d9a3"],
  ["RESULT", "success", `0 interventions  |  ${receipt.duration_seconds}s to proof`, "#66d9a3"]
];

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

for (const [index, [phase, headline, detail, color]] of scenes.entries()) {
  const progress = scenes.map((_, item) => `<rect x="${70 + item * 170}" y="500" width="140" height="8" rx="4" fill="${item <= index ? "#66d9a3" : "#30363d"}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
<rect width="1200" height="600" fill="#0d1117"/>
<text x="70" y="90" fill="#f0f6fc" font-family="monospace" font-size="38" font-weight="600">LoopSpine: bug to verified result</text>
<text x="70" y="190" fill="${color}" font-family="monospace" font-size="46" font-weight="600">${escapeXml(index + 1)}  ${escapeXml(phase)}</text>
<text x="70" y="265" fill="#f0f6fc" font-family="monospace" font-size="34">${escapeXml(headline)}</text>
<text x="70" y="320" fill="#9da7b3" font-family="monospace" font-size="25">${escapeXml(detail)}</text>
${progress}
<text x="70" y="555" fill="#9da7b3" font-family="monospace" font-size="21">reproduce &gt; regression &gt; repair &gt; proof &gt; review &gt; receipt</text>
</svg>
`;
  fs.writeFileSync(path.join(framesDir, `frame-${String(index + 1).padStart(2, "0")}.svg`), svg);
}

function commandExists(command) {
  return spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8" }).status === 0;
}

for (let index = 1; index <= scenes.length; index += 1) {
  const stem = `frame-${String(index).padStart(2, "0")}`;
  const svg = path.join(framesDir, `${stem}.svg`);
  const png = path.join(framesDir, `${stem}.png`);
  const conversion = commandExists("sips")
    ? spawnSync("sips", ["-s", "format", "png", svg, "--out", png], { encoding: "utf8" })
    : commandExists("rsvg-convert")
      ? spawnSync("rsvg-convert", ["-o", png, svg], { encoding: "utf8" })
      : null;
  if (!conversion || conversion.status !== 0) {
    throw new Error("rendering SVG frames requires sips or rsvg-convert");
  }
}

const output = path.join(root, "demo", "loopspine-demo.gif");
const result = spawnSync("ffmpeg", [
  "-y", "-framerate", "0.5", "-i", path.join(framesDir, "frame-%02d.png"),
  "-filter_complex", "[0:v]fps=12,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer",
  "-loop", "0", output
], { encoding: "utf8", timeout: 120000 });
if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr.slice(-2000)}`);
console.log(JSON.stringify({ output, bytes: fs.statSync(output).size, duration_seconds: 12 }, null, 2));
