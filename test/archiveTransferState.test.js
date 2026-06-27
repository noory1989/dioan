const test = require('node:test');
const assert = require('node:assert/strict');
const { clearArchiveTimingState, formatArchiveDelayDuration, resolveArchiveDepartmentForDisplay, resolveArchiveOverdueDepartmentForDisplay, deriveArchiveStatusInfo } = require('../public/js/archiveTransferState');

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

test('formatArchiveDelayDuration converts delay thresholds into larger units', () => {
  assert.equal(formatArchiveDelayDuration(30), '30 دقيقة');
  assert.equal(formatArchiveDelayDuration(60), '1 ساعة');
  assert.equal(formatArchiveDelayDuration(1440), '1 يوم');
  assert.equal(formatArchiveDelayDuration(43200), '1 شهر');
  assert.equal(formatArchiveDelayDuration(90), '1 ساعة و 30 دقيقة');
  assert.equal(formatArchiveDelayDuration(1500), '1 يوم و 1 ساعة');
  assert.equal(formatArchiveDelayDuration(2160), '1 يوم و 12 ساعة');
  assert.equal(formatArchiveDelayDuration(44640), '1 شهر و 1 يوم');
});

test('resolveArchiveDepartmentForDisplay prefers the current archive department over the first overdue section', () => {
  const item = {
    currentDepartment: 'الديوان العام',
    studies: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'days' } },
    tech: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'days' } }
  };

  assert.equal(resolveArchiveDepartmentForDisplay(item), 'الديوان العام');
});

test('resolveArchiveDepartmentForDisplay uses the last transferred circle as the current department', () => {
  const item = {
    currentDepartment: 'الدائرة القديمة',
    lastTransferredTo: 'الدائرة الجديدة',
    studies: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'days' } }
  };

  assert.equal(resolveArchiveDepartmentForDisplay(item), 'الدائرة الجديدة');
});

test('resolveArchiveOverdueDepartmentForDisplay only returns a department after the deadline has actually passed', () => {
  const item = {
    currentDepartment: 'الدائرة الحالية',
    studies: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'minute' } }
  };

  assert.equal(resolveArchiveOverdueDepartmentForDisplay(item, new Date('2024-01-01T00:00:59.000Z').getTime()), '');
  assert.equal(resolveArchiveOverdueDepartmentForDisplay(item, new Date('2024-01-01T00:01:01.000Z').getTime()), 'الدائرة الحالية');
});

test('deriveArchiveStatusInfo returns received, in-progress, overdue, and finished states based on workflow data', () => {
  const receivedItem = { currentDepartment: 'الدائرة الحالية' };
  assert.deepEqual(deriveArchiveStatusInfo(receivedItem, new Date('2024-01-01T00:00:00.000Z').getTime()), {
    base: 'تم الاستلام',
    department: 'الدائرة الحالية'
  });

  const activeItem = {
    currentDepartment: 'الدائرة الحالية',
    studies: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'minute' } }
  };
  assert.deepEqual(deriveArchiveStatusInfo(activeItem, new Date('2024-01-01T00:00:30.000Z').getTime()), {
    base: 'قيد العمل',
    department: 'الدائرة الحالية'
  });

  const overdueItem = {
    currentDepartment: 'الدائرة الحالية',
    studies: { savedAt: '2024-01-01T00:00:00.000Z', expected: { value: 1, unit: 'minute' } }
  };
  assert.deepEqual(deriveArchiveStatusInfo(overdueItem, new Date('2024-01-01T00:01:30.000Z').getTime()), {
    base: 'متأخرة',
    department: 'الدائرة الحالية'
  });

  const finishedItem = { status: 'منتهية', currentDepartment: 'الدائرة الحالية' };
  assert.deepEqual(deriveArchiveStatusInfo(finishedItem, new Date('2024-01-01T00:02:00.000Z').getTime()), {
    base: 'منتهية',
    department: 'الدائرة الحالية'
  });
});
