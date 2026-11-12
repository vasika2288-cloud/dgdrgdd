// Renders the film frame by frame in headless Chrome and muxes it with the audio mix.
//   node render.mjs                    -> out/odin-doma.mp4
//   node render.mjs --stills=1,5.5,12  -> out/stills/*.png
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const FPS = 30;
const stills = process.argv.find(a => a.startsWith('--stills='));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
const page = await browser.newPage();
// 576x1024 design space, exported at 1080x1920.
await page.setViewport({ width: 576, height: 1024, deviceScaleFactor: 1.875 });
const errors = [];
page.on('pageerror', e => errors.push(e));
await page.goto(pathToFileURL('src/index.html').href + '?render=1');
await page.evaluate(() => window.ready);
const dur = await page.evaluate(() => window.DUR);

const frame = async t => {
  await page.evaluate(x => window.renderFrame(x), t);
  if (errors.length) throw errors[0];
};

if (stills) {
  mkdirSync('out/stills', { recursive: true });
  for (const t of stills.split('=')[1].split(',').map(Number)) {
    await frame(t);
    await page.screenshot({ path: `out/stills/${t.toFixed(2).padStart(5, '0')}.png` });
  }
} else {
  mkdirSync('out', { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', 'out/mix.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'out/odin-doma.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(dur * FPS);
  for (let i = 0; i < total; i++) {
    await frame(i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  if (code) process.exitCode = code;
}
await browser.close();
