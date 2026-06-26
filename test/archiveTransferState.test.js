const test = require('node:test');
const assert = require('node:assert/strict');
const { clearArchiveTimingState } = require('../public/js/archiveTransferState');

test('clearArchiveTimingState removes saved timing data while preserving expected durations', () => {
  const item = {
    id: 99,
    status: 'متأخرة',
    studies: {
      savedAt: '2024-01-01T00:00:00.000Z',
      expected: { value: 3, unit: 'days' }
    },
    tech: {
      savedAt: '2024-01-02T00:00:00.000Z',
      expected: { value: 5, unit: 'days' }
    }
  };

  clearArchiveTimingState(item);

  assert.equal(item.studies.savedAt, undefined);
  assert.equal(item.tech.savedAt, undefined);
  assert.equal(item.studies.expected.value, 3);
  assert.equal(item.tech.expected.value, 5);
  assert.equal(item.status, 'قيد العمل');
});

test('clearArchiveTimingState is safe for items without timing sections', () => {
  const item = { id: 100, status: 'قيد العمل' };
  assert.doesNotThrow(() => clearArchiveTimingState(item));
  assert.equal(item.status, 'قيد العمل');
});
