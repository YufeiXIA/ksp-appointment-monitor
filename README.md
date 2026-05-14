# KSP Written Permit Test Helper

This is a browser-assisted monitor for the Kentucky State Police appointment site.
It targets:

- Appointment type: `Driver License, CDL or Motorcycle Written (Permit) Test`
- Location: `Louisville (Bowman) Regional Test Site-Written Test`

It opens a real Chromium browser, checks the target Louisville/Bowman location card at a respectful interval, and alerts you when that card shows a `Select In Person Appointment` option. It saves a screenshot and leaves the browser open for your manual review.

## Setup

```powershell
cd "C:\Users\xyf_a\Documents\New project"
npm install
npx playwright install chromium
Copy-Item .env.example .env
notepad .env
```

Fill the required values in `.env`:

- `FIRST_NAME`
- `LAST_NAME`
- `DATE_OF_BIRTH`
- `PHONE`
- `EMAIL`

## Run

```powershell
npm start
```

The script enforces a minimum `POLL_SECONDS` value of 60 seconds.

## Notes

- The script does not bypass CAPTCHA, rate limits, eligibility rules, or final confirmation steps.
- The script does not click into the booking flow after it alerts.
- The script does not fill applicant information.
- The script does not click the final submit/confirm button.
