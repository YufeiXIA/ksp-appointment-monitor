const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  bestTextMatch,
  buildWindowsPopupCommand,
  envToConfig,
  getLocationAvailabilityStatus,
  isInPersonAppointmentActionText,
  isLikelySlotText,
  normalizeText,
  validateRequiredConfig,
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

function alertUser(message) {
  process.stdout.write('\u0007');
  log(message);
  showWindowsPopup(message);
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

async function selectOptionByText(page, target) {
  const selects = page.locator('select');
  const selectCount = await selects.count();

  for (let selectIndex = 0; selectIndex < selectCount; selectIndex += 1) {
    const select = selects.nth(selectIndex);
    const options = await select.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: node.textContent || '',
        value: node.getAttribute('value') || '',
      }))
    );

    const optionText = bestTextMatch(options.map((option) => option.text), target);
    if (optionText) {
      const option = options.find((entry) => entry.text === optionText);
      log(`Selecting dropdown option: ${optionText}`);
      await select.selectOption(option.value);
      return true;
    }
  }

  return false;
}

async function advanceFromTypeToLocation(page, config) {
  await page.goto(config.url, { waitUntil: 'domcontentloaded' });
  await clickBestText(page, 'a, button', config.appointmentTypeText, 'appointment type');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

async function chooseLocation(page, config) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const locationStatus = getLocationAvailabilityStatus(bodyText, config.locationText);

  if (locationStatus === 'unavailable') {
    log(`Target location is listed, but currently shows No Availability: ${config.locationText}`);
    return false;
  }

  if (locationStatus === 'available') {
    log(`Target location shows Check Earliest Availability: ${config.locationText}`);
  }

  if (await selectOptionByText(page, config.locationText)) {
    const continueButton = page.getByRole('button', { name: /continue|next|submit/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }
    return true;
  }

  await clickBestText(page, 'a, button, label', config.locationText, 'location');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const clickedModalButton = await clickInPersonAppointmentModalButton(page);
  if (!clickedModalButton) {
    await clickTargetCardInPersonAppointmentButton(page, config.locationText);
  }
  return true;
}

async function clickInPersonAppointmentModalButton(page) {
  await page.waitForTimeout(500);

  const visibleDialog = page.locator('.modal.show, .modal.in, [role="dialog"]').last();
  const searchRoot = await visibleDialog.isVisible().catch(() => false)
    ? visibleDialog
    : page.locator('body');

  const modalButton = searchRoot.locator('a, button, input[type="button"], input[type="submit"]').filter({
    hasText: /select in person appointment/i,
  }).first();

  if (!(await modalButton.isVisible().catch(() => false))) return false;

  const buttonText = (await modalButton.innerText().catch(() => '')) || '';
  if (!isInPersonAppointmentActionText(buttonText)) return false;

  log('Confirming in-person appointment selection in location popup.');
  await modalButton.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(750);
  return true;
}

async function clickTargetCardInPersonAppointmentButton(page, targetLocationText) {
  await page.waitForTimeout(500);

  const clicked = await page.evaluate((target) => {
    function normalize(value) {
      return String(value || '')
        .replace(/&/g, ' and ')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    }

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 0
        && rect.height > 0;
    }

    const targetText = normalize(target);
    const allElements = [...document.querySelectorAll('body *')].filter(isVisible);
    const targetElements = allElements.filter((element) => {
      const text = normalize(element.textContent);
      return text
        && text.length <= targetText.length + 60
        && (text === targetText || text.includes(targetText) || targetText.includes(text));
    });

    for (const targetElement of targetElements) {
      let ancestor = targetElement;
      for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
        const buttons = [...ancestor.querySelectorAll('a, button, input[type="button"], input[type="submit"]')]
          .filter(isVisible)
          .filter((button) => normalize(button.innerText || button.value || button.textContent) === 'select in person appointment');

        if (buttons.length) {
          buttons[0].click();
          return true;
        }
      }
    }

    return false;
  }, targetLocationText);

  if (clicked) {
    log('Selecting in-person appointment button on the target location card.');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1000);
    return true;
  }

  log('Target location has availability text, but no matching in-person appointment button was found yet.');
  return false;
}

