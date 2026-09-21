// Capture real interactions. This produces stills for a captioned walkthrough,
// not a continuous screen recording or a claim about human/model performance.
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';
const base = process.env.DEMO_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(base)) throw new Error('Set DEMO_BASE to this project’s loopback server.');
const destination = join(ROOT, 'media/demo/captures');
await mkdir(destination); // New destination only; never overwrite a prior capture run.
// Keep standalone Node alive while the browser pipe has no referenced handles.
// The test runner had its own HTTP server keeping the event loop alive.
const deadline = setTimeout(() => { console.error('Demo capture exceeded 60 seconds.'); process.exit(1); }, 60000);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1152, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const records = [], requests = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
context.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('blob:')) requests.push(request.url()); });
async function capture(id, caption, action) {
  const path = join(destination, `${id}.png`);
  await page.screenshot({ path });
  records.push({ id, path, caption, action, capturedAt: new Date().toISOString(), durationSeconds: 3,
    sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
async function choose(name, value) { await page.locator(`label:has(input[name="${name}"][value="${value}"])`).click(); }
try {
  await page.goto(base); await page.click('#demo-button');
  await page.locator('.editor-section').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await capture('01-prepare', 'Start with one question and two answers.', 'Clicked the built-in synthetic demo and scrolled to the populated editor.');
  await page.click('#begin-button');
  await page.locator('.question-card').evaluate(node => node.scrollIntoView({ block: 'start' }));
  if (await page.locator('.origin,input[id^="origin-"]').count()) throw new Error('Sources unexpectedly visible before reveal.');
  await capture('02-blind', 'Hide the names. The app shuffles A and B.', 'Clicked Hide names & compare; confirmed source fields are absent.');
  for (const label of ['A', 'B']) for (const metric of ['usefulness', 'clarity', 'factualConfidence']) await choose(`${label}-${metric}`, metric === 'factualConfidence' ? 'unsure' : 4);
  await page.locator('.rating-area').first().evaluate(node => node.scrollIntoView({ block: 'start' }));
  await capture('03-ratings', 'Rate usefulness, clarity, and your own confidence.', 'Entered illustrative ratings; selected Not sure for factual confidence.');
  await choose('verdict', 'tie'); await page.fill('#note', 'Illustrative demo ratings only. Check important claims independently.');
  await page.locator('#verdict-form').evaluate(node => node.scrollIntoView({ block: 'center' }));
  await capture('04-verdict', 'Choose your verdict before seeing the sources.', 'Selected a tie and added a clearly illustrative note; no reveal yet.');
  await page.click('#reveal-button'); await page.waitForSelector('#export-button');
  await page.locator('.comparison-grid').evaluate(node => node.scrollIntoView({ block: 'start' }));
  if (await page.locator('.origin').count() !== 2) throw new Error('Sources not revealed.');
  await capture('05-reveal', 'Reveal origins. One preference is not a model ranking.', 'Locked the verdict, then inspected both revealed synthetic source names.');
  await page.locator('.reveal-summary').evaluate(node => node.scrollIntoView({ block: 'start' }));
  const downloadPromise = page.waitForEvent('download'); await page.click('#export-button');
  const download = await downloadPromise; await download.saveAs(join(ROOT, 'media/demo/demo-result.json'));
  if (await download.failure()) throw new Error('Demo result download failed.');
  await capture('06-export', 'Export a complete JSON. No answer is uploaded.', 'Clicked Export result JSON and saved the actual browser download.');
  if (errors.length || requests.length) throw new Error('Unexpected browser error or external request.');
  await writeFile(join(ROOT, 'media/demo/capture-log.json'), JSON.stringify({ schema: 'answer-lens-demo-capture/1',
    recordedAt: new Date().toISOString(), browserVersion: browser.version(), viewport: { width: 1152, height: 720 },
    source: 'Real Answer Lens browser interactions with original synthetic example text.',
    format: 'Six still interaction captures; 3-second editorial holds, not continuous real-time recording.',
    ratings: 'Illustrative scripted inputs, not a human study.', pageErrors: errors, externalRequests: requests, captures: records
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ captures: records.length, browser: browser.version(), externalRequests: requests.length, pageErrors: errors.length }));
} finally { await context.close(); await browser.close(); clearTimeout(deadline); }
