# KSP Appointment Monitor

Browser-assisted availability monitor for Kentucky State Police written permit test appointments.

## Current Status

- Watches `Driver License, CDL or Motorcycle Written (Permit) Test`.
- Targets `Louisville (Bowman) Regional Test Site-Written Test`.
- Checks every 60 seconds by default.
- Alerts when the target location card shows `Select In Person Appointment`, `Check Earliest Availability`, or an available-count line such as `May 05, 1 available.`
- Plays a terminal bell, opens a Windows popup, saves a screenshot, and stops with the browser open.
- Does not click into the booking flow after alerting.
- Does not fill applicant information.
- Does not submit or confirm appointments.

## Setup

```powershell
git clone https://github.com/YufeiXIA/ksp-appointment-monitor.git
cd ksp-appointment-monitor
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

The `.env` file is optional. Use it only if you want to change the target location, polling interval, or browser behavior.

## Run

```powershell
npm start
```

The monitor enforces a minimum `POLL_SECONDS` value of 60 seconds.

## Configuration

`.env.example` contains the supported settings:

```env
APPOINTMENT_TYPE_TEXT=Driver License, CDL or Motorcycle Written (Permit) Test
LOCATION_TEXT=Louisville (Bowman) Regional Test Site-Written Test
POLL_SECONDS=60
HEADLESS=false
SLOW_MO_MS=75
```

No personal information is required.

## Test

```powershell
npm test
node --check src\appointment-utils.js
node --check src\ksp-appointment-helper.js
```

## Safety Notes

- The monitor does not bypass CAPTCHA, rate limits, eligibility rules, or confirmation steps.
- It only watches the target location card and alerts when an appointment entry point appears.
- Screenshots are saved locally under `screenshots/` and are ignored by Git.
- `.env` is ignored by Git.

## Contributors

- YufeiXIA
- Codex
