# KSP Appointment Monitor

A small Playwright-based monitor for Kentucky State Police appointment availability.

It supports two Louisville/Bowman profiles:

- `written`: written permit test
- `road`: driver license road test

When the target location card shows an appointment entry point, the monitor plays a bell, opens a Windows popup, and stops with the browser open so you can review the page yourself.

## What It Does

- Checks the KSP appointment site every 30 seconds by default.
- Prompts you to choose written test or road test when the script starts.
- Looks only at the selected target location card.
- Alerts when that card shows `Select In Person Appointment`, `Check Earliest Availability`, or an available-count line such as `May 05, 1 available.`
- Leaves the browser open after an alert.

## What It Does Not Do

- It does not bypass CAPTCHA, rate limits, eligibility rules, or confirmation steps.
- It does not click into the booking flow after alerting.
- It does not fill applicant information.
- It does not submit or confirm appointments.
- It does not require personal information.

## Requirements

- Node.js and npm
- Git
- Windows PowerShell for the popup alert

The monitor itself can run anywhere Playwright Chromium runs, but the popup helper is Windows-specific. On other platforms, the terminal bell still works.

## Quick Start

```powershell
git clone https://github.com/YufeiXIA/ksp-appointment-monitor.git
cd ksp-appointment-monitor
npm install
npx playwright install chromium
Copy-Item .env.example .env
npm start
```

The `.env` file is optional. Copying it gives you an easy place to change the default profile, interval, or browser settings.

## Configuration

Edit `.env` if you want to change the defaults:

```env
APPOINTMENT_PROFILE=
POLL_SECONDS=30
HEADLESS=false
SLOW_MO_MS=75
```

| Setting | Purpose |
| --- | --- |
| `APPOINTMENT_PROFILE` | Optional. Use `written` or `road` to skip the startup prompt. Leave blank to choose interactively. |
| `POLL_SECONDS` | Default refresh interval. Values below 30 are raised to 30. You can also choose this when the script starts. |
| `HEADLESS` | Use `true` to run without a visible browser. |
| `SLOW_MO_MS` | Small delay between browser actions, useful for visibility and stability. |

No name, birthday, phone number, email, license number, or address is used by this monitor.

## Running

From the project folder:

```powershell
npm start
```

You will see:

```text
Choose appointment type to monitor:
  1) Written permit test - Louisville (Bowman) Regional Test Site-Written Test
  2) Road test - Louisville(Bowman) Regional Test Site - Road Test
Select 1 or 2 [1]:
Refresh interval in seconds, minimum 30 [30]:
```

While there is no availability, logs look like this:

```text
Target location is listed, but currently shows No Availability: Louisville (Bowman) Regional Test Site-Written Test
```

When availability appears, the monitor:

1. Plays the terminal bell.
2. Shows a Windows popup.
3. Stops polling with the browser open.

At that point, review the page and continue manually.

## Testing

```powershell
npm test
node --check src\appointment-utils.js
node --check src\ksp-appointment-helper.js
```

## Files

- `src/ksp-appointment-helper.js`: browser workflow and alerting.
- `src/appointment-utils.js`: matching, configuration, and popup helpers.
- `test/appointment-utils.test.js`: focused tests for matching and configuration.
- `.env.example`: optional local configuration template.

## Privacy

- `.env` is ignored by Git.
- `node_modules/` and local temporary output folders are ignored by Git.
- The monitor does not collect or transmit personal information.

## Contributors

- YufeiXIA
- Codex
