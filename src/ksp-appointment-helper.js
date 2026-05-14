const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  bestTextMatch,
  buildWindowsPopupCommand,
  envToConfig,
  getLocationAvailabilityStatus,
} = require('./appointment-utils');

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }

  return env;
}

function log(message) {
  const stamp = new Date().toLocaleString();
  console.log(`[${stamp}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showWindowsPopup(message) {
  if (process.platform !== 'win32') return;

  const command = buildWindowsPopupCommand(message, 'KSP Appointment Alert');
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
}

function alertUser(message) {
  process.stdout.write('\u0007');
  log(message);
  showWindowsPopup(message);
}

async function screenshot(page, label) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const filePath = path.join(SCREENSHOT_DIR, `${Date.now()}-${safeLabel}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  log(`Screenshot saved: ${filePath}`);
}

async function visibleTexts(locator) {
  const count = await locator.count();
  const texts = [];

  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (!(await item.isVisible().catch(() => false))) continue;
    const text = (await item.innerText().catch(() => '')) || '';
    if (text.trim()) texts.push(text.trim());
  }

  return texts;
}

async function clickBestText(page, selector, target, label) {
  const locator = page.locator(selector);
  const texts = await visibleTexts(locator);
  const match = bestTextMatch(texts, target);

  if (!match) {
    throw new Error(`Could not find ${label}: "${target}". Visible options: ${texts.join(' | ')}`);
  }

  log(`Selecting ${label}: ${match}`);
  await locator.filter({ hasText: match }).first().click();
}

async function openLocationStep(page, config) {
  await page.goto(config.url, { waitUntil: 'domcontentloaded' });
  await clickBestText(page, 'a, button', config.appointmentTypeText, 'appointment type');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

async function checkOnce(page, config) {
  await openLocationStep(page, config);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const locationStatus = getLocationAvailabilityStatus(bodyText, config.locationText);

  if (locationStatus === 'available') {
    alertUser(`${config.locationText} has Select In Person Appointment available. Please review the browser now.`);
    await screenshot(page, 'target-location-available');
    return true;
  }

  if (locationStatus === 'unavailable') {
    log(`Target location is listed, but currently shows No Availability: ${config.locationText}`);
    await screenshot(page, 'target-location-no-availability');
    return false;
  }

  log(`Target location was not found on this check: ${config.locationText}`);
  await screenshot(page, 'target-location-missing');
  return false;
}

async function main() {
  const env = { ...process.env, ...loadDotEnv(path.join(ROOT, '.env')) };
  const config = envToConfig(env);

  log(`Target type: ${config.appointmentTypeText}`);
  log(`Target location: ${config.locationText}`);
  log(`Polling every ${config.pollSeconds} seconds. The script only watches for the target location's Select In Person Appointment option.`);

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMoMs,
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  try {
    while (true) {
      const done = await checkOnce(page, config);
      if (done) {
        log('Stopping monitor with the browser open. No booking or applicant form was submitted.');
        await page.pause().catch(() => {});
        break;
      }

      await sleep(config.pollSeconds * 1000);
    }
  } catch (error) {
    await screenshot(page, 'error');
    console.error(error);
    process.exitCode = 1;
  }
}

main();
