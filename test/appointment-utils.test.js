const assert = require('node:assert/strict');

const {
  bestTextMatch,
  buildWindowsPopupCommand,
  envToConfig,
  getLocationAvailabilityStatus,
  normalizeText,
} = require('../src/appointment-utils');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('normalizeText trims, lowercases, and removes punctuation noise', () => {
  assert.equal(
    normalizeText('  Louisville (Bowman) Regional Test Site-Written Test  '),
    'louisville bowman regional test site written test'
  );
});

runTest('bestTextMatch accepts case and punctuation differences', () => {
  const options = [
    'Frankfort Regional Testing Site - Written Test',
    'Louisville (Bowman) Regional Test Site-Written Test',
  ];

  assert.equal(
    bestTextMatch(options, 'louisville bowman regional test site written test'),
    'Louisville (Bowman) Regional Test Site-Written Test'
  );
});

runTest('bestTextMatch does not choose a different city just because common words match', () => {
  const options = [
    'Check Earliest Availability\nFor Bellevue Regional Testing Site - Written Test',
    'Check Earliest Availability\nFor Elizabethtown Regional Testing Site - Written Test',
  ];

  assert.equal(
    bestTextMatch(options, 'Louisville (Bowman) Regional Test Site-Written Test'),
    null
  );
});

runTest('bestTextMatch selects Louisville Bowman from earliest-availability button text', () => {
  const options = [
    'Check Earliest Availability\nFor Bellevue Regional Testing Site - Written Test',
    'Check Earliest Availability\nFor Louisville (Bowman) Regional Test Site-Written Test',
  ];

  assert.equal(
    bestTextMatch(options, 'Louisville (Bowman) Regional Test Site-Written Test'),
    'Check Earliest Availability\nFor Louisville (Bowman) Regional Test Site-Written Test'
  );
});

runTest('getLocationAvailabilityStatus detects target location with no availability', () => {
  const bodyText = [
    '+',
    '-',
    'London Regional Test Site- Written Test',
    'Get Directions',
    'Check Earliest Availability',
    'For London Regional Test Site- Written Test',
    'Louisville(Bowman) Regional Test Site-Written Test',
    '3501 Roger E. Schupp Street',
    'Louisville, KY 40205',
    'Get Directions',
    'No Availability',
    'Madisonville Regional Test Site-Written Test',
  ].join('\n');

  assert.equal(
    getLocationAvailabilityStatus(bodyText, 'Louisville (Bowman) Regional Test Site-Written Test'),
    'unavailable'
  );
});

runTest('getLocationAvailabilityStatus detects target location with selectable appointment', () => {
  const bodyText = [
    'Louisville(Bowman) Regional Test Site-Written Test',
    '3501 Roger E. Schupp Street',
    'Louisville, KY 40205',
    'Get Directions',
    'Check Earliest Availability',
    'For Louisville(Bowman) Regional Test Site-Written Test',
    'Select In Person Appointment',
    'for Louisville(Bowman) Regional Test Site-Written Test',
  ].join('\n');

  assert.equal(
    getLocationAvailabilityStatus(bodyText, 'Louisville (Bowman) Regional Test Site-Written Test'),
    'available'
  );
});

runTest('getLocationAvailabilityStatus detects available date text on target card', () => {
  const bodyText = [
    'Louisville(Bowman) Regional Test Site-Written Test',
    '3501 Roger E. Schupp Street',
    'Louisville, KY 40205',
    'Get Directions',
    'May 05, 1 available.',
    'Select In Person Appointment',
    'Madisonville Regional Test Site-Written Test',
  ].join('\n');

  assert.equal(
    getLocationAvailabilityStatus(bodyText, 'Louisville (Bowman) Regional Test Site-Written Test'),
    'available'
  );
});

runTest('envToConfig applies safe defaults for monitoring', () => {
  const config = envToConfig({});

  assert.equal(config.url, 'https://telegov.egov.com/KSP/AppointmentWizard');
  assert.equal(config.appointmentTypeText, 'Driver License, CDL or Motorcycle Written (Permit) Test');
  assert.equal(config.locationText, 'Louisville (Bowman) Regional Test Site-Written Test');
  assert.equal(config.pollSeconds, 60);
  assert.equal(config.headless, false);
});

runTest('envToConfig enforces a 60-second minimum poll interval', () => {
  const config = envToConfig({ POLL_SECONDS: '5' });
  assert.equal(config.pollSeconds, 60);
});

runTest('buildWindowsPopupCommand escapes single quotes for PowerShell', () => {
  const command = buildWindowsPopupCommand("Slot's available", 'KSP Alert');

  assert.match(command, /System\.Windows\.Forms/);
  assert.match(command, /Slot''s available/);
  assert.match(command, /KSP Alert/);
});
