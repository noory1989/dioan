(function(root){
  const SECTION_KEYS = ['studies','tech','gov','legal','gov2'];

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

  const api = {
    clearArchiveTimingState,
    shouldRestartArchiveTimer,
    resetArchiveTransferState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ArchiveTransferState = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