async function findAvailableSlot(page, config) {
  const bodyText = normalizeText(await page.locator('body').innerText().catch(() => ''));
  const unavailablePatterns = [
    'no appointment',
    'no available',
    'currently unavailable',
    'no times',
    'not available',
  ];

  if (unavailablePatterns.some((pattern) => bodyText.includes(pattern))) {
    return null;
  }

  const slotLocator = page.locator('a, button, input[type="button"], input[type="submit"]');

  const texts = await visibleTexts(slotLocator);
  const filteredTexts = texts.filter((text) => {
    const normalized = normalizeText(text);
    if (!isLikelySlotText(text)) return false;
    if (!config.preferredDate) return true;
    return normalized.includes(normalizeText(config.preferredDate));
  });

  if (!filteredTexts.length) return null;
  return bestTextMatch(filteredTexts, config.preferredDate || filteredTexts[0]) || filteredTexts[0];
}

async function chooseFirstAvailableSlot(page, config) {
  const slotText = await findAvailableSlot(page, config);
  if (!slotText) return false;

  alertUser(`Found an available appointment slot: ${slotText}`);
  await screenshot(page, 'available-slot');
  await page.locator('a, button, input[type="button"], input[type="submit"]').filter({ hasText: slotText }).first().click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await clickContinueToApplicantInfo(page);
  return true;
}

async function hasApplicantFields(page) {
  const probes = ['First Name', 'Last Name', 'Date of Birth', 'Email', 'Phone'];
  for (const label of probes) {
    const field = page.getByLabel(label, { exact: false }).first();
    if (await field.isVisible().catch(() => false)) return true;
  }
  return false;
}

async function clickContinueToApplicantInfo(page) {
  if (await hasApplicantFields(page)) return;

  const continueButton = page.getByRole('button', { name: /continue|next/i }).first();
  if (await continueButton.isVisible().catch(() => false)) {
    log('Advancing from selected time slot to applicant information.');
    await continueButton.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }
}

async function fillByLabels(page, labels, value) {
  if (!value) return false;

  for (const label of labels) {
    const field = page.getByLabel(label, { exact: false }).first();
    if (await field.isVisible().catch(() => false)) {
      await field.fill(value);
      log(`Filled ${label}`);
      return true;
    }
  }

  return false;
}

async function fillApplicantInfo(page, applicant) {
  const fillPlan = [
    [['First Name', 'Applicant First Name'], applicant.FIRST_NAME],
    [['Middle Name', 'Middle Initial'], applicant.MIDDLE_NAME],
    [['Last Name', 'Applicant Last Name'], applicant.LAST_NAME],
    [['Date of Birth', 'DOB', 'Birth Date'], applicant.DATE_OF_BIRTH],
    [['Phone', 'Telephone', 'Mobile'], applicant.PHONE],
    [['Email', 'E-mail'], applicant.EMAIL],
    [['Address', 'Street'], applicant.ADDRESS],
    [['City'], applicant.CITY],
    [['State'], applicant.STATE],
    [['Zip', 'Postal'], applicant.ZIP],
    [['Permit', 'License Number', 'Driver License'], applicant.LICENSE_OR_PERMIT_NUMBER],
  ];

  const missed = [];
  for (const [labels, value] of fillPlan) {
    if (!value) continue;
    const filled = await fillByLabels(page, labels, value);
    if (!filled) missed.push(labels[0]);
  }

  if (missed.length) {
    log(`Could not find these optional/required fields by label: ${missed.join(', ')}`);
    log('The browser is left open so you can fill anything the page labels differently.');
  }

  await screenshot(page, 'applicant-info-prefilled');
}

async function checkOnce(page, config) {
  await advanceFromTypeToLocation(page, config);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const locationStatus = getLocationAvailabilityStatus(bodyText, config.locationText);

  if (locationStatus === 'available') {
    alertUser(`Louisville/Bowman has Select In Person Appointment available. Please review the browser now.`);
    await screenshot(page, 'target-location-available');
    return true;
  }

  if (locationStatus === 'unavailable') {
    log(`Target location is listed, but currently shows No Availability: ${config.locationText}`);
    await screenshot(page, 'target-location-no-availability');
    return false;
  }

  log(`Target location was not found on this check: ${config.locationText}`);
  await screenshot(page, 'no-slot');
  return false;
}

async function main() {
  const env = { ...process.env, ...loadDotEnv(path.join(ROOT, '.env')) };
  const config = envToConfig(env);
  const missing = validateRequiredConfig(config);

  if (missing.length) {
    console.error(`Missing required .env values: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill your applicant information first.');
    process.exitCode = 1;
    return;
  }

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
