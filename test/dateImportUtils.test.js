const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDateString, normalizeImportedDateValue } = require('../public/js/dateImportUtils');

test('parses Excel-like dates without timezone shifts', () => {
  const parsed = parseDateString('2024-03-05');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.getFullYear(), 2024);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 5);
});

test('keeps blank date cells empty instead of inventing a date', () => {
  assert.equal(normalizeImportedDateValue(''), null);
  assert.equal(normalizeImportedDateValue('   '), null);
  assert.equal(normalizeImportedDateValue('2024/03/05'), '2024-03-05');
});
