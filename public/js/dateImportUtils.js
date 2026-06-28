const parseDateString = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  const m2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) {
    const p1 = Number(m2[1]);
    const p2 = Number(m2[2]);
    const p3 = Number(m2[3]);
    if (p1 > 12 && p2 <= 12) return new Date(p3, p2 - 1, p1);
    if (p2 > 12 && p1 <= 12) return new Date(p3, p1 - 1, p2);
    return null;
  }

  const d1 = Date.parse(str);
  if (!Number.isNaN(d1)) return new Date(d1);
  return null;
};

const formatImportedDateValue = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = parseDateString(str);
  if (parsed) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }
  return str;
};

const formatDateForDisplay = (value) => {
  const formatted = formatImportedDateValue(value);
  if (formatted === null || formatted === undefined || formatted === '') return '-';
  return formatted;
};

const normalizeImportedDateValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return formatImportedDateValue(value);
};

if (typeof module !== 'undefined') {
  module.exports = {
    parseDateString,
    formatImportedDateValue,
    formatDateForDisplay,
    normalizeImportedDateValue,
  };
}

if (typeof window !== 'undefined') {
  window.parseDateString = parseDateString;
  window.formatImportedDateValue = formatImportedDateValue;
  window.formatDateForDisplay = formatDateForDisplay;
  window.normalizeImportedDateValue = normalizeImportedDateValue;
}
