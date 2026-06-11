// Dashboard interactions: date, tabs, outgoing table, inline form
document.addEventListener('DOMContentLoaded', async () => {
  const dateEl = document.getElementById('current-date');
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  dateEl.textContent = formatter.format(now);

  // Tabs behavior: toggle active class and content
  const tabs = document.querySelectorAll('.tab');
  const statsSection = document.getElementById('dashboardStats');
  const statIncomingEl = document.getElementById('statIncoming');
  const statOutgoingEl = document.getElementById('statOutgoing');
  const statReceptionEl = document.getElementById('statReception');
  const statTotalEl = document.getElementById('statTotal');
  // ensure initial view: show stats, hide all tab contents
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  if (statsSection) statsSection.style.display = '';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.getAttribute('data-tab');
      // If outgoing selected, show outgoing and hide stats
      if (key === 'outgoing'){
        if (statsSection) statsSection.style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(c => { if (c.id === key) c.style.display = ''; else c.style.display = 'none'; });
      } else {
        // other tabs: hide outgoing and show stats by default (or their content if implemented)
        document.querySelectorAll('.tab-content').forEach(c => { if (c.id === key) c.style.display = ''; else c.style.display = 'none'; });
        // if the selected tab has no content, show main stats
        const selected = document.getElementById(key);
        if (!selected || selected.innerHTML.trim() === ''){
          if (statsSection) statsSection.style.display = '';
        } else {
          if (statsSection) statsSection.style.display = 'none';
        }
      }
    });
  });

  // Outgoing tab elements
  const resetBtn = document.getElementById('resetFormBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const form = document.getElementById('outgoingForm');
  const outgoingAddAttachmentBtn = document.getElementById('outgoingAddAttachment');
  const outgoingAttachmentInput = document.getElementById('outgoingAttachmentInput');
  const outgoingPreviewEl = document.getElementById('outgoingPreview');
  const outgoingImportBtn = document.getElementById('outgoingImportBtn');
  const outgoingExportBtn = document.getElementById('outgoingExportBtn');
  const outgoingImportInput = document.getElementById('outgoingImportInput');
  const outgoingDeleteSelectedBtn = document.getElementById('outgoingDeleteSelectedBtn');
  const selectAllOutgoingCheckbox = document.getElementById('selectAllOutgoing');
  const tableBody = document.querySelector('#outgoingTable tbody');
  const searchInput = document.getElementById('searchOutgoing');

  // Incoming tab elements
  const resetIncomingBtn = document.getElementById('resetIncomingBtn');
  const cancelIncomingBtn = document.getElementById('cancelIncomingBtn');
  const incomingForm = document.getElementById('incomingForm');
  const incomingAddAttachmentBtn = document.getElementById('incomingAddAttachment');
  const incomingAttachmentInput = document.getElementById('incomingAttachmentInput');
  const incomingPreviewEl = document.getElementById('incomingPreview');
  const incomingImportBtn = document.getElementById('incomingImportBtn');
  const incomingExportBtn = document.getElementById('incomingExportBtn');
  const incomingImportInput = document.getElementById('incomingImportInput');
  const incomingDeleteSelectedBtn = document.getElementById('incomingDeleteSelectedBtn');
  const selectAllIncomingCheckbox = document.getElementById('selectAllIncoming');
  const incomingTableBody = document.querySelector('#incomingTable tbody');
  const searchInputIncoming = document.getElementById('searchIncoming');

  // Reception tab elements
  const resetReceptionBtn = document.getElementById('resetReceptionBtn');
  const cancelReceptionBtn = document.getElementById('cancelReceptionBtn');
  const receptionForm = document.getElementById('receptionForm');
  const recAddAttachmentBtn = document.getElementById('recAddAttachment');
  const recAttachmentInput = document.getElementById('recAttachmentInput');
  const recPreviewEl = document.getElementById('recPreview');
  const receptionImportBtn = document.getElementById('receptionImportBtn');
  const receptionExportBtn = document.getElementById('receptionExportBtn');
  const receptionImportInput = document.getElementById('receptionImportInput');
  const receptionDeleteSelectedBtn = document.getElementById('receptionDeleteSelectedBtn');
  const selectAllReceptionCheckbox = document.getElementById('selectAllReception');
  const receptionTableBody = document.querySelector('#receptionTable tbody');
  const searchInputReception = document.getElementById('searchReception');

  const attachmentsModal = document.getElementById('attachmentsModal');
  const attachmentsModalBody = document.getElementById('attachmentsModalBody');
  const closeAttachmentsModal = document.getElementById('closeAttachmentsModal');

  const API_BASE = '/api';

  const parseAttachments = (attachments) => {
    if (Array.isArray(attachments)) return attachments;
    if (typeof attachments === 'string' && attachments) {
      try {
        return JSON.parse(attachments);
      } catch (error) {
        return [];
      }
    }
    return [];
  };

  const LOCAL_STORAGE_KEYS = {
    outgoing: 'diwan_outgoing_backup',
    incoming: 'diwan_incoming_backup',
    reception: 'diwan_reception_backup',
  };

  const saveLocalBackup = (key, items) => {
    try {
      localStorage.setItem(key, JSON.stringify(items || []));
    } catch (err) {
      console.warn('Local backup save failed', err);
    }
  };

  const loadLocalBackup = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Local backup load failed', err);
      return null;
    }
  };

  const useLocalBackupIfEmpty = (items, key, seed = []) => {
    if (Array.isArray(items) && items.length > 0) return items;
    const backup = loadLocalBackup(key);
    if (Array.isArray(backup) && backup.length > 0) return backup;
    return seed;
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText || `HTTP ${response.status}`);
    }
    return response.json();
  };

  const localSeedOutgoing = [
    { serial: 1254, date: '2026-06-01', recipient: 'مديرية الصحة', subject: 'طلب تعاون', oldNo: '', oldDate: '', transfer: 'قسم الأرشيف', newNo: '', newDate: '', attachments: [] },
    { serial: 1255, date: '2026-06-02', recipient: 'الأمانة', subject: 'إعلام', oldNo: 'INV-2025-88', oldDate: '2025-12-10', transfer: 'الأرشيف', newNo: 'IN-2026-001', newDate: '2026-06-02', attachments: [] }
  ];
  const localSeedIncoming = [];
  const localSeedReception = [];

  let items = [];
  let itemsIncoming = [];
  let itemsReception = [];

  const load = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/outgoing`);
      items = data.map(item => ({ ...item, attachments: parseAttachments(item.attachments) }));
    } catch (error) {
      console.warn('Load outgoing failed:', error);
      items = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.outgoing, localSeedOutgoing);
      alert('تعذر الاتصال بخادم الكتب الصادرة. يتم استخدام بيانات محلية مؤقتة.');
    }
  };

  const loadIncoming = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/incoming`);
      itemsIncoming = data.map(item => ({ ...item, attachments: parseAttachments(item.attachments) }));
    } catch (error) {
      console.warn('Load incoming failed:', error);
      itemsIncoming = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.incoming, localSeedIncoming);
      alert('تعذر الاتصال بخادم الكتب الواردة. يتم استخدام بيانات محلية مؤقتة.');
    }
  };

  const loadReception = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/reception`);
      itemsReception = data.map(item => ({ ...item, attachments: parseAttachments(item.attachments) }));
    } catch (error) {
      console.warn('Load reception failed:', error);
      itemsReception = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.reception, localSeedReception);
      alert('تعذر الاتصال بخادم الاستقبال والشكاوى. يتم استخدام بيانات محلية مؤقتة.');
    }
  };

  const preparePayloadForSave = (payload) => {
    const data = { ...payload };
    if (Array.isArray(data.attachments)) {
      data.attachments = JSON.stringify(data.attachments);
    } else if (!data.attachments) {
      data.attachments = JSON.stringify([]);
    }
    return data;
  };

  const saveToServer = async (endpoint, payload, method = 'POST') => {
    return await fetchJson(endpoint, {
      method,
      body: JSON.stringify(preparePayloadForSave(payload)),
    });
  };

  const deleteFromServer = async (endpoint) => {
    return await fetchJson(endpoint, { method: 'DELETE' });
  };

  const bulkSaveToServer = async (endpoint, payloads) => {
    return await fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(payloads.map(preparePayloadForSave)),
    });
  };

  const outgoingHeaders = {
    serial: 'الرقم المتسلسل',
    date: 'التاريخ',
    recipient: 'الجهة الصادر إليها',
    subject: 'المضمون',
    oldNo: 'الرقم الوارد القديم',
    oldDate: 'تاريخ الوارد القديم',
    transfer: 'التحويل',
    newNo: 'الرقم الوارد الجديد',
    newDate: 'تاريخ الوارد الجديد'
  };

  const incomingHeaders = {
    arrivePlace: 'مكان الورود',
    arriveNo: 'رقم الورود',
    arriveDate: 'تاريخ الورود',
    inNo: 'رقم الوارد',
    inDate: 'تاريخ الوارد',
    requesterName: 'اسم صاحب الطلب',
    requestType: 'نوع الطلب',
    subject: 'المضمون',
    phone: 'رقم الهاتف',
    transferTo: 'التحويل إلى',
    outNo: 'رقم الصادر',
    sender: 'الجهة المرسل إليها',
    notes: 'الملاحظات'
  };

  const receptionHeaders = {
    name: 'الاسم الثلاثي',
    category: 'الفئة',
    qualification: 'المؤهل العلمي',
    request: 'الطلب',
    subject: 'مضمون الطلب',
    submissionDate: 'تاريخ تقديم الطلب',
    requestNo: 'رقم الطلب',
    address: 'العنوان',
    phone: 'رقم الاتصال',
    nationalId: 'الرقم الوطني',
    result1: 'النتيجة 1',
    result2: 'النتيجة 2',
    result3: 'النتيجة 3',
    result4: 'النتيجة 4',
    notes: 'الملاحظات',
    out1: 'صادر 1',
    in2: 'وارد 2',
    out2: 'صادر 2',
    in3: 'وارد 3',
    out3: 'صادر 3'
  };

  const normalizeHeader = (header) => {
    if (header === undefined || header === null) return '';
    return header.toString().trim()
      .replace(/\uFEFF/g, '')
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\u200c/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ـ/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([0-9]+)\s*/g, '$1')
      .replace(/[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF ]+/g, '')
      .toLowerCase();
  };

  const headerSynonyms = {
    [normalizeHeader('الاسم الثلاثي')]: 'name',
    [normalizeHeader('الاسم الكامل')]: 'name',
    [normalizeHeader('الاسم')]: 'name',
    [normalizeHeader('المتقدم')]: 'name',
    [normalizeHeader('الموضوع')]: 'subject',
    [normalizeHeader('المضمون')]: 'subject',
    [normalizeHeader('مضمون الطلب')]: 'subject',
    [normalizeHeader('موضوع الطلب')]: 'subject',
    [normalizeHeader('الطلب')]: 'request',
    [normalizeHeader('الفئة')]: 'category',
    [normalizeHeader('المؤهل العلمي')]: 'qualification',
    [normalizeHeader('المؤهل')]: 'qualification',
    [normalizeHeader('تاريخ التقديم')]: 'submissionDate',
    [normalizeHeader('تاريخ تقديم الطلب')]: 'submissionDate',
    [normalizeHeader('رقم الطلب')]: 'requestNo',
    [normalizeHeader('العنوان')]: 'address',
    [normalizeHeader('رقم الاتصال')]: 'phone',
    [normalizeHeader('رقم الهاتف')]: 'phone',
    [normalizeHeader('رقم الجوال')]: 'phone',
    [normalizeHeader('الهاتف')]: 'phone',
    [normalizeHeader('الجوال')]: 'phone',
    [normalizeHeader('الرقم الوطني')]: 'nationalId',
    [normalizeHeader('الرقم القومي')]: 'nationalId',
    [normalizeHeader('النتيجة 1')]: 'result1',
    [normalizeHeader('النتيجة1')]: 'result1',
    [normalizeHeader('النتيجة 2')]: 'result2',
    [normalizeHeader('النتيجة2')]: 'result2',
    [normalizeHeader('النتيجة 3')]: 'result3',
    [normalizeHeader('النتيجة3')]: 'result3',
    [normalizeHeader('النتيجة 4')]: 'result4',
    [normalizeHeader('النتيجة4')]: 'result4',
    [normalizeHeader('الملاحظات')]: 'notes',
    [normalizeHeader('الملاحظة')]: 'notes',
    [normalizeHeader('صادر 1')]: 'out1',
    [normalizeHeader('صادر1')]: 'out1',
    [normalizeHeader('وارد 2')]: 'in2',
    [normalizeHeader('وارد2')]: 'in2',
    [normalizeHeader('صادر 2')]: 'out2',
    [normalizeHeader('صادر2')]: 'out2',
    [normalizeHeader('وارد 3')]: 'in3',
    [normalizeHeader('وارد3')]: 'in3',
    [normalizeHeader('صادر 3')]: 'out3',
    [normalizeHeader('صادر3')]: 'out3',
    [normalizeHeader('مكان الورود')]: 'arrivePlace',
    [normalizeHeader('رقم الورود')]: 'arriveNo',
    [normalizeHeader('تاريخ الورود')]: 'arriveDate',
    [normalizeHeader('رقم الوارد')]: 'inNo',
    [normalizeHeader('تاريخ الوارد')]: 'inDate',
    [normalizeHeader('اسم صاحب الطلب')]: 'requesterName',
    [normalizeHeader('نوع الطلب')]: 'requestType',
    [normalizeHeader('التحويل إلى')]: 'transferTo',
    [normalizeHeader('رقم الصادر')]: 'outNo',
    [normalizeHeader('الجهة المرسل إليها')]: 'sender',
    [normalizeHeader('الجهة الصادر إليها')]: 'recipient',
    [normalizeHeader('التحويل')]: 'transfer',
    [normalizeHeader('الرقم الوارد القديم')]: 'oldNo',
    [normalizeHeader('تاريخ الوارد القديم')]: 'oldDate',
    [normalizeHeader('الرقم الوارد الجديد')]: 'newNo',
    [normalizeHeader('تاريخ الوارد الجديد')]: 'newDate'
  };

  const findHeaderKey = (normalizedLabel, headerKeyMap) => {
    if (!normalizedLabel) return undefined;
    if (headerKeyMap[normalizedLabel]) return headerKeyMap[normalizedLabel];
    if (headerSynonyms[normalizedLabel]) return headerSynonyms[normalizedLabel];
    const match = Object.keys(headerKeyMap).find(keyNorm => keyNorm.includes(normalizedLabel) || normalizedLabel.includes(keyNorm));
    if (match) return headerKeyMap[match];
    const synonymMatch = Object.keys(headerSynonyms).find(keyNorm => keyNorm.includes(normalizedLabel) || normalizedLabel.includes(keyNorm));
    if (synonymMatch) return headerSynonyms[synonymMatch];
    return guessHeaderKeyByKeyword(normalizedLabel);
  };

  const buildHeaderKeyMap = (headers) => {
    const map = {};
    Object.entries(headers).forEach(([key, label]) => {
      const normalizedLabel = normalizeHeader(label);
      const normalizedKey = normalizeHeader(key);
      if (normalizedLabel) map[normalizedLabel] = key;
      if (normalizedKey) map[normalizedKey] = key;
    });
    return map;
  };

  const guessHeaderKeyByKeyword = (normalizedLabel) => {
    if (!normalizedLabel) return undefined;
    if (/اسم|متقدم|طالب|شاكي/.test(normalizedLabel)) return 'name';
    if (/فئه|فئة/.test(normalizedLabel)) return 'category';
    if (/مؤهل/.test(normalizedLabel)) return 'qualification';
    if (/نوع الطلب|نوع الشكوى/.test(normalizedLabel)) return 'requestType';
    if (/مضمون|موضوع/.test(normalizedLabel)) return 'subject';
    if (/الطلب/.test(normalizedLabel)) return 'request';
    if (/تاريخ تقديم|تاريخ الطلب|تقديم الطلب/.test(normalizedLabel)) return 'submissionDate';
    if (/رقم الطلب|رقم الشكوى/.test(normalizedLabel)) return 'requestNo';
    if (/العنوان/.test(normalizedLabel)) return 'address';
    if (/هاتف|جوال|رقم الاتصال|رقم التواصل|تليفون/.test(normalizedLabel)) return 'phone';
    if (/وطني|قومي|هوية/.test(normalizedLabel)) return 'nationalId';
    if (/النتيجة.*1|نتيجة.*1|1/.test(normalizedLabel) && normalizedLabel.includes('نتيجة')) return 'result1';
    if (/النتيجة.*2|نتيجة.*2|2/.test(normalizedLabel) && normalizedLabel.includes('نتيجة')) return 'result2';
    if (/النتيجة.*3|نتيجة.*3|3/.test(normalizedLabel) && normalizedLabel.includes('نتيجة')) return 'result3';
    if (/النتيجة.*4|نتيجة.*4|4/.test(normalizedLabel) && normalizedLabel.includes('نتيجة')) return 'result4';
    if (/ملاحظة|ملاحظات/.test(normalizedLabel)) return 'notes';
    if (/جهة المرسل|المرسل إليها/.test(normalizedLabel)) return 'sender';
    if (/جهة الصادر|الصادر إليها/.test(normalizedLabel)) return 'recipient';
    if (/التحويل/.test(normalizedLabel)) return 'transfer';
    if (/رقم الوارد القديم/.test(normalizedLabel)) return 'oldNo';
    if (/تاريخ الوارد القديم/.test(normalizedLabel)) return 'oldDate';
    if (/رقم الوارد الجديد/.test(normalizedLabel)) return 'newNo';
    if (/تاريخ الوارد الجديد/.test(normalizedLabel)) return 'newDate';
    if (/مكان الورود/.test(normalizedLabel)) return 'arrivePlace';
    if (/رقم الورود/.test(normalizedLabel)) return 'arriveNo';
    if (/تاريخ الورود/.test(normalizedLabel)) return 'arriveDate';
    if (/رقم الوارد/.test(normalizedLabel) && !/قديم|جديد/.test(normalizedLabel)) return 'inNo';
    if (/تاريخ الوارد/.test(normalizedLabel) && !/قديم|جديد/.test(normalizedLabel)) return 'inDate';
    if (/رقم الصادر/.test(normalizedLabel)) return 'outNo';
    return undefined;
  };

  const updateDashboardStats = () => {
    if (statIncomingEl) statIncomingEl.textContent = itemsIncoming.length;
    if (statOutgoingEl) statOutgoingEl.textContent = items.length;
    if (statReceptionEl) statReceptionEl.textContent = itemsReception.length;
    if (statTotalEl) statTotalEl.textContent = items.length + itemsIncoming.length + itemsReception.length;
  };

  const circles = [
    'مكتب السيد المدير', 'الرقابة الداخلية', 'التخطيط والمتابعة', 'الآليات', 'المكتب الإعلامي', 'ديوان الشؤون الفنية',
    'النفايات الصلبة', 'الدراسات', 'الطرق', 'تنفيذ الأبنية', 'التخطيط العمراني', 'المعلوماتية', 'الطبوغرافيا',
    'الديوان العام', 'الموارد البشرية', 'التدريب والتأهيل', 'المالية', 'القانونية', 'الاستثمارية', 'الجاهزية',
    'لجنة الشراء', 'المستودع', 'المتابعة'
  ];

  const getNotificationsForCircle = (circleName) => {
    if (!circleName) return [];
    const nameNorm = circleName.toString().trim().toLowerCase();
    const matches = itemsIncoming.filter(it => {
      const fields = [it.transferTo, it.sender, it.subject, it.notes].filter(Boolean).join(' ').toLowerCase();
      return fields.includes(nameNorm);
    });
    return matches;
  };

  const renderCircles = () => {
    const container = document.getElementById('circlesContainer');
    if (!container) return;
    container.innerHTML = '';
    circles.forEach(name => {
      const card = document.createElement('div');
      card.className = 'circle-card';
      const count = getNotificationsForCircle(name).length;
      card.innerHTML = `<div class="circle-name">${name}</div><div class="circle-badge">${count}</div>`;
      card.addEventListener('click', () => openCircleModal(name));
      container.appendChild(card);
    });
  };

  const openCircleModal = (name) => {
    const modal = document.getElementById('circleModal');
    const title = document.getElementById('circleModalTitle');
    const bodyList = document.getElementById('circleNotifList');
    const countEl = document.getElementById('circleNotifCount');
    if (!modal || !title || !bodyList) return;
    title.textContent = name;
    const matches = getNotificationsForCircle(name);
    countEl.textContent = matches.length;
    bodyList.innerHTML = '';
    if (!matches.length){
      bodyList.innerHTML = '<div>لا توجد إشعارات حالياً.</div>';
    } else {
      matches.slice(0,50).forEach(it => {
        const item = document.createElement('div');
        item.className = 'notif-item';
        const left = document.createElement('div'); left.innerHTML = `<div class="subject">${it.subject || '-'} </div><div class="meta">${it.inDate || it.arriveDate || it.date || ''}</div>`;
        const right = document.createElement('div'); right.innerHTML = `<div class="from">${it.sender || it.transferTo || '-'}</div>`;
        item.appendChild(left); item.appendChild(right);
        item.addEventListener('click', () => {
          alert('فتح السجل:\n' + (it.subject || 'بدون عنوان'));
        });
        bodyList.appendChild(item);
      });
    }
    modal.classList.remove('hidden');
  };

  const closeCircleModalBtn = document.getElementById('closeCircleModal');
  if (closeCircleModalBtn) closeCircleModalBtn.addEventListener('click', () => {
    const modal = document.getElementById('circleModal'); if (modal) modal.classList.add('hidden');
  });


  const outgoingHeaderMap = buildHeaderKeyMap(outgoingHeaders);
  const incomingHeaderMap = buildHeaderKeyMap(incomingHeaders);
  const receptionHeaderMap = buildHeaderKeyMap(receptionHeaders);

  const createExportRows = (data, headers) => {
    const headerKeys = Object.keys(headers);
    const headerLabels = Object.values(headers);
    const rows = [headerLabels];
    data.forEach(item => {
      rows.push(headerKeys.map(key => item[key] !== undefined ? item[key] : ''));
    });
    return rows;
  };

  const updateSelectAllCheckboxState = (selectAllEl, rows) => {
    if (!selectAllEl) return;
    const visibleRows = rows || [];
    const selectedCount = visibleRows.filter(it => it._selected).length;
    selectAllEl.checked = visibleRows.length > 0 && selectedCount === visibleRows.length;
    selectAllEl.indeterminate = selectedCount > 0 && selectedCount < visibleRows.length;
  };

  const toggleSelectionForVisibleRows = (rows, value) => {
    rows.forEach(it => {
      it._selected = value;
    });
  };

  const exportDataToExcel = (data, headers, filename) => {
    if (!window.XLSX) {
      alert('مكتبة XLSX غير متوفرة. تأكد من وجود الاتصال بالإنترنت أو أن الصفحة تحمل المكتبة.');
      return;
    }
    const rows = createExportRows(data, headers);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    try {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export error', error);
      alert('حدث خطأ أثناء تصدير ملف الإكسل. تحقق من المتصفح وحاول مرة أخرى.');
    }
  };

  const importExcelFile = (file, headerKeyMap, callback) => {
    if (!window.XLSX) {
      alert('مكتبة XLSX غير متوفرة. تأكد من أن الصفحة تحمل المكتبة قبل محاولة الاستيراد.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = (event) => {
      console.error('FileReader error', event);
      alert('حدث خطأ عند قراءة ملف الإكسل. تأكد من أن الملف صالح وحاول مرة أخرى.');
    };
    reader.onload = (event) => {
      const processWorkbook = (workbook) => {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          alert('تعذر قراءة الورقة الأولى من ملف الإكسل.');
          return;
        }
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (rows.length < 2) {
          alert('ملف الإكسل لا يحتوي على بيانات للاستيراد.');
          return;
        }

        const headerSearchRows = rows.slice(0, 5);
        let headerRowIndex = 0;
        let bestMatch = { index: 0, matched: 0, keyMap: [] };

        headerSearchRows.forEach((row, index) => {
          const headerLabels = row.map(cell => normalizeHeader(cell));
          const keyMap = headerLabels.map(label => findHeaderKey(label, headerKeyMap));
          const matched = keyMap.filter(k => typeof k === 'string').length;
          if (matched > bestMatch.matched) {
            bestMatch = { index, matched, keyMap };
          }
        });

        if (!bestMatch.matched) {
          alert('لم يتم التعرف على رؤوس الأعمدة في ملف الإكسل. تأكد من أن العناوين مطابقة للحقول الموجودة في السجل.');
          return;
        }

        headerRowIndex = bestMatch.index;
        const keyMap = bestMatch.keyMap;
        const importedItems = [];

        rows.slice(headerRowIndex + 1).forEach(row => {
          if (!Array.isArray(row) || row.every(cell => String(cell).trim() === '')) return;
          const item = {};
          row.forEach((cell, index) => {
            const key = keyMap[index];
            if (!key) return;
            item[key] = cell instanceof Date ? cell.toISOString().slice(0, 10) : cell;
          });
          item.attachments = [];
          importedItems.push(item);
        });
        callback(importedItems);
      };

      try {
        const arrayBuffer = event.target.result;
        let workbook;
        try {
          workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } catch (firstError) {
          console.warn('XLSX read array failed, trying binary fallback', firstError);
          const data = new Uint8Array(arrayBuffer);
          const binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
          workbook = XLSX.read(binary, { type: 'binary' });
        }
        processWorkbook(workbook);
      } catch (error) {
        console.error('XLSX processing error', error);
        alert('حدث خطأ عند معالجة ملف الإكسل. تأكد من أن الملف يحتوي على جدول صالح.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelImport = (file, headerMap, targetArray, saveFn, renderFn, filterValue, label) => {
    importExcelFile(file, headerMap, (importedItems) => {
      if (!importedItems.length) {
        alert('لم يتم العثور على سجلات جديدة للاستيراد.');
        return;
      }
      targetArray.push(...importedItems);
      saveFn();
      renderFn(filterValue);
      alert(`تم استيراد ${importedItems.length} سجل${importedItems.length > 1 ? 'اً' : ''} إلى ${label}.`);
    });
  };

  // Render table rows
  const render = (filter='') => {
    tableBody.innerHTML = '';
    const rows = items.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    rows.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-select"><input type="checkbox" ${it._selected ? 'checked' : ''} aria-label="تحديد السطر" /></td>
        <td>${it.serial}</td>
        <td>${it.date}</td>
        <td>${it.recipient}</td>
        <td>${it.subject}</td>
        <td>${it.oldNo || '-'}</td>
        <td>${it.oldDate || '-'}</td>
        <td>${it.transfer || '-'}</td>
        <td>${it.newNo || '-'}</td>
        <td>${it.newDate || '-'}</td>
        <td>${it.attachments ? (it.attachments.length) : 0}</td>
        <td class="actions">
          <button class="btn" data-action="view" ${it.attachments && it.attachments.length ? '' : 'disabled'}>عرض المرفقات</button>
          <button class="btn" data-action="edit">تعديل</button>
          <button class="btn" data-action="delete">حذف</button>
        </td>
      `;
      const checkbox = tr.querySelector('.row-select input[type="checkbox"]');
      if (it._selected) tr.classList.add('selected');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          it._selected = e.target.checked;
          tr.classList.toggle('selected', e.target.checked);
          updateSelectAllCheckboxState(selectAllOutgoingCheckbox, rows);
        });
      }
      // attach actions
      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm('هل تريد حذف هذا السجل؟')) return;
        try {
          if (it.id) await deleteFromServer(`/api/outgoing/${it.id}`);
        } catch (error) {
          console.error('Delete outgoing failed', error);
          alert('تعذر حذف السجل من الخادم.');
          return;
        }
        items = items.filter(x => x !== it);
        saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
        render(searchInput.value);
      });
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للكتاب الصادر');
      });
      tableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllOutgoingCheckbox, rows);
    updateDashboardStats();
  };

  const renderIncoming = (filter='') => {
    incomingTableBody.innerHTML = '';
    const rows = itemsIncoming.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    rows.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-select"><input type="checkbox" ${it._selected ? 'checked' : ''} aria-label="تحديد السطر" /></td>
        <td>${it.arrivePlace || '-'}</td>
        <td>${it.arriveNo || '-'}</td>
        <td>${it.arriveDate || '-'}</td>
        <td>${it.inNo || '-'}</td>
        <td>${it.inDate || '-'}</td>
        <td>${it.requesterName || '-'}</td>
        <td>${it.requestType || '-'}</td>
        <td>${it.subject || '-'}</td>
        <td>${it.phone || '-'}</td>
        <td>${it.transferTo || '-'}</td>
        <td>${it.outNo || '-'}</td>
        <td>${it.sender || '-'}</td>
        <td>${it.notes || '-'}</td>
        <td>${it.attachments ? (it.attachments.length) : 0}</td>
        <td class="actions">
          <button class="btn" data-action="view" ${it.attachments && it.attachments.length ? '' : 'disabled'}>عرض المرفقات</button>
          <button class="btn" data-action="edit">تعديل</button>
          <button class="btn" data-action="delete">حذف</button>
        </td>
      `;
      const checkbox = tr.querySelector('.row-select input[type="checkbox"]');
      if (it._selected) tr.classList.add('selected');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          it._selected = e.target.checked;
          tr.classList.toggle('selected', e.target.checked);
          updateSelectAllCheckboxState(selectAllIncomingCheckbox, rows);
        });
      }
      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm('هل تريد حذف هذا السجل؟')) return;
        try {
          if (it.id) await deleteFromServer(`/api/incoming/${it.id}`);
        } catch (error) {
          console.error('Delete incoming failed', error);
          alert('تعذر حذف السجل من الخادم.');
          return;
        }
        itemsIncoming = itemsIncoming.filter(x => x !== it);
        saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
        renderIncoming(searchInputIncoming.value);
      });
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateIncomingForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للكتاب الوارد');
      });
      incomingTableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllIncomingCheckbox, rows);
    updateDashboardStats();
  };

  const renderReception = (filter='') => {
    receptionTableBody.innerHTML = '';
    const rows = itemsReception.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    rows.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-select"><input type="checkbox" ${it._selected ? 'checked' : ''} aria-label="تحديد السطر" /></td>
        <td>${it.name || '-'}</td>
        <td>${it.category || '-'}</td>
        <td>${it.qualification || '-'}</td>
        <td>${it.request || '-'}</td>
        <td>${it.subject || '-'}</td>
        <td>${it.submissionDate || '-'}</td>
        <td>${it.requestNo || '-'}</td>
        <td>${it.address || '-'}</td>
        <td>${it.phone || '-'}</td>
        <td>${it.nationalId || '-'}</td>
        <td>${it.result1 || '-'}</td>
        <td>${it.result2 || '-'}</td>
        <td>${it.result3 || '-'}</td>
        <td>${it.result4 || '-'}</td>
        <td>${it.notes || '-'}</td>
        <td>${it.out1 || '-'}</td>
        <td>${it.in2 || '-'}</td>
        <td>${it.out2 || '-'}</td>
        <td>${it.in3 || '-'}</td>
        <td>${it.out3 || '-'}</td>
        <td>${it.attachments ? (it.attachments.length) : 0}</td>
        <td class="actions">
          <button class="btn" data-action="view" ${it.attachments && it.attachments.length ? '' : 'disabled'}>عرض المرفقات</button>
          <button class="btn" data-action="edit">تعديل</button>
          <button class="btn" data-action="delete">حذف</button>
        </td>
      `;
      const checkbox = tr.querySelector('.row-select input[type="checkbox"]');
      if (it._selected) tr.classList.add('selected');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          it._selected = e.target.checked;
          tr.classList.toggle('selected', e.target.checked);
          updateSelectAllCheckboxState(selectAllReceptionCheckbox, rows);
        });
      }
      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm('هل تريد حذف هذا السجل؟')) return;
        try {
          if (it.id) await deleteFromServer(`/api/reception/${it.id}`);
        } catch (error) {
          console.error('Delete reception failed', error);
          alert('تعذر حذف السجل من الخادم.');
          return;
        }
        itemsReception = itemsReception.filter(x => x !== it);
        saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
        renderReception(searchInputReception.value);
      });
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateReceptionForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للاستقبال والشكاوى');
      });
      receptionTableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllReceptionCheckbox, rows);
  };

  // Form handling and reset
  cancelBtn.addEventListener('click', clearForm);
  resetBtn.addEventListener('click', clearForm);
  cancelIncomingBtn.addEventListener('click', clearIncomingForm);
  resetIncomingBtn.addEventListener('click', clearIncomingForm);
  cancelReceptionBtn.addEventListener('click', clearReceptionForm);
  resetReceptionBtn.addEventListener('click', clearReceptionForm);

  // helper: read files as data URLs
  function readFilesAsDataURLs(fileList){
    const arr = Array.from(fileList || []);
    return Promise.all(arr.map(f => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, type: f.type, data: reader.result });
      reader.readAsDataURL(f);
    })));
  }

  function renderPreview(previewEl, attachments, options = {}){
    if (!previewEl) return;
    previewEl.innerHTML = '';
    if (!attachments || !attachments.length) return;
    attachments.forEach((att, index) => {
      const wrap = document.createElement('div'); wrap.className = 'preview-item';
      if (att.type && att.type.startsWith('image')){
        const img = document.createElement('img'); img.src = att.data; img.alt = att.name;
        wrap.appendChild(img);
        const a = document.createElement('a'); a.href = att.data; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = att.name; wrap.appendChild(a);
      } else if (att.type === 'application/pdf'){
        const iframe = document.createElement('iframe'); iframe.src = att.data; iframe.style.width = '100%'; iframe.style.height = '180px'; iframe.style.border = 'none'; wrap.appendChild(iframe);
        const a = document.createElement('a'); a.href = att.data; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'فتح/تحميل PDF — ' + att.name; a.download = att.name; wrap.appendChild(a);
      } else {
        const icon = document.createElement('div'); icon.className = 'pdf-icon'; icon.textContent = att.name; wrap.appendChild(icon);
        const a = document.createElement('a'); a.href = att.data; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'فتح/تحميل الملف'; a.download = att.name; wrap.appendChild(a);
      }
      if (options.editable){
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn secondary';
        removeBtn.textContent = 'حذف المرفق';
        removeBtn.addEventListener('click', () => {
          if (typeof options.onRemove === 'function') options.onRemove(index);
        });
        wrap.appendChild(removeBtn);
      }
      previewEl.appendChild(wrap);
    });
  }

  function removeAttachmentFromForm(form, previewEl, index){
    if (!form._attachmentsTemp) return;
    form._attachmentsTemp.splice(index, 1);
    renderPreview(previewEl, form._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(form, previewEl, idx) });
  }

  function addAttachmentToForm(form, inputEl, previewEl){
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    readFilesAsDataURLs([file]).then(data => {
      form._attachmentsTemp = form._attachmentsTemp || [];
      form._attachmentsTemp.push(data[0]);
      renderPreview(previewEl, form._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(form, previewEl, idx) });
      inputEl.value = '';
    });
  }

  if (outgoingAddAttachmentBtn){
    outgoingAddAttachmentBtn.addEventListener('click', () => {
      if (outgoingAttachmentInput) outgoingAttachmentInput.click();
    });
  }
  if (outgoingAttachmentInput){
    outgoingAttachmentInput.addEventListener('change', () => addAttachmentToForm(form, outgoingAttachmentInput, outgoingPreviewEl));
  }
  if (outgoingImportBtn && outgoingImportInput){
    outgoingImportBtn.addEventListener('click', () => outgoingImportInput.click());
    outgoingImportInput.addEventListener('change', async () => {
      if (outgoingImportInput.files.length) {
        handleExcelImport(outgoingImportInput.files[0], outgoingHeaderMap, async (importedItems) => {
          if (!importedItems.length) return;
          try {
            const created = await bulkSaveToServer('/api/outgoing/bulk', importedItems);
            items.unshift(...created.map(item => ({ ...item, attachments: parseAttachments(item.attachments) })));
            render(searchInput.value);
            alert(`تم استيراد ${created.length} سجل${created.length > 1 ? 'اً' : ''} إلى الكتب الصادرة.`);
          } catch (error) {
            console.error('Outgoing bulk import failed', error);
            alert('حدث خطأ أثناء حفظ بيانات الإكسل في الخادم.');
          }
        });
      }
      outgoingImportInput.value = '';
    });
  }
  if (outgoingExportBtn){
    outgoingExportBtn.addEventListener('click', () => exportDataToExcel(items, outgoingHeaders, 'الكتب_الصادرة.xlsx'));
  }
  if (outgoingDeleteSelectedBtn){
    outgoingDeleteSelectedBtn.addEventListener('click', async () => {
      const selected = items.filter(it => it._selected);
      const selectedCount = selected.length;
      if (!selectedCount) return alert('لم يتم اختيار أي سجل للحذف.');
      if (!confirm(`هل تريد حذف ${selectedCount} سجل${selectedCount > 1 ? 'اً' : ''} محدد؟`)) return;
      try {
        await Promise.all(selected.map(item => deleteFromServer(`/api/outgoing/${item.id}`)));
      } catch (error) {
        console.error('Bulk outgoing delete failed', error);
        alert('تعذر حذف السجلات من الخادم.');
      }
      items = items.filter(it => !it._selected);
      render(searchInput.value);
    });
  }
  if (selectAllOutgoingCheckbox){
    selectAllOutgoingCheckbox.addEventListener('change', (e) => {
      const visibleRows = items.filter(it => {
        if (!searchInput.value) return true;
        return Object.values(it).join(' ').toLowerCase().includes(searchInput.value.toLowerCase());
      });
      toggleSelectionForVisibleRows(visibleRows, e.target.checked);
      render(searchInput.value);
    });
  }

  if (incomingAddAttachmentBtn){
    incomingAddAttachmentBtn.addEventListener('click', () => {
      if (incomingAttachmentInput) incomingAttachmentInput.click();
    });
  }
  if (incomingAttachmentInput){
    incomingAttachmentInput.addEventListener('change', () => addAttachmentToForm(incomingForm, incomingAttachmentInput, incomingPreviewEl));
  }
  if (incomingImportBtn && incomingImportInput){
    incomingImportBtn.addEventListener('click', () => incomingImportInput.click());
    incomingImportInput.addEventListener('change', async () => {
      if (incomingImportInput.files.length) {
        handleExcelImport(incomingImportInput.files[0], incomingHeaderMap, async (importedItems) => {
          if (!importedItems.length) return;
          try {
            const created = await bulkSaveToServer('/api/incoming/bulk', importedItems);
            itemsIncoming.unshift(...created.map(item => ({ ...item, attachments: parseAttachments(item.attachments) })));
            renderIncoming(searchInputIncoming.value);
            alert(`تم استيراد ${created.length} سجل${created.length > 1 ? 'اً' : ''} إلى الكتب الواردة.`);
          } catch (error) {
            console.error('Incoming bulk import failed', error);
            alert('حدث خطأ أثناء حفظ بيانات الإكسل في الخادم.');
          }
        });
      }
      incomingImportInput.value = '';
    });
  }
  if (incomingExportBtn){
    incomingExportBtn.addEventListener('click', () => exportDataToExcel(itemsIncoming, incomingHeaders, 'الكتب_الواردة.xlsx'));
  }
  if (incomingDeleteSelectedBtn){
    incomingDeleteSelectedBtn.addEventListener('click', async () => {
      const selected = itemsIncoming.filter(it => it._selected);
      const selectedCount = selected.length;
      if (!selectedCount) return alert('لم يتم اختيار أي سجل للحذف.');
      if (!confirm(`هل تريد حذف ${selectedCount} سجل${selectedCount > 1 ? 'اً' : ''} محدد؟`)) return;
      try {
        await Promise.all(selected.map(item => deleteFromServer(`/api/incoming/${item.id}`)));
      } catch (error) {
        console.error('Bulk incoming delete failed', error);
        alert('تعذر حذف السجلات من الخادم.');
      }
      itemsIncoming = itemsIncoming.filter(it => !it._selected);
      renderIncoming(searchInputIncoming.value);
    });
  }
  if (selectAllIncomingCheckbox){
    selectAllIncomingCheckbox.addEventListener('change', (e) => {
      const visibleRows = itemsIncoming.filter(it => {
        if (!searchInputIncoming.value) return true;
        return Object.values(it).join(' ').toLowerCase().includes(searchInputIncoming.value.toLowerCase());
      });
      toggleSelectionForVisibleRows(visibleRows, e.target.checked);
      renderIncoming(searchInputIncoming.value);
    });
  }

  if (recAddAttachmentBtn){
    recAddAttachmentBtn.addEventListener('click', () => {
      if (recAttachmentInput) recAttachmentInput.click();
    });
  }
  if (recAttachmentInput){
    recAttachmentInput.addEventListener('change', () => addAttachmentToForm(receptionForm, recAttachmentInput, recPreviewEl));
  }
  if (receptionImportBtn && receptionImportInput){
    receptionImportBtn.addEventListener('click', () => receptionImportInput.click());
    receptionImportInput.addEventListener('change', async () => {
      if (receptionImportInput.files.length) {
        handleExcelImport(receptionImportInput.files[0], receptionHeaderMap, async (importedItems) => {
          if (!importedItems.length) return;
          try {
            const created = await bulkSaveToServer('/api/reception/bulk', importedItems);
            itemsReception.unshift(...created.map(item => ({ ...item, attachments: parseAttachments(item.attachments) })));
            renderReception(searchInputReception.value);
            alert(`تم استيراد ${created.length} سجل${created.length > 1 ? 'اً' : ''} إلى الاستقبال والشكاوى.`);
          } catch (error) {
            console.error('Reception bulk import failed', error);
            alert('حدث خطأ أثناء حفظ بيانات الإكسل في الخادم.');
          }
        });
      }
      receptionImportInput.value = '';
    });
  }
  if (receptionExportBtn){
    receptionExportBtn.addEventListener('click', () => exportDataToExcel(itemsReception, receptionHeaders, 'الاستقبال_والشكاوى.xlsx'));
  }
  if (receptionDeleteSelectedBtn){
    receptionDeleteSelectedBtn.addEventListener('click', async () => {
      const selected = itemsReception.filter(it => it._selected);
      const selectedCount = selected.length;
      if (!selectedCount) return alert('لم يتم اختيار أي سجل للحذف.');
      if (!confirm(`هل تريد حذف ${selectedCount} سجل${selectedCount > 1 ? 'اً' : ''} محدد؟`)) return;
      try {
        await Promise.all(selected.map(item => deleteFromServer(`/api/reception/${item.id}`)));
      } catch (error) {
        console.error('Bulk reception delete failed', error);
        alert('تعذر حذف السجلات من الخادم.');
      }
      itemsReception = itemsReception.filter(it => !it._selected);
      renderReception(searchInputReception.value);
    });
  }
  if (selectAllReceptionCheckbox){
    selectAllReceptionCheckbox.addEventListener('change', (e) => {
      const visibleRows = itemsReception.filter(it => {
        if (!searchInputReception.value) return true;
        return Object.values(it).join(' ').toLowerCase().includes(searchInputReception.value.toLowerCase());
      });
      toggleSelectionForVisibleRows(visibleRows, e.target.checked);
      renderReception(searchInputReception.value);
    });
  }

  function showAttachmentsModal(attachments = [], title = 'المرفقات'){
    if (!attachmentsModal || !attachmentsModalBody) return;
    attachmentsModalBody.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'attachments-modal-title';
    heading.textContent = title;
    attachmentsModalBody.appendChild(heading);
    if (!attachments.length){
      const empty = document.createElement('div');
      empty.textContent = 'لا توجد مرفقات لعرضها.';
      attachmentsModalBody.appendChild(empty);
    }
    attachments.forEach(att => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-item';
      if (att.type && att.type.startsWith('image')){
        const img = document.createElement('img');
        img.src = att.data;
        img.alt = att.name;
        wrap.appendChild(img);
      } else if (att.type === 'application/pdf'){
        const iframe = document.createElement('iframe');
        iframe.src = att.data;
        iframe.style.width = '100%';
        iframe.style.height = '240px';
        iframe.style.border = 'none';
        wrap.appendChild(iframe);
      } else {
        const icon = document.createElement('div');
        icon.className = 'pdf-icon';
        icon.textContent = att.name;
        wrap.appendChild(icon);
      }
      const link = document.createElement('a');
      link.href = att.data;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'فتح/تحميل ' + att.name;
      link.download = att.name;
      wrap.appendChild(link);
      attachmentsModalBody.appendChild(wrap);
    });
    attachmentsModal.classList.remove('hidden');
  }

  if (closeAttachmentsModal){
    closeAttachmentsModal.addEventListener('click', () => {
      if (attachmentsModal) attachmentsModal.classList.add('hidden');
    });
  }

  function populateIncomingForm(item){
    document.getElementById('inFieldArrivePlace').value = item.arrivePlace || '';
    document.getElementById('inFieldArriveNo').value = item.arriveNo || '';
    document.getElementById('inFieldArriveDate').value = item.arriveDate || getTodayValue();
    document.getElementById('inFieldNo').value = item.inNo || '';
    document.getElementById('inFieldDate').value = item.inDate || getTodayValue();
    document.getElementById('inFieldRequesterName').value = item.requesterName || '';
    document.getElementById('inFieldRequestType').value = item.requestType || '';
    document.getElementById('inFieldSubject').value = item.subject || '';
    document.getElementById('inFieldPhone').value = item.phone || '';
    document.getElementById('inFieldTransferTo').value = item.transferTo || '';
    document.getElementById('inFieldOutNo').value = item.outNo || '';
    document.getElementById('inFieldSender').value = item.sender || '';
    document.getElementById('inFieldNotes').value = item.notes || '';
    incomingForm.dataset.editingId = item.id;
    incomingForm._attachmentsTemp = item.attachments ? [...item.attachments] : [];
    renderPreview(incomingPreviewEl, incomingForm._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(incomingForm, incomingPreviewEl, idx) });
    incomingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearIncomingForm(){
    incomingForm.reset();
    incomingForm.removeAttribute('data-editing-id');
    incomingForm._attachmentsTemp = [];
    if (incomingPreviewEl) incomingPreviewEl.innerHTML = '';
    if (incomingAttachmentInput) incomingAttachmentInput.value = '';
    document.getElementById('inFieldArriveDate').value = getTodayValue();
    document.getElementById('inFieldDate').value = getTodayValue();
  }

  function populateReceptionForm(item){
    document.getElementById('recFieldName').value = item.name || '';
    document.getElementById('recFieldCategory').value = item.category || '';
    document.getElementById('recFieldQualification').value = item.qualification || '';
    document.getElementById('recFieldRequest').value = item.request || '';
    document.getElementById('recFieldSubject').value = item.subject || '';
    document.getElementById('recFieldSubmissionDate').value = item.submissionDate || getTodayValue();
    document.getElementById('recFieldRequestNo').value = item.requestNo || '';
    document.getElementById('recFieldAddress').value = item.address || '';
    document.getElementById('recFieldPhone').value = item.phone || '';
    document.getElementById('recFieldNationalId').value = item.nationalId || '';
    document.getElementById('recFieldResult1').value = item.result1 || '';
    document.getElementById('recFieldResult2').value = item.result2 || '';
    document.getElementById('recFieldResult3').value = item.result3 || '';
    document.getElementById('recFieldResult4').value = item.result4 || '';
    document.getElementById('recFieldNotes').value = item.notes || '';
    document.getElementById('recFieldOut1').value = item.out1 || '';
    document.getElementById('recFieldIn2').value = item.in2 || '';
    document.getElementById('recFieldOut2').value = item.out2 || '';
    document.getElementById('recFieldIn3').value = item.in3 || '';
    document.getElementById('recFieldOut3').value = item.out3 || '';
    receptionForm.dataset.editingId = item.id;
    receptionForm._attachmentsTemp = item.attachments ? [...item.attachments] : [];
    renderPreview(recPreviewEl, receptionForm._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(receptionForm, recPreviewEl, idx) });
    receptionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearReceptionForm(){
    receptionForm.reset();
    receptionForm.removeAttribute('data-editing-id');
    receptionForm._attachmentsTemp = [];
    if (recPreviewEl) recPreviewEl.innerHTML = '';
    if (recAttachmentInput) recAttachmentInput.value = '';
    document.getElementById('recFieldSubmissionDate').value = getTodayValue();
  }

  function getTodayValue(){
    return new Date().toISOString().slice(0,10);
  }

  function populateForm(item){
    document.getElementById('fieldSerial').value = item.serial;
    document.getElementById('fieldDate').value = item.date || getTodayValue();
    document.getElementById('fieldRecipient').value = item.recipient;
    document.getElementById('fieldSubject').value = item.subject;
    document.getElementById('fieldOldInNo').value = item.oldNo;
    document.getElementById('fieldOldInDate').value = item.oldDate || getTodayValue();
    document.getElementById('fieldTransfer').value = item.transfer;
    document.getElementById('fieldNewInNo').value = item.newNo;
    document.getElementById('fieldNewInDate').value = item.newDate || getTodayValue();
    form.dataset.editingId = item.id;
    form._attachmentsTemp = item.attachments ? [...item.attachments] : [];
    renderPreview(outgoingPreviewEl, form._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(form, outgoingPreviewEl, idx) });
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearForm(){
    form.reset();
    form.removeAttribute('data-editing-id');
    form._attachmentsTemp = [];
    if (outgoingPreviewEl) outgoingPreviewEl.innerHTML = '';
    if (outgoingAttachmentInput) outgoingAttachmentInput.value = '';
    document.getElementById('fieldDate').value = getTodayValue();
    document.getElementById('fieldOldInDate').value = getTodayValue();
    document.getElementById('fieldNewInDate').value = getTodayValue();
  }

  // Handle form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      serial: document.getElementById('fieldSerial').value,
      date: document.getElementById('fieldDate').value,
      recipient: document.getElementById('fieldRecipient').value,
      subject: document.getElementById('fieldSubject').value,
      oldNo: document.getElementById('fieldOldInNo').value,
      oldDate: document.getElementById('fieldOldInDate').value,
      transfer: document.getElementById('fieldTransfer').value,
      newNo: document.getElementById('fieldNewInNo').value,
      newDate: document.getElementById('fieldNewInDate').value
    };
    let attachments = form._attachmentsTemp;
    const editingId = form.dataset.editingId;
    if (!attachments || !attachments.length){
      if (editingId) {
        const existing = items.find(it => it.id === Number(editingId));
        attachments = existing ? existing.attachments : [];
      } else {
        attachments = [];
      }
    }
    payload.attachments = attachments || [];
    try {
      const saved = editingId
        ? await saveToServer(`/api/outgoing/${editingId}`, payload, 'PUT')
        : await saveToServer('/api/outgoing', payload, 'POST');
      const normalized = { ...saved, attachments: parseAttachments(saved.attachments) };
      if (editingId) {
        items = items.map(it => it.id === normalized.id ? normalized : it);
      } else {
        items.unshift(normalized);
      }
      saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
      render(searchInput.value);
      clearForm();
    } catch (error) {
      console.error('Outgoing save failed', error);
      alert('حدث خطأ أثناء حفظ الكتاب الصادر في الخادم.');
    }
  });

  incomingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      arrivePlace: document.getElementById('inFieldArrivePlace').value,
      arriveNo: document.getElementById('inFieldArriveNo').value,
      arriveDate: document.getElementById('inFieldArriveDate').value,
      inNo: document.getElementById('inFieldNo').value,
      inDate: document.getElementById('inFieldDate').value,
      requesterName: document.getElementById('inFieldRequesterName').value,
      requestType: document.getElementById('inFieldRequestType').value,
      subject: document.getElementById('inFieldSubject').value,
      phone: document.getElementById('inFieldPhone').value,
      transferTo: document.getElementById('inFieldTransferTo').value,
      outNo: document.getElementById('inFieldOutNo').value,
      sender: document.getElementById('inFieldSender').value,
      notes: document.getElementById('inFieldNotes').value
    };
    let attachments = incomingForm._attachmentsTemp;
    const editingId = incomingForm.dataset.editingId;
    if (!attachments || !attachments.length){
      if (editingId) {
        const existing = itemsIncoming.find(it => it.id === Number(editingId));
        attachments = existing ? existing.attachments : [];
      } else {
        attachments = [];
      }
    }
    payload.attachments = attachments || [];
    try {
      const saved = editingId
        ? await saveToServer(`/api/incoming/${editingId}`, payload, 'PUT')
        : await saveToServer('/api/incoming', payload, 'POST');
      const normalized = { ...saved, attachments: parseAttachments(saved.attachments) };
      if (editingId) {
        itemsIncoming = itemsIncoming.map(it => it.id === normalized.id ? normalized : it);
      } else {
        itemsIncoming.unshift(normalized);
      }
      saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
      renderIncoming(searchInputIncoming.value);
      clearIncomingForm();
    } catch (error) {
      console.error('Incoming save failed', error);
      alert('حدث خطأ أثناء حفظ الكتاب الوارد في الخادم.');
    }
  });

  receptionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('recFieldName').value,
      category: document.getElementById('recFieldCategory').value,
      qualification: document.getElementById('recFieldQualification').value,
      request: document.getElementById('recFieldRequest').value,
      subject: document.getElementById('recFieldSubject').value,
      submissionDate: document.getElementById('recFieldSubmissionDate').value,
      requestNo: document.getElementById('recFieldRequestNo').value,
      address: document.getElementById('recFieldAddress').value,
      phone: document.getElementById('recFieldPhone').value,
      nationalId: document.getElementById('recFieldNationalId').value,
      result1: document.getElementById('recFieldResult1').value,
      result2: document.getElementById('recFieldResult2').value,
      result3: document.getElementById('recFieldResult3').value,
      result4: document.getElementById('recFieldResult4').value,
      notes: document.getElementById('recFieldNotes').value,
      out1: document.getElementById('recFieldOut1').value,
      in2: document.getElementById('recFieldIn2').value,
      out2: document.getElementById('recFieldOut2').value,
      in3: document.getElementById('recFieldIn3').value,
      out3: document.getElementById('recFieldOut3').value
    };
    let attachments = receptionForm._attachmentsTemp;
    const editingId = receptionForm.dataset.editingId;
    if (!attachments || !attachments.length){
      if (editingId) {
        const existing = itemsReception.find(it => it.id === Number(editingId));
        attachments = existing ? existing.attachments : [];
      } else {
        attachments = [];
      }
    }
    payload.attachments = attachments || [];
    try {
      const saved = editingId
        ? await saveToServer(`/api/reception/${editingId}`, payload, 'PUT')
        : await saveToServer('/api/reception', payload, 'POST');
      const normalized = { ...saved, attachments: parseAttachments(saved.attachments) };
      if (editingId) {
        itemsReception = itemsReception.map(it => it.id === normalized.id ? normalized : it);
      } else {
        itemsReception.unshift(normalized);
      }
      saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
      renderReception(searchInputReception.value);
      clearReceptionForm();
    } catch (error) {
      console.error('Reception save failed', error);
      alert('حدث خطأ أثناء حفظ سجل الاستقبال في الخادم.');
    }
  });

  // Search
  searchInput.addEventListener('input', () => render(searchInput.value));
  searchInputIncoming.addEventListener('input', () => renderIncoming(searchInputIncoming.value));
  searchInputReception.addEventListener('input', () => renderReception(searchInputReception.value));

  // init
  clearForm();
  clearIncomingForm();
  await load(); render();
  await loadIncoming(); renderIncoming();
  await loadReception(); renderReception();
  renderCircles();
  updateDashboardStats();
});
