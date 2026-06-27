(function(root){
  const SECTION_KEYS = ['studies','tech','gov','legal','gov2'];
  const ARCHIVE_SECTION_LABELS = {
    studies: 'الدراسات',
    tech: 'ديوان الشؤون الفنية',
    gov: 'الجهات الحكومية',
    legal: 'القانونية',
    gov2: 'أخرى'
  };

  function clearArchiveTimingState(item) {
    if (!item || typeof item !== 'object') return item;

    SECTION_KEYS.forEach((sectionKey) => {
      const sectionData = item[sectionKey];
      if (!sectionData || typeof sectionData !== 'object') return;

      ['savedAt','deadlineAt','durationStartedAt','expectedMinutes','startedAt'].forEach((fieldName) => {
        if (Object.prototype.hasOwnProperty.call(sectionData, fieldName)) {
          delete sectionData[fieldName];
        }
      });
    });

    if (item.status && String(item.status).includes('متأخرة')) {
      item.status = 'قيد العمل';
    }

    return item;
  }

  function shouldRestartArchiveTimer(item) {
    if (!item || typeof item !== 'object') return false;

    return SECTION_KEYS.some((sectionKey) => {
      const sectionData = item[sectionKey];
      const expected = sectionData && sectionData.expected;
      const value = expected && expected.value;
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  }

  function resetArchiveTransferState(item) {
    const cleared = clearArchiveTimingState(item);
    if (cleared && typeof cleared === 'object') {
      cleared.transferResetAt = new Date().toISOString();
    }
    return cleared;
  }

  function formatArchiveDelayDuration(delayMinutes) {
    const totalMinutes = Number(delayMinutes);
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0 دقيقة';

    const months = Math.floor(totalMinutes / (30 * 24 * 60));
    if (months >= 1) {
      const remainingMinutes = totalMinutes % (30 * 24 * 60);
      if (remainingMinutes === 0) return '1 شهر';
      return `${months} شهر`; 
    }

    const weeks = Math.floor(totalMinutes / (7 * 24 * 60));
    if (weeks >= 1) {
      const remainingMinutes = totalMinutes % (7 * 24 * 60);
      if (remainingMinutes === 0) return '1 أسبوع';
      return `${weeks} أسبوع`; 
    }

    const days = Math.floor(totalMinutes / (24 * 60));
    if (days >= 1) {
      const remainingMinutes = totalMinutes % (24 * 60);
      if (remainingMinutes === 0) return '1 يوم';
      return `${days} يوم`; 
    }

    const hours = Math.floor(totalMinutes / 60);
    if (hours >= 1) {
      const remainingMinutes = totalMinutes % 60;
      if (remainingMinutes === 0) return '1 ساعة';
      return `${hours} ساعة`; 
    }

    return `${totalMinutes} دقيقة`;
  }

  function resolveArchiveDepartmentForDisplay(item) {
    if (!item || typeof item !== 'object') return '';

    const explicitDepartment = [
      item.lastTransferredTo,
      item.currentDepartment,
      item.department,
      item.currentDepartmentName,
      item.circleName,
      item.previousDepartment,
      item.previousLocation,
      item.lastTransferredFrom
    ].find((value) => value !== undefined && value !== null && String(value).trim() !== '');

    if (explicitDepartment) {
      return String(explicitDepartment).trim();
    }

    const sectionOrder = ['studies','tech','gov','legal','gov2'];
    for (const sectionKey of sectionOrder) {
      const sectionData = item[sectionKey];
      const expected = sectionData && sectionData.expected;
      const savedAt = sectionData && sectionData.savedAt;
      if (!expected || !savedAt) continue;
      const minutes = Number(expected.value);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      return ARCHIVE_SECTION_LABELS[sectionKey] || '';
    }

    return '';
  }

  function convertArchiveExpectedToMinutes(expected) {
    if (!expected || typeof expected !== 'object') return 0;

    const value = Number(expected.value);
    if (!Number.isFinite(value) || value <= 0) return 0;

    const unit = String(expected.unit || expected.valueUnit || '').trim().toLowerCase();
    if (unit === 'minutes' || unit === 'minute' || unit === 'دقيقة') return value;
    if (unit === 'hours' || unit === 'hour' || unit === 'ساعة') return value * 60;
    if (unit === 'days' || unit === 'day' || unit === 'يوم') return value * 24 * 60;
    if (unit === 'weeks' || unit === 'week' || unit === 'أسبوع') return value * 7 * 24 * 60;
    if (unit === 'months' || unit === 'month' || unit === 'شهر') return value * 30 * 24 * 60;

    return value;
  }

  function deriveArchiveStatusInfo(item, now = Date.now()) {
    if (!item || typeof item !== 'object') return { base: 'قيد العمل', department: '' };

    const explicitDepartment = [
      item.lastTransferredTo,
      item.currentDepartment,
      item.department,
      item.currentDepartmentName,
      item.circleName,
      item.previousDepartment,
      item.previousLocation,
      item.lastTransferredFrom
    ].find((value) => value !== undefined && value !== null && String(value).trim() !== '');

    const normalizedDepartment = String(explicitDepartment || '').trim();
    const statusText = String(item.status || '').trim();
    if (statusText.includes('منتهية') || statusText === 'منتهي' || statusText === 'finished') {
      return { base: 'منتهية', department: normalizedDepartment };
    }

    const sectionOrder = ['studies','tech','gov','legal','gov2'];
    let hasActiveWorkflow = false;
    for (const sectionKey of sectionOrder) {
      const sectionData = item[sectionKey];
      const expected = sectionData && sectionData.expected;
      const savedAt = sectionData && sectionData.savedAt;
      if (!expected || !savedAt) continue;

      hasActiveWorkflow = true;
      const expectedMinutes = convertArchiveExpectedToMinutes(expected);
      if (expectedMinutes <= 0) continue;

      const savedTimestamp = new Date(savedAt).getTime();
      if (!Number.isFinite(savedTimestamp)) continue;

      const deadlineMs = savedTimestamp + expectedMinutes * 60 * 1000;
      if (now >= deadlineMs) {
        return { base: 'متأخرة', department: normalizedDepartment || ARCHIVE_SECTION_LABELS[sectionKey] || '' };
      }
    }

    if (hasActiveWorkflow) {
      return { base: 'قيد العمل', department: normalizedDepartment };
    }

    if (normalizedDepartment) {
      return { base: 'تم الاستلام', department: normalizedDepartment };
    }

    return { base: 'قيد العمل', department: '' };
  }

  function resolveArchiveOverdueDepartmentForDisplay(item, now = Date.now()) {
    if (!item || typeof item !== 'object') return '';
    const statusInfo = deriveArchiveStatusInfo(item, now);
    return statusInfo.base === 'متأخرة' ? statusInfo.department : '';
  }

  const api = {
    clearArchiveTimingState,
    shouldRestartArchiveTimer,
    resetArchiveTransferState,
    formatArchiveDelayDuration,
    resolveArchiveDepartmentForDisplay,
    resolveArchiveOverdueDepartmentForDisplay,
    deriveArchiveStatusInfo
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ArchiveTransferState = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
