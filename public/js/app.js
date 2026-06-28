// Dashboard interactions: date, tabs, outgoing table, inline form
document.addEventListener('DOMContentLoaded', async () => {
  const dateEl = document.getElementById('current-date');
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  dateEl.textContent = formatter.format(now);

  // Tabs behavior: toggle active class and content
  const tabs = document.querySelectorAll('.tab[data-tab]');
  const dashboardHome = document.getElementById('dashboardHome');
  const statsSection = document.getElementById('dashboardStats');
  const statIncomingEl = document.getElementById('statIncoming');
  const statOutgoingEl = document.getElementById('statOutgoing');
  const statReceptionEl = document.getElementById('statReception');
  const statTotalEl = document.getElementById('statTotal');
  // ensure initial view: show home section, hide all tab contents
  document.querySelectorAll('.tab-content').forEach(nc => nc.style.display = 'none');
  if (dashboardHome) dashboardHome.style.display = '';
  if (statsSection) statsSection.style.display = 'none';

  // Navigation history stack for back/forward behavior
  const navHistory = [];
  const getCurrentViewSnapshot = () => {
    // check for visible modal first
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) return { type: 'modal', id: openModal.id || null };
    // stats section visible?
    if (dashboardHome && dashboardHome.style.display !== 'none') return { type: 'home' };
    if (statsSection && statsSection.style.display !== 'none') return { type: 'stats' };
    const visibleTabContent = Array.from(document.querySelectorAll('.tab-content')).find(c => c.style.display !== 'none');
    if (visibleTabContent) return { type: 'tab', id: visibleTabContent.id || null };
    return { type: 'unknown' };
  };
  const pushCurrentToHistory = () => {
    try {
      const snap = getCurrentViewSnapshot();
      // avoid pushing duplicate consecutive states
      const last = navHistory[navHistory.length - 1];
      if (!last || JSON.stringify(last) !== JSON.stringify(snap)) {
        navHistory.push(snap);
        if (navHistory.length > 60) navHistory.shift();
      }
    } catch (e) { /* ignore */ }
  };
  const goToSnapshot = (snap) => {
    if (!snap) return;
    // hide modals
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    // hide tab contents
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    if (snap.type === 'home') {
      if (dashboardHome) dashboardHome.style.display = '';
      if (statsSection) statsSection.style.display = 'none';
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      tabs.forEach(t => t.classList.remove('active'));
      try { attachLocalBackToCurrentView(); } catch (e) {}
      return;
    }
    if (snap.type === 'stats') {
      if (statsSection) statsSection.style.display = '';
      if (dashboardHome) dashboardHome.style.display = 'none';
      tabs.forEach(t => t.classList.remove('active'));
      try { attachLocalBackToCurrentView(); } catch (e) {}
      return;
    }
    if (snap.type === 'tab' && snap.id) {
      const tab = Array.from(tabs).find(t => t.getAttribute('data-tab') === snap.id);
      if (tab) tab.classList.add('active');
      const el = document.getElementById(snap.id);
      if (el) el.style.display = '';
      if (statsSection) statsSection.style.display = 'none';
      if (dashboardHome) dashboardHome.style.display = 'none';
      try { attachLocalBackToCurrentView(); } catch (e) {}
      return;
    }
    if (snap.type === 'modal' && snap.id) {
      const m = document.getElementById(snap.id);
      if (m) {
        m.classList.remove('hidden');
        // ensure fullscreen mode when needed
        m.classList.add('fullscreen-mode');
        const win = m.querySelector('.modal-window'); if (win) win.classList.add('full-screen');
      }
      try { attachLocalBackToCurrentView(); } catch (e) {}
      return;
    }
  };
  // Local back button: attach a single button into current view/modal header
  const attachLocalBackToCurrentView = () => {
    // remove any existing local back button from DOM (we'll reattach)
    let btn = document.getElementById('localBackBtn');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    // if no history, don't show
    if (!navHistory.length) return;
    // create button
    btn = document.createElement('button'); btn.id = 'localBackBtn'; btn.className = 'btn'; btn.textContent = 'رجوع';
    btn.style.margin = '6px'; btn.addEventListener('click', (e) => { e.stopPropagation(); goBack(); });
    // prefer modal header if modal open
    const openModal = Array.from(document.querySelectorAll('.modal')).find(m => !m.classList.contains('hidden'));
    if (openModal) {
      const hdr = openModal.querySelector('.modal-header') || openModal;
      if (hdr) { hdr.insertBefore(btn, hdr.firstChild); return; }
    }
    // else attach to visible tab content (not stats)
    const visibleTab = Array.from(document.querySelectorAll('.tab-content')).find(c => window.getComputedStyle(c).display !== 'none');
    if (visibleTab && visibleTab.id !== 'dashboardStats') {
      // try to insert into page-heading if exists
      const heading = visibleTab.querySelector('.page-heading') || visibleTab;
      heading.insertBefore(btn, heading.firstChild);
      return;
    }
  };

  const tableCellTooltip = document.createElement('div');
  tableCellTooltip.id = 'tableCellTooltip';
  tableCellTooltip.className = 'table-cell-tooltip';
  document.body.appendChild(tableCellTooltip);

  const showTableCellTooltip = (cell) => {
    const text = cell.dataset.tooltip;
    if (!text) return;
    tableCellTooltip.textContent = text;
    tableCellTooltip.style.display = 'block';
    const rect = cell.getBoundingClientRect();
    const maxWidth = Math.min(380, window.innerWidth - 24);
    tableCellTooltip.style.maxWidth = `${maxWidth}px`;
    let left = rect.left;
    if (left + maxWidth > window.innerWidth - 12) left = window.innerWidth - maxWidth - 12;
    if (left < 12) left = 12;
    tableCellTooltip.style.left = `${left}px`;
    tableCellTooltip.style.top = `${rect.bottom + 8}px`;
  };

  const hideTableCellTooltip = () => {
    tableCellTooltip.style.display = 'none';
  };

  const annotateTooltipCells = (row) => {
    Array.from(row.querySelectorAll('td:not(.actions):not(.row-select)')).forEach(td => {
      const text = (td.textContent || '').trim();
      if (!text || text === '-') return;
      if (text.length < 40 && !text.includes('\n')) return;
      td.classList.add('truncate-cell');
      td.dataset.tooltip = text;
      td.removeAttribute('title');
      td.addEventListener('mouseenter', () => showTableCellTooltip(td));
      td.addEventListener('mouseleave', hideTableCellTooltip);
    });
  };
  const goBack = () => {
    if (!navHistory.length) return;
    // Pop current state (if it matches current view) then navigate to previous
    const current = getCurrentViewSnapshot();
    const last = navHistory[navHistory.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(current)) navHistory.pop();
    const prev = navHistory.pop();
    if (!prev) return;
    goToSnapshot(prev);
  };
  const goHome = () => {
    navHistory.length = 0;
    // hide all tab contents and modals
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    // remove active from tabs
    tabs.forEach(t => t.classList.remove('active'));
    if (dashboardHome) dashboardHome.style.display = '';
    if (statsSection) statsSection.style.display = 'none';
    try { attachLocalBackToCurrentView(); } catch (e) {}
  };

  // wire global nav buttons
  const backStepBtn = document.getElementById('backStepBtn');
  const backHomeBtn = document.getElementById('backHomeBtn');
  if (backStepBtn) backStepBtn.addEventListener('click', () => goBack());
  if (backHomeBtn) backHomeBtn.addEventListener('click', () => goHome());

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-tab');
      if (!key) return;
      // push current view before navigating
      pushCurrentToHistory();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (dashboardHome) dashboardHome.style.display = 'none';
      // show the selected tab content and hide all others
      document.querySelectorAll('.tab-content').forEach(c => { if (c.id === key) c.style.display = ''; else c.style.display = 'none'; });
      if (statsSection) statsSection.style.display = 'none';
      // attach local back button if history exists
      try { attachLocalBackToCurrentView(); } catch (e) { /* ignore */ }
      // If overdue tab opened, load data
      try {
        if (key === 'overdueDossiers') loadOverdueDossiers();
        if (key === 'trash') loadTrash();
      } catch (e) {}
    });
  });

  // Dashboard cards open the matching tab when clicked
  document.querySelectorAll('.dashboard-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.getAttribute('data-tab');
      const tab = document.querySelector(`.tab[data-tab="${key}"]`);
      if (tab) tab.click();
    });
  });

  // Load overdue dossiers and render table
  const overdueTableBody = () => document.querySelector('#overdueTable tbody');
  const loadOverdueDossiers = async () => {
    const tbody = overdueTableBody(); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">جاري التحميل...</td></tr>';
    try {
      const serverRows = await fetchJson(`${API_BASE}/overdue-dossiers`);
      const localRows = getLocalArchiveOverdueRows();
      const rows = mergeOverdueRows(serverRows || [], localRows);
      window.__overdueDossierIds = new Set(rows.map(r => Number(r.dossierId)).filter(n => !isNaN(n)));
      renderOverdueTable(rows);
    } catch (err) {
      const localRows = getLocalArchiveOverdueRows();
      window.__overdueDossierIds = new Set(localRows.map(r => Number(r.dossierId)).filter(n => !isNaN(n)));
      renderOverdueTable(localRows);
    }
  };

  const renderOverdueTable = (rows) => {
    const tbody = overdueTableBody(); if (!tbody) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">لا توجد أضابير متأخرة حالياً.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const numberTd = document.createElement('td'); numberTd.textContent = r.dossierNumber != null ? r.dossierNumber : (r.dossierId || '-');
      const deptTd = document.createElement('td'); deptTd.textContent = r.currentDepartment || r.circleName || '-';
      const assignedTd = document.createElement('td'); assignedTd.textContent = r.assignedDuration || '-';
      const deadlineTd = document.createElement('td'); deadlineTd.textContent = r.deadlineAt ? (new Date(r.deadlineAt)).toLocaleString('ar-SY') : '-';
      const delayTd = document.createElement('td'); delayTd.textContent = r.delayDuration || '-';
      const statusTd = document.createElement('td'); statusTd.textContent = r.status || '-';
      const actionTd = document.createElement('td');
      const archiveItem = (itemsArchive || []).find(item => String(item.id) === String(r.dossierId));
      const resolveBtn = document.createElement('button'); resolveBtn.className = 'btn small'; resolveBtn.textContent = 'إزالة التأخير';
      resolveBtn.addEventListener('click', async () => {
        try {
          await fetchJson(`${API_BASE}/overdue-dossiers/resolve`, { method: 'POST', body: JSON.stringify({ dossierId: r.dossierId }) });
          loadOverdueDossiers();
        } catch (e) { alert('فشل في إزالة حالة التأخير: ' + (e.message || e)); }
      });
      const openBtn = document.createElement('button'); openBtn.className = 'btn small'; openBtn.textContent = 'فتح الأضبارة';
      openBtn.addEventListener('click', () => {
        if (archiveItem) openArchiveRecord(archiveItem);
        else alert('لم يتم العثور على هذه الأضبارة في السجل المحلي.');
      });
      actionTd.appendChild(openBtn);
      actionTd.appendChild(resolveBtn);
      tr.appendChild(numberTd);
      tr.appendChild(deptTd);
      tr.appendChild(assignedTd);
      tr.appendChild(deadlineTd);
      tr.appendChild(delayTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
  };

  const archiveLateTableBody = () => document.querySelector('#archiveLateTable tbody');
  const renderArchiveLate = () => {
    const tbody = archiveLateTableBody(); if (!tbody) return;
    const rows = getLocalArchiveOverdueRows();
    const placeholder = document.getElementById('latePlaceholder');
    if (!rows.length) {
      tbody.innerHTML = '';
      if (placeholder) placeholder.style.display = '';
      return;
    }
    if (placeholder) placeholder.style.display = 'none';
    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const archiveItem = (itemsArchive || []).find(item => String(item.id) === String(r.dossierId));
      tr.innerHTML = `
        <td>${r.projectName}</td>
        <td>${r.currentDepartment}</td>
        <td>${r.assignedDuration}</td>
        <td>${r.deadlineAt ? (new Date(r.deadlineAt)).toLocaleString('ar-SY') : '-'}</td>
        <td>${r.delayDuration}</td>
        <td>${r.status}</td>
        <td>
          <button class="btn small" data-action="open-archive">فتح الأضبارة</button>
        </td>
      `;
      const openBtn = tr.querySelector('[data-action="open-archive"]');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (archiveItem) openArchiveRecord(archiveItem);
          else alert('لم يتم العثور على هذه الأضبارة في السجل المحلي.');
        });
      }
      tbody.appendChild(tr);
    });
  };

  const showArchiveSubview = (viewId) => {
    ['archiveNewView','archivesListView','archivesLateView'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = (id === viewId ? '' : 'none');
    });
  };

  // wire refresh button
  const refreshOverdueBtn = document.getElementById('refreshOverdueBtn'); if (refreshOverdueBtn) refreshOverdueBtn.addEventListener('click', () => loadOverdueDossiers());

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

  // Archive tab elements
  const archiveForm = document.getElementById('archiveForm');
  const archivesBackBtn = document.getElementById('archivesBackBtn');
  const resizeArchiveProjectNameField = () => {
    const textarea = document.getElementById('archiveProjectName');
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.max(textarea.scrollHeight + 4, 140);
    textarea.style.height = `${nextHeight}px`;
  };
  const archiveProjectNameField = document.getElementById('archiveProjectName');
  if (archiveProjectNameField) {
    archiveProjectNameField.addEventListener('input', resizeArchiveProjectNameField);
    archiveProjectNameField.addEventListener('paste', () => requestAnimationFrame(resizeArchiveProjectNameField));
    window.addEventListener('load', resizeArchiveProjectNameField);
  }
  const archiveNewCard = document.getElementById('archiveNewCard');
  const archiveLateCard = document.getElementById('archiveLateCard');
  const archiveListCard = document.getElementById('archiveListCard');
  const archivesListView = document.getElementById('archivesListView');
  const archivesLateView = document.getElementById('archivesLateView');
  const lateBackBtn = document.getElementById('lateBackBtn');
  const archiveSearchInput = document.getElementById('archiveSearchInput');
  const archivesListBackBtn = document.getElementById('archivesListBackBtn');
  const countAllBtn = document.getElementById('countAllBtn');
  const refreshAllBtn = document.getElementById('refreshAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  // Open new archive view
  const openArchiveNew = (push) => {
    const shouldPush = (typeof push === 'boolean') ? push : true;
    if (shouldPush) try { pushCurrentToHistory(); } catch (e) {}
    // activate archives tab
    tabs.forEach(t => t.classList.remove('active'));
    const archivesTab = Array.from(tabs).find(t => t.getAttribute('data-tab') === 'archives');
    if (archivesTab) archivesTab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => { if (c.id === 'archives') c.style.display = ''; else c.style.display = 'none'; });
    const cards = document.querySelector('.archives-cards'); if (cards) cards.style.display = 'none';
    if (archivesListView) archivesListView.style.display = 'none';
    if (archivesLateView) archivesLateView.style.display = 'none';
    const view = document.getElementById('archiveNewView'); if (view) view.style.display = '';
    if (statsSection) statsSection.style.display = 'none';
    // start with an empty form (no defaults)
    const formEl = document.getElementById('archiveForm');
    if (formEl) {
      // clear all fields and attachments
      try { clearArchiveForm(); } catch (e) {}
      formEl._attachments = {};
    }
    // default status for new record and default date/enteredBy
    const statusEl = document.getElementById('archiveStatus'); if (statusEl) statusEl.value = 'قيد العمل';
    const departmentEl = document.getElementById('archiveDepartment'); if (departmentEl) departmentEl.value = '';
    const statusDisplay = document.getElementById('archiveStatusDisplay'); if (statusDisplay) statusDisplay.value = 'قيد العمل';
    const createDateEl = document.getElementById('archiveCreateDate'); if (createDateEl) createDateEl.value = (new Date()).toISOString().slice(0,10);
    const enteredBy = (currentUser && (currentUser.name || currentUser.username)) ? (currentUser.name || currentUser.username) : '';
    ['studies_enteredBy','tech_enteredBy','gov_enteredBy','legal_enteredBy','gov2_enteredBy'].forEach(id => { const el = document.getElementById(id); if (el) el.value = enteredBy; });
    // ensure duration badges are present
    try { ensureDurationBadges(['studies_expectedValue','tech_expectedValue','gov_expectedValue','legal_expectedValue','gov2_expectedValue']); } catch (e) {}
    // show top nav and mark active
    try { showArchivesTopNav('new'); } catch (e) {}
    try { attachLocalBackToCurrentView(); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (archiveNewCard) archiveNewCard.addEventListener('click', openArchiveNew);

  // ensure edit button starts disabled until a saved record is present
  const editArchiveBtnInit = document.getElementById('editArchiveBtn'); if (editArchiveBtnInit) editArchiveBtnInit.disabled = true;

  // Back buttons in new archive view
  const archiveNewBackBtn = document.getElementById('archiveNewBackBtn');
  const archiveFormBackBtn = document.getElementById('archiveFormBackBtn');
  if (archiveNewBackBtn) archiveNewBackBtn.addEventListener('click', () => goBack());
  if (archiveFormBackBtn) archiveFormBackBtn.addEventListener('click', () => goBack());

  // Attachment helpers for sections
  const setupSectionAttachments = (addBtnId, delBtnId, inputId, previewId, sectionKey) => {
    const addBtn = document.getElementById(addBtnId); const delBtn = document.getElementById(delBtnId); const input = document.getElementById(inputId); const preview = document.getElementById(previewId);
    if (!addBtn || !input || !preview) return;
    addBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const formEl = document.getElementById('archiveForm'); if (!formEl) return;
      formEl._attachments = formEl._attachments || {};
      formEl._attachments[sectionKey] = formEl._attachments[sectionKey] || [];
      // read files as data URLs so we can preview images/pdf
      const readers = files.map(f => new Promise((res) => {
        const r = new FileReader(); r.onload = () => res({ name: f.name, type: f.type || '', data: r.result }); r.readAsDataURL(f);
      }));
      const results = await Promise.all(readers);
      results.forEach(r => formEl._attachments[sectionKey].push(r));
      // render preview
      const renderPreview = (list) => {
        preview.innerHTML = '';
        list.forEach((a, idx) => {
          const div = document.createElement('div'); div.className = 'preview-item';
          const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='10px';
          if (a.type && a.type.startsWith('image')){
            const img = document.createElement('img'); img.src = a.data; img.alt = a.name; img.style.width='64px'; img.style.height='48px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
            left.appendChild(img);
          } else if (a.type === 'application/pdf'){
            const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='PDF'; icon.style.padding='10px'; left.appendChild(icon);
          } else {
            const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='FILE'; icon.style.padding='10px'; left.appendChild(icon);
          }
          const meta = document.createElement('div'); meta.className='meta'; const nameEl = document.createElement('div'); nameEl.textContent = a.name; meta.appendChild(nameEl);
          left.appendChild(meta);
          div.appendChild(left);
          const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
          const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx = idx; cb.style.marginLeft='8px';
          const open = document.createElement('button'); open.type='button'; open.className='btn small'; open.textContent='فتح'; open.addEventListener('click', () => showAttachmentsModal([a], a.name));
          right.appendChild(open); right.appendChild(cb);
          div.appendChild(right);
          preview.appendChild(div);
        });
      };
      renderPreview(formEl._attachments[sectionKey]);
    });
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const formEl = document.getElementById('archiveForm'); if (!formEl) return;
        formEl._attachments = formEl._attachments || {}; formEl._attachments[sectionKey] = formEl._attachments[sectionKey] || [];
        const previewEl = document.getElementById(previewId); if (!previewEl) return;
        const checks = previewEl.querySelectorAll('input[type="checkbox"]');
        const toRemove = [];
        checks.forEach(cb => { if (cb.checked) toRemove.push(Number(cb.dataset.idx)); });
        // remove indices descending
        toRemove.sort((a,b)=>b-a).forEach(i => { formEl._attachments[sectionKey].splice(i,1); });
        // re-render
        previewEl.innerHTML = '';
        (formEl._attachments[sectionKey]||[]).forEach((a, idx) => {
          const div = document.createElement('div'); div.className='preview-item';
          const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='10px';
          if (a.type && a.type.startsWith('image')){
            const img = document.createElement('img'); img.src = a.data; img.alt = a.name; img.style.width='64px'; img.style.height='48px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
            left.appendChild(img);
          } else if (a.type === 'application/pdf'){
            const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='PDF'; icon.style.padding='10px'; left.appendChild(icon);
          } else {
            const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='FILE'; icon.style.padding='10px'; left.appendChild(icon);
          }
          const meta = document.createElement('div'); meta.className='meta'; const nameEl = document.createElement('div'); nameEl.textContent = a.name; meta.appendChild(nameEl);
          left.appendChild(meta);
          div.appendChild(left);
          const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
          const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx = idx; cb.style.marginLeft='8px';
          const open = document.createElement('button'); open.type='button'; open.className='btn small'; open.textContent='فتح'; open.addEventListener('click', () => showAttachmentsModal([a], a.name));
          right.appendChild(open); right.appendChild(cb);
          div.appendChild(right);
          previewEl.appendChild(div);
        });
      });
    }
  };
  // wire attachments for each section
  setupSectionAttachments('studiesAddAttach','studiesDelAttach','studiesAttachInput','studiesPreview','studies');
  setupSectionAttachments('techAddAttach','techDelAttach','techAttachInput','techPreview','tech');
  setupSectionAttachments('govAddAttach','govDelAttach','govAttachInput','govPreview','gov');
  setupSectionAttachments('legalAddAttach','legalDelAttach','legalAttachInput','legalPreview','legal');
  setupSectionAttachments('gov2AddAttach','gov2DelAttach','gov2AttachInput','gov2Preview','gov2');

  // view attachment buttons per section (open attachments modal with items from form._attachments)
  const wireViewAttach = (btnId, sectionKey, title) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const formEl = document.getElementById('archiveForm'); if (!formEl) return;
      const atts = (formEl._attachments && formEl._attachments[sectionKey]) ? formEl._attachments[sectionKey] : [];
      // map to expected shape for showAttachmentsModal
      const mapped = atts.map(a => ({ name: a.name || '', data: a.data || '#', type: a.type || '' }));
      showAttachmentsModal(mapped, title);
    });
  };
  wireViewAttach('studiesViewAttach','studies','مرفقات الدراسات');
  wireViewAttach('techViewAttach','tech','مرفقات الشؤون الفنية');
  wireViewAttach('govViewAttach','gov','مرفقات الديوان العام');
  wireViewAttach('legalViewAttach','legal','مرفقات الدائرة القانونية');
  wireViewAttach('gov2ViewAttach','gov2','مرفقات الديوان العام');

  // Settings tab elements
  const clearDbBtn = document.getElementById('clearDbBtn');
  const backupDbBtn = document.getElementById('backupDbBtn');
  const restoreDbBtn = document.getElementById('restoreDbBtn');
  const importBackupInput = document.getElementById('importBackupInput');

  // Users tab elements
  const addUserForm = document.getElementById('addUserForm');
  const usersTableContainer = document.getElementById('usersTableContainer');

  // Login modal elements
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');

  // If no session user, show fullscreen login and hide main UI
  try {
    const preservedUser = sessionStorage.getItem('diwan_user');
    if (!preservedUser) {
      if (loginModal) loginModal.classList.remove('hidden');
      const mainEl = document.querySelector('main'); if (mainEl) mainEl.style.display = 'none';
      const headerEl = document.querySelector('header'); if (headerEl) headerEl.style.display = 'none';
    } else {
      if (loginModal) loginModal.classList.add('hidden');
    }
  } catch (e) { /* ignore */ }

  // Activity Log Modal elements
  const activityLogModal = document.getElementById('activityLogModal');
  const activityLogTitle = document.getElementById('activityLogTitle');
  const activityLogBody = document.getElementById('activityLogBody');
  const closeActivityLogModal = document.getElementById('closeActivityLogModal');

  // User info elements
  const userInfoEl = document.getElementById('userInfo');
  const loggedInUserEl = document.getElementById('loggedInUser');
  const logoutBtn = document.getElementById('logoutBtn');

  let currentUser = null;
  let pendingDatabaseClear = false;

  const getCurrentActor = () => {
    return (currentUser && (currentUser.username || currentUser.name || currentUser.user)) ? (currentUser.username || currentUser.name || currentUser.user) : 'user';
  };

  const logActivity = async (action, details = {}, extra = {}) => {
    try {
      const payload = {
        action,
        actor: getCurrentActor(),
        note: details && typeof details === 'string' ? details : '',
        ...extra,
      };
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        if (details.note) payload.note = details.note;
        if (details.fromCircle !== undefined) payload.fromCircle = details.fromCircle;
        if (details.toCircle !== undefined) payload.toCircle = details.toCircle;
        if (details.sourceEntity !== undefined) payload.sourceEntity = details.sourceEntity;
        if (details.sourceId !== undefined) payload.sourceId = details.sourceId;
        if (details.circleName !== undefined) payload.circleName = details.circleName;
        if (details.circleMailId !== undefined) payload.circleMailId = details.circleMailId;
      }
      await saveToServer('/api/history', payload, 'POST');
    } catch (err) {
      console.warn('Activity log failed:', err);
    }
  };

  const attachmentsModal = document.getElementById('attachmentsModal');
  const attachmentsModalBody = document.getElementById('attachmentsModalBody');
  const closeAttachmentsModal = document.getElementById('closeAttachmentsModal');
  const transferModal = document.getElementById('transferModal');
  const transferListEl = document.getElementById('transferList');
  const closeTransferModal = document.getElementById('closeTransferModal');
  const confirmTransferBtn = document.getElementById('confirmTransferBtn');
  const cancelTransferBtn = document.getElementById('cancelTransferBtn');
  const transferNoteEl = document.getElementById('transferNote');

  const API_BASE = '/api';

  // If the page is opened via file:// (offline), use a fallback origin for API calls
  const DEFAULT_API_ORIGIN = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:')
    ? 'http://localhost:3000'
    : (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3007');

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
    archive: 'diwan_archive_backup',
    circlemail: 'diwan_circlemail_backup',
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
    // normalize URL to avoid duplicate slashes (but keep protocol scheme intact)
    const normalizeUrl = (u) => {
      if (!u) return u;
      try {
        if (u.startsWith('http://') || u.startsWith('https://')) {
          const parts = u.split('://');
          return parts[0] + '://' + parts[1].replace(/\/\/{2,}/g, '/');
        }
      } catch (e) {}
      return u.replace(/\/\/{2,}/g, '/');
    };
    let safeUrl = normalizeUrl(url);
    // ensure relative paths are resolved to a proper origin (fixes "Failed to fetch" when page served from file://)
    try {
      if (safeUrl && safeUrl.startsWith('/') && !safeUrl.startsWith('//') && !(safeUrl.startsWith('http://') || safeUrl.startsWith('https://'))) {
        safeUrl = DEFAULT_API_ORIGIN.replace(/\/$/, '') + safeUrl;
      }
    } catch (e) {}
    const response = await fetch(safeUrl, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      // try parse JSON error
      try {
        const parsed = JSON.parse(text);
        const msg = parsed && parsed.error ? parsed.error : JSON.stringify(parsed);
        throw new Error(msg || response.statusText || `HTTP ${response.status}`);
      } catch (e) {
        // not JSON, return trimmed text (strip HTML tags if present)
        const stripped = text.replace(/<[^>]*>/g, '').trim();
        throw new Error(stripped || response.statusText || `HTTP ${response.status}`);
      }
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return response.json();
    // fallback: try to parse text as JSON, else return text
    const txt = await response.text();
    try { return JSON.parse(txt); } catch (e) { return txt; }
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
  let itemsArchive = [];
  let trashItems = [];
  // when non-null, renderArchive will show only archive records transferred to this circle
  let archiveListCircleFilter = null;

  // Pagination State
  const PAGE_SIZE = 25;
  let currentPageOutgoing = 1;
  let currentPageIncoming = 1;
  let currentPageReception = 1;
  let currentPageArchive = 1;

  const TRASH_STORAGE_KEY = 'diwan_trash_backup';

  const saveTrashToStorage = () => {
    try {
      localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trashItems || []));
    } catch (err) {
      console.warn('Trash backup save failed', err);
    }
  };

  const loadTrashFromStorage = () => {
    try {
      const raw = localStorage.getItem(TRASH_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Trash backup load failed', err);
      return [];
    }
  };

  const getTrashLabel = (entity, item = {}) => {
    if (entity === 'outgoing') return item.subject || item.recipient || item.serial || 'كتاب صادر';
    if (entity === 'incoming') return item.subject || item.inNo || item.arriveNo || 'كتاب وارد';
    if (entity === 'reception') return item.subject || item.name || item.requestNo || 'استقبال وشكاوى';
    if (entity === 'archive') return item.projectName || item.subject || item.recipient || 'أضبارة';
    return item && item.subject ? item.subject : 'سجل';
  };

  const registerDeletedRecordInTrash = (entity, item) => {
    const normalized = item && typeof item === 'object' ? { ...item } : { value: item };
    const existingIndex = trashItems.findIndex(tr => tr.entity === entity && String(tr.id) === String(normalized.id));
    const record = {
      entity,
      id: normalized.id !== undefined ? normalized.id : null,
      item: normalized,
      deletedAt: new Date().toISOString(),
      label: getTrashLabel(entity, normalized),
    };
    if (existingIndex >= 0) trashItems[existingIndex] = record;
    else trashItems.unshift(record);
    saveTrashToStorage();
  };

  const loadTrash = async () => {
    try {
      const serverRows = await fetchJson(`${API_BASE}/trash`);
      const serverItems = Array.isArray(serverRows) ? serverRows : [];
      const localItems = loadTrashFromStorage();
      const serverKeySet = new Set(serverItems.map(row => `${row.entity}:${row.item && row.item.id !== undefined ? row.item.id : row.id}`));
      const merged = [
        ...serverItems.map(row => ({
          entity: row.entity,
          id: row.item && row.item.id !== undefined ? row.item.id : row.id,
          item: row.item ? { ...row.item } : {},
          deletedAt: row.deletedAt || row.item?.deletedAt || null,
          label: getTrashLabel(row.entity, row.item || {}),
        })),
        ...localItems.filter(row => !serverKeySet.has(`${row.entity}:${row.item && row.item.id !== undefined ? row.item.id : row.id}`))
      ];
      trashItems = merged;
    } catch (error) {
      console.warn('Load trash failed:', error);
      trashItems = loadTrashFromStorage();
    }
    saveTrashToStorage();
    try { renderTrash(); } catch (e) {}
  };

  const restoreTrashItem = async (record) => {
    if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
    const entity = record && record.entity;
    const item = record && record.item ? { ...record.item } : {};
    if (!entity) return;
    if (entity === 'archive') {
      itemsArchive = itemsArchive.some(existing => String(existing.id) === String(item.id)) ? itemsArchive : [item, ...itemsArchive];
      saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
      trashItems = trashItems.filter(tr => !(tr.entity === entity && String(tr.id) === String(item.id)));
      saveTrashToStorage();
      renderArchive(archiveSearchInput ? archiveSearchInput.value : '');
      renderTrash();
      return;
    }
    try {
      await fetchJson(`${API_BASE}/trash/restore`, {
        method: 'POST',
        body: JSON.stringify({ entity, id: item.id }),
      });
      if (entity === 'outgoing') {
        if (!items.some(existing => String(existing.id) === String(item.id))) items.unshift(item);
        saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
        render(searchInput.value);
      } else if (entity === 'incoming') {
        if (!itemsIncoming.some(existing => String(existing.id) === String(item.id))) itemsIncoming.unshift(item);
        saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
        renderIncoming(searchInputIncoming.value);
      } else if (entity === 'reception') {
        if (!itemsReception.some(existing => String(existing.id) === String(item.id))) itemsReception.unshift(item);
        saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
        renderReception(searchInputReception.value);
      }
      trashItems = trashItems.filter(tr => !(tr.entity === entity && String(tr.id) === String(item.id)));
      saveTrashToStorage();
      renderTrash();
    } catch (error) {
      console.error('Restore trash item failed', error);
      alert('تعذر استرجاع السجل من سلة المهملات.');
    }
  };

  const permanentDeleteTrashItem = async (record) => {
    if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
    const entity = record && record.entity;
    const item = record && record.item ? { ...record.item } : {};
    if (!entity) return;
    if (entity === 'archive') {
      trashItems = trashItems.filter(tr => !(tr.entity === entity && String(tr.id) === String(item.id)));
      saveTrashToStorage();
      renderTrash();
      return;
    }
    try {
      await fetchJson(`${API_BASE}/trash/permanent-delete`, {
        method: 'POST',
        body: JSON.stringify({ entity, id: item.id }),
      });
      trashItems = trashItems.filter(tr => !(tr.entity === entity && String(tr.id) === String(item.id)));
      saveTrashToStorage();
      renderTrash();
    } catch (error) {
      console.error('Permanent delete trash item failed', error);
      alert('تعذر حذف السجل نهائياً.');
    }
  };

  const emptyTrash = async () => {
    if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
    if (!trashItems.length) return;
    if (!confirm('هل تريد إفراغ سلة المهملات بالكامل؟')) return;
    const pending = [...trashItems];
    for (const record of pending) {
      if (record.entity === 'archive') continue;
      try {
        await fetchJson(`${API_BASE}/trash/permanent-delete`, {
          method: 'POST',
          body: JSON.stringify({ entity: record.entity, id: record.id }),
        });
      } catch (e) {
        console.warn('Failed to clear trash for', record.entity, record.id, e);
      }
    }
    trashItems = [];
    saveTrashToStorage();
    renderTrash();
  };

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

  const loadArchive = async () => {
    try {
      // try server if available
      const data = await fetchJson(`${API_BASE}/archive`);
      itemsArchive = data.map(item => ({ ...item, attachments: parseAttachments(item.attachments) }));
    } catch (error) {
      console.warn('Load archive failed or API not available:', error);
      itemsArchive = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.archive, []);
    }
  };

  const loadCircleMails = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/circlemail`);
      itemsCircleMail = data.map(cm => ({ ...cm, attachments: parseAttachments(cm.attachments) }));
    } catch (error) {
      console.warn('Load circle mails failed:', error);
      // fallback to local backup if server unavailable
      try {
        const backup = loadLocalBackup(LOCAL_STORAGE_KEYS.circlemail) || [];
        itemsCircleMail = Array.isArray(backup) ? backup.map(cm => ({ ...cm, attachments: parseAttachments(cm.attachments) })) : [];
      } catch (e) {
        itemsCircleMail = [];
      }
    }
    try { renderCircles(); updateDashboardStats(); } catch (e) { console.warn('Failed to render circles after load', e); }
  };

  const checkDelays = async () => {
    const now = Date.now();
    for (const cm of itemsCircleMail) {
      if (cm.status === 'finished') continue;
      if (cm.alerted) continue;
      const created = cm.createdAt ? new Date(cm.createdAt).getTime() : null;
      if (created && (now - created) > (48 * 3600 * 1000)) {
        // create an alert history and mark alerted
        try {
          await saveToServer('/api/history', { circleMailId: cm.id, action: 'delayed_alert', note: `تأخر بالبقاء في ${cm.circleName} لأكثر من يومين`, actor: 'system' });
          await saveToServer(`/api/circlemail/${cm.id}`, { alerted: true }, 'PUT');
        } catch (err) { console.warn('Failed to mark delay', err); }
      }
    }
    // refresh histories
    await loadHistories();
  };

  const loadHistories = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/history`);
      histories = data;
    } catch (error) {
      console.warn('Load histories failed:', error);
      histories = [];
    }
  };

  const preparePayloadForSave = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    const data = { ...payload };
    const isUserPayload = Object.prototype.hasOwnProperty.call(data, 'username')
      || Object.prototype.hasOwnProperty.call(data, 'role')
      || Object.prototype.hasOwnProperty.call(data, 'password');
    if (isUserPayload) return data;
    if (Array.isArray(data.attachments)) {
      data.attachments = JSON.stringify(data.attachments);
    } else if (!data.attachments) {
      data.attachments = JSON.stringify([]);
    }
    return data;
  };

  const saveToServer = async (endpoint, payload, method = 'POST') => {
    // Prevent modifications to finished circle mails.
    try {
      const safePayload = endpoint && endpoint.includes('/api/users')
        ? payload
        : preparePayloadForSave(payload);
      // helper to find matching circle mail
      const findCircleMail = (p) => {
        try {
          if (!p) return null;
          // direct circleMail id
          if (p.circleMailId) return itemsCircleMail.find(x => Number(x.id) === Number(p.circleMailId));
          const se = p.sourceEntity || (p.payload && p.payload.sourceEntity);
          const sid = p.sourceId || (p.payload && (p.payload.id || p.payload.sourceId));
          // prefer fromCircle when present (we want to check the original circle for freeze)
          const cname = p.fromCircle || p.circleName || (p.payload && p.payload.circleName);
          if (!se || sid === undefined || !cname) return null;
          return itemsCircleMail.find(x => String(x.sourceEntity) === String(se) && String(x.sourceId) === String(sid) && x.circleName === cname);
        } catch (e) { return null; }
      };

      const targetCm = findCircleMail(safePayload);
      if (targetCm && String(targetCm.status) === 'finished') {
        // allow unfinish only via update-by-key with updates.status === 'open' and only if currentUser is a supervisor role
        if (endpoint && endpoint.includes('/api/circlemail/update-by-key') && safePayload && safePayload.updates && safePayload.updates.status === 'open') {
          if (!(currentUser && (currentUser.role === 'مشرف عام' || currentUser.role === 'مشرف'))) {
            throw new Error('لا يمكنك التراجع عن إنهاء المعاملة إلا كمشرف.');
          }
          // allowed
        } else {
          throw new Error('هذه المعاملة مُنهية ولا يمكن تعديلها أو إضافة مرفقات أو تاريخ لها.');
        }
      }

      return await fetchJson(endpoint, {
        method,
        body: JSON.stringify(safePayload),
      });
    } catch (err) {
      // rethrow for callers
      throw err;
    }
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
    // Common outgoing/incoming headers (Arabic + English variants)
    [normalizeHeader('الرقم المتسلسل')]: 'serial',
    [normalizeHeader('رقم متسلسل')]: 'serial',
    [normalizeHeader('تسلسل')]: 'serial',
    [normalizeHeader('serial')]: 'serial',
    [normalizeHeader('serial number')]: 'serial',
    [normalizeHeader('الرقم')]: 'serial',
    [normalizeHeader('التاريخ')]: 'date',
    [normalizeHeader('date')]: 'date',
    [normalizeHeader('المستلم')]: 'recipient',
    [normalizeHeader('الجهة')]: 'recipient',
    [normalizeHeader('الجهة المرسل إليها')]: 'recipient',
    [normalizeHeader('recipient')]: 'recipient',
    [normalizeHeader('subject')]: 'subject',
    [normalizeHeader('المضمون')]: 'subject',
    [normalizeHeader('الموضوع')]: 'subject',
    [normalizeHeader('الرقم الوارد القديم')]: 'oldNo',
    [normalizeHeader('old no')]: 'oldNo',
    [normalizeHeader('oldno')]: 'oldNo',
    [normalizeHeader('تاريخ الوارد القديم')]: 'oldDate',
    [normalizeHeader('old date')]: 'oldDate',
    [normalizeHeader('التحويل')]: 'transfer',
    [normalizeHeader('transfer')]: 'transfer',
    [normalizeHeader('الرقم الوارد الجديد')]: 'newNo',
    [normalizeHeader('new no')]: 'newNo',
    [normalizeHeader('تاريخ الوارد الجديد')]: 'newDate',
    [normalizeHeader('new date')]: 'newDate',
    // Exact headers from user's file
    [normalizeHeader('رقم المتسلسل')]: 'serial',
    [normalizeHeader('الجهة الصادر اليها')]: 'recipient',
    [normalizeHeader('الوارد القديم')]: 'oldNo',
    [normalizeHeader('الوارد الجديد')]: 'newNo',
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

  // Pagination Helper Functions
  const renderPagination = (containerId, type, totalItems, currentPage) => {
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'pagination-controls';
    }
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    container.innerHTML = `
      <button class="btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="changePage('${type}', -1)">
        <i class="fa-solid fa-chevron-right"></i> السابق
      </button>
      <span class="page-info">صفحة ${currentPage} من ${totalPages}</span>
      <button class="btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changePage('${type}', 1)">
        التالي <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;
    return container;
  };

  window.changePage = (type, delta) => {
    if (type === 'outgoing') { currentPageOutgoing += delta; render(searchInput.value); }
    else if (type === 'incoming') { currentPageIncoming += delta; renderIncoming(searchInputIncoming.value); }
    else if (type === 'reception') { currentPageReception += delta; renderReception(searchInputReception.value); }
    
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (statTotalEl) statTotalEl.textContent = items.length + itemsIncoming.length + itemsReception.length + itemsArchive.length;
    const cardOutgoing = document.getElementById('cardOutgoingCount');
    const cardIncoming = document.getElementById('cardIncomingCount');
    const cardReception = document.getElementById('cardReceptionCount');
    const cardArchives = document.getElementById('cardArchivesCount');
    const archiveLateEl = document.getElementById('archiveLateCount');
    const archiveListEl = document.getElementById('archiveListCount');
    if (cardOutgoing) cardOutgoing.textContent = items.length;
    if (cardIncoming) cardIncoming.textContent = itemsIncoming.length;
    if (cardReception) cardReception.textContent = itemsReception.length;
    if (cardArchives) cardArchives.textContent = itemsArchive.length;
    if (archiveListEl) archiveListEl.textContent = itemsArchive.length;
    if (archiveLateEl) {
      try {
        archiveLateEl.textContent = getArchiveOverdueUniqueCount();
      } catch (e) {
        archiveLateEl.textContent = '0';
      }
    }
  };

  const archiveSectionLabels = {
    studies: 'الدراسات',
    tech: 'ديوان الشؤون الفنية',
    gov: 'الجهات الحكومية',
    legal: 'القانونية',
    gov2: 'أخرى'
  };

  const getArchiveBaseStatus = (status) => {
    const text = String(status || '').trim();
    if (!text) return 'قيد العمل';
    if (text.includes('متأخرة') || text === 'overdue' || text === 'late') return 'متأخرة';
    if (text.includes('منتهية') || text === 'منتهي' || text === 'finished') return 'منتهية';
    if (text.includes('تم الاستلام')) return 'تم الاستلام';
    return 'قيد العمل';
  };

  const buildArchiveStatusValue = (baseStatus, department = '') => {
    const dep = String(department || '').trim();
    if (!dep) return baseStatus || 'قيد العمل';
    return `${baseStatus || 'قيد العمل'} - ${dep}`;
  };

  const parseArchiveStatus = (status) => {
    const text = String(status || '').trim();
    if (!text) return { base: 'قيد العمل', department: '' };
    const match = text.match(/^(قيد العمل|متأخرة|منتهية|تم الاستلام)\s*-\s*(.+)$/);
    if (match) return { base: match[1], department: match[2].trim() };
    return { base: getArchiveBaseStatus(text), department: '' };
  };

  const inferArchiveDepartmentFromItem = (item) => {
    if (!item) return '';
    const departmentFromItem = [
      item.lastTransferredTo,
      item.department,
      item.currentDepartment,
      item.circleName,
      item.currentDepartmentName
    ].find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    if (departmentFromItem) return String(departmentFromItem).trim();
    for (const [section, label] of Object.entries(archiveSectionLabels)) {
      const sectionData = item[section];
      if (sectionData && (sectionData.savedAt || (sectionData.expected && String(sectionData.expected.value || '').trim()))) return label;
    }
    return '';
  };

  const isArchiveFinishedStatus = (status) => {
    const text = String(status || '').trim();
    return text.includes('منتهية') || text === 'منتهي' || text === 'finished';
  };

  const getArchiveDepartmentFromStatus = (status) => parseArchiveStatus(status).department;

  const getArchiveStatusDisplayValue = (status) => {
    const parsed = parseArchiveStatus(status);
    return buildArchiveStatusValue(parsed.base, parsed.department);
  };

  const getArchiveOverdueDepartmentForItem = (item) => {
    if (!item) return '';

    if (window.ArchiveTransferState && typeof window.ArchiveTransferState.resolveArchiveOverdueDepartmentForDisplay === 'function') {
      return window.ArchiveTransferState.resolveArchiveOverdueDepartmentForDisplay(item, Date.now());
    }

    return '';
  };

  const syncArchiveStatuses = () => {
    if (!Array.isArray(itemsArchive)) return;
    itemsArchive.forEach(item => {
      if (!item) return;
      const statusInfo = window.ArchiveTransferState && typeof window.ArchiveTransferState.deriveArchiveStatusInfo === 'function'
        ? window.ArchiveTransferState.deriveArchiveStatusInfo(item, Date.now())
        : { base: 'قيد العمل', department: inferArchiveDepartmentFromItem(item) || '' };
      const department = statusInfo.department || inferArchiveDepartmentFromItem(item) || '';
      item.status = buildArchiveStatusValue(statusInfo.base, department);
    });
  };

  const convertExpectedToMinutes = (value, unit) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    const u = String(unit || '').trim().toLowerCase();
    if (u === 'minutes' || u === 'minute' || u === 'دقيقة') return num;
    if (u === 'hours' || u === 'hour' || u === 'ساعة') return num * 60;
    if (u === 'days' || u === 'day' || u === 'يوم') return num * 24 * 60;
    if (u === 'months' || u === 'month' || u === 'شهر') return num * 30 * 24 * 60;
    return num;
  };

  const getLocalArchiveOverdueRows = () => {
    const now = Date.now();
    const sectionLabels = {
      studies: 'الدراسات',
      tech: 'ديوان الشؤون الفنية',
      gov: 'الجهات الحكومية',
      legal: 'القانونية',
      gov2: 'أخرى'
    };
    const rows = [];
    (itemsArchive || []).forEach(item => {
      if (!item || isArchiveFinishedStatus(item.status)) return;
      let bestOverdue = null;
      Object.keys(sectionLabels).forEach(section => {
        const sectionData = item[section];
        const expected = sectionData && sectionData.expected;
        const savedAt = sectionData && sectionData.savedAt;
        if (!expected || !savedAt) return;
        const minutes = convertExpectedToMinutes(expected.value, expected.unit);
        if (minutes <= 0) return;
        const savedTimestamp = new Date(savedAt).getTime();
        if (isNaN(savedTimestamp)) return;
        const deadlineMs = savedTimestamp + minutes * 60 * 1000;
        if (deadlineMs <= now) {
          const delayMinutes = Math.max(0, Math.round((now - deadlineMs) / 60000));
          const row = {
            dossierId: item.id,
            projectName: item.projectName || item.subject || item.recipient || 'غير مسمى',
            currentDepartment: window.ArchiveTransferState && typeof window.ArchiveTransferState.resolveArchiveDepartmentForDisplay === 'function'
              ? window.ArchiveTransferState.resolveArchiveDepartmentForDisplay(item)
              : sectionLabels[section],
            assignedDuration: `${expected.value || 0} ${expected.unit || ''}`.trim(),
            deadlineAt: new Date(deadlineMs).toISOString(),
            delayDuration: window.ArchiveTransferState && typeof window.ArchiveTransferState.formatArchiveDelayDuration === 'function'
              ? window.ArchiveTransferState.formatArchiveDelayDuration(delayMinutes)
              : `${delayMinutes} دقيقة`,
            status: item.status || 'قيد التفعيل'
          };
          if (!bestOverdue || deadlineMs < new Date(bestOverdue.deadlineAt).getTime()) {
            bestOverdue = row;
          }
        }
      });
      if (bestOverdue) rows.push(bestOverdue);
    });
    return rows;
  };

  const mergeOverdueRows = (serverRows, localRows) => {
    const seen = new Set();
    const merged = [];
    (serverRows || []).forEach(row => {
      const id = Number(row && row.dossierId);
      if (Number.isFinite(id) && !seen.has(id)) {
        seen.add(id);
        merged.push(row);
      }
    });
    (localRows || []).forEach(row => {
      const id = Number(row && row.dossierId);
      if (Number.isFinite(id) && !seen.has(id)) {
        seen.add(id);
        merged.push(row);
      }
    });
    return merged;
  };

  const getArchiveOverdueUniqueCount = () => {
    const ids = new Set();
    getLocalArchiveOverdueRows().forEach(r => {
      const id = Number(r.dossierId);
      if (Number.isFinite(id)) ids.add(id);
    });
    if (window.__overdueDossierIds && typeof window.__overdueDossierIds.size === 'number') {
      Array.from(window.__overdueDossierIds).forEach(id => {
        const num = Number(id);
        if (Number.isFinite(num)) ids.add(num);
      });
    }
    return ids.size;
  };

  // Enhance dashboard stats with archive-specific counts
  const archiveLateEl = document.getElementById('archiveLateCount');
  const archiveListEl = document.getElementById('archiveListCount');
  if (archiveListEl) archiveListEl.textContent = itemsArchive.length;
  if (archiveLateEl) {
    try {
      archiveLateEl.textContent = getArchiveOverdueUniqueCount();
    } catch (e) { /* ignore */ }
  }

  const circles = [
    'مكتب السيد المدير', 'الرقابة الداخلية', 'التخطيط والمتابعة', 'الآليات', 'المكتب الإعلامي', 'ديوان الشؤون الفنية',
    'النفايات الصلبة', 'الدراسات', 'الطرق', 'تنفيذ الأبنية', 'التخطيط العمراني', 'المعلوماتية', 'الطبوغرافيا',
    'الديوان العام', 'الموارد البشرية', 'التدريب والتأهيل', 'المالية', 'القانونية', 'الاستثمارية', 'الجاهزية',
    'لجنة الشراء', 'المستودع', 'المتابعة'
  ];

  const populateCircleSelectOptions = () => {
    const selectIds = ['fieldTransfer', 'inFieldTransferTo'];
    selectIds.forEach((id) => {
      const selectEl = document.getElementById(id);
      if (!selectEl) return;
      const currentValue = selectEl.value || '';
      const options = ['<option value="">-- اختر الدائرة --</option>'];
      circles.forEach((circleName) => {
        options.push(`<option value="${circleName}">${circleName}</option>`);
      });
      selectEl.innerHTML = options.join('');
      if (currentValue) {
        selectEl.value = currentValue;
      }
    });
  };

  // Circles that should show the 3-action buttons instead of the normal modal list
  const specialCircles = new Set(['مكتب السيد المدير','التخطيط والمتابعة','الدراسات','ديوان الشؤون الفنية','المتابعة','القانونية','الديوان العام']);

  let itemsCircleMail = [];
  let histories = [];

  populateCircleSelectOptions();

  const getNotificationsForCircle = (circleName) => {
    if (!circleName) return [];
    return getNotificationsForCircleByCategory(circleName, 'MAIL');
  };

  const getNotificationsForCircleByCategory = (circleName, category) => {
    if (!circleName) return [];
    const cat = String(category || '').toUpperCase();
    return (itemsCircleMail || []).filter(cm => {
      if (cm.circleName !== circleName) return false;
      if (cm.status === 'finished') return false;
      // determine category: prefer explicit `recordCategory`, then `recordType`, then legacy `record_type` in payload
      try {
        let cval = null;
        if (cm.recordCategory) cval = String(cm.recordCategory);
        else if (cm.recordType) cval = String(cm.recordType);
        else {
          const p = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {};
          if (p && p.recordCategory) cval = String(p.recordCategory);
          else if (p && p.record_type) cval = String(p.record_type);
        }
        const sourceEntity = String(cm.sourceEntity || '').trim().toLowerCase();
        const isArchiveSource = sourceEntity.includes('archive');
        if (cval) {
          const norm = String(cval || '').trim().toLowerCase();
          const isD = (norm === 'dossier' || norm === 'dosier' || norm === 'اضابير');
          const isM = (norm === 'mail' || norm === 'بريد عادي');
          if (cat === 'DOSSIER') return isD || isArchiveSource;
          if (cat === 'MAIL') return isM || (!isD && !isArchiveSource);
        }
        if (cat === 'DOSSIER') return isArchiveSource;
        if (cat === 'MAIL') return !isArchiveSource;
        return false;
      } catch (e) {}
      // default fallback: treat as MAIL
      return cat === 'MAIL';
    });
  };

  const parseCirclePayload = (cm) => {
    if (!cm) return {};
    try {
      if (!cm.payload) return {};
      if (typeof cm.payload === 'string') return JSON.parse(cm.payload);
      return cm.payload;
    } catch (e) {
      console.warn('Failed to parse circle payload for id', cm.id, e);
      return { raw: cm.payload };
    }
  };

  const getCircleMailTypeLabel = (sourceEntity) => {
    const info = getEntityInfo(sourceEntity || '');
    if (info.key === 'outgoing') return 'البريد الصادر';
    if (info.key === 'incoming') return 'البريد الوارد';
    if (info.key === 'reception') return 'الاستقبال والشكاوى';
    return info.display || 'بريد دائرة';
  };

  const getCircleMailListRowValues = (cm) => {
    const payload = parseCirclePayload(cm);
    let subject = payload.subject || payload.name || payload.request || payload.requestType || payload.description || payload.notes || payload.request || payload.requestNo || payload.note || payload.details || '-';
    if (!subject && cm.sourceEntity && payload && payload.sender) subject = payload.sender;
    if (!subject) subject = '-';

    const type = getCircleMailTypeLabel(cm.sourceEntity);

    const dateValues = [payload.date, payload.arriveDate, payload.inDate, payload.submissionDate, payload.arriveDate, payload.oldDate, payload.newDate, payload.createdAt, cm.createdAt, cm.updatedAt];
    let date = '-';
    for (const val of dateValues) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const formatted = window.formatDateForDisplay ? window.formatDateForDisplay(val) : null;
        if (formatted && formatted !== '-') {
          date = formatted;
          break;
        }
      }
    }

    let attachments = [];
    try {
      if (Array.isArray(cm.attachments)) attachments = cm.attachments;
      else if (cm.attachments) attachments = JSON.parse(cm.attachments);
      else if (payload.attachments) attachments = Array.isArray(payload.attachments) ? payload.attachments : JSON.parse(payload.attachments);
    } catch (e) {
      attachments = [];
    }
    attachments = Array.isArray(attachments) ? attachments : [];

    return { subject, type, date, attachments };
  };

  // Archive rendering
  const archiveTableBody = document.querySelector('#archiveTable tbody');
  const selectAllArchiveCheckbox = document.getElementById('selectAllArchive');

  const renderArchive = (filter='') => {
    if (!archiveTableBody) return;
    archiveTableBody.innerHTML = '';
    let sourceList = itemsArchive || [];
    // if opened from a circle, restrict to archives that have been transferred to that circle
    if (archiveListCircleFilter) {
      try {
          // Collect transferred IDs for this circle. Be resilient: CircleMail records
          // may store the original id in `sourceId`, or within `payload` (possibly nested),
          // or under different id-like keys (archiveId, _id, etc.). We'll recursively
          // walk payload objects to gather any id-like values.
          const transferredIds = new Set();
          const collectIdsFromObject = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            // direct id keys
            ['id','ID','Id','_id','archiveId','sourceId','sourceid','source_id'].forEach(k => {
              if (obj.hasOwnProperty(k) && obj[k] !== undefined && obj[k] !== null && String(obj[k]) !== '') transferredIds.add(String(obj[k]));
            });
            // also inspect any nested objects/strings
            Object.keys(obj).forEach(k => {
              try {
                const v = obj[k];
                if (v && typeof v === 'object') collectIdsFromObject(v);
                // if it's a JSON string, try parse and recurse
                else if (typeof v === 'string' && v.trim().startsWith('{')) {
                  try { const parsed = JSON.parse(v); collectIdsFromObject(parsed); } catch (e) {}
                }
              } catch (e) {}
            });
          };

          const targetCircleName = String(archiveListCircleFilter || '').trim().toLowerCase();
          (itemsCircleMail || []).forEach(cm => {
            if (String(cm.circleName || '').trim().toLowerCase() !== targetCircleName) return;
            // Only consider circleMail entries that represent dossiers for archive matching
            try {
              let category = null;
              if (cm.recordCategory) category = String(cm.recordCategory);
              else if (cm.recordType) category = String(cm.recordType);
              else {
                const p = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {};
                if (p && p.recordCategory) category = String(p.recordCategory);
                else if (p && p.record_type) category = String(p.record_type);
              }
              const normCategory = String(category || '').trim().toLowerCase();
              const isDossier = normCategory === 'dossier' || normCategory === 'اضابير' || normCategory === 'dosier';
              const isArchiveSource = String(cm.sourceEntity || '').trim().toLowerCase().includes('archive');
              if (!isDossier && !isArchiveSource) return; // skip non-dossier non-archive
            } catch (e) { /* ignore and continue */ }
            // explicit sourceId
            if (cm.sourceId !== undefined && cm.sourceId !== null && String(cm.sourceId) !== '') transferredIds.add(String(cm.sourceId));
            // try parsing payload and nested payloads
            try {
              const p = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : null;
              if (p) collectIdsFromObject(p);
            } catch (e) {}
          });
          // Also include histories that represent transfers of archives to this circle
          try {
            (histories || []).forEach(h => {
              if (!h) return;
              try {
                if (String(h.action) !== 'transferred') return;
                if (String(h.circleName) !== String(archiveListCircleFilter)) return;
                const se = String(h.sourceEntity || '').toLowerCase();
                if (!se.includes('archive')) return;
                if (h.sourceId !== undefined && h.sourceId !== null && String(h.sourceId) !== '') transferredIds.add(String(h.sourceId));
              } catch (e) {}
            });
          } catch (e) {}

          sourceList = sourceList.filter(it => transferredIds.has(String(it.id)));
        } catch (e) { /* ignore and fallback to full list */ }
    }
    try { syncArchiveStatuses(); } catch (e) {}
    const filtered = sourceList.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPageArchive > totalPages) currentPageArchive = Math.max(1, totalPages);
    const rows = filtered.slice((currentPageArchive - 1) * PAGE_SIZE, currentPageArchive * PAGE_SIZE);

    rows.forEach(it => {
      const tr = document.createElement('tr');
      const projectName = it.projectName || it.subject || it.recipient || it.serial || 'غير مسمى';
      const statusLabel = getArchiveStatusDisplayValue(it.status) || '-';
      const archiveFinished = isArchiveFinishedStatus(it.status);
      const canManageArchive = canManageSensitiveActions();
      tr.innerHTML = `
        <td class="row-select"><input type="checkbox" ${it._selected ? 'checked' : ''} aria-label="تحديد السطر" /></td>
        <td>${projectName}</td>
        <td>${it.createDate || it.date || '-'}</td>
        <td>${statusLabel}</td>
        <td class="actions">
          <div class="row-action-buttons">
            <button class="btn small" data-action="transfer" ${archiveFinished ? 'disabled' : ''}>تحويل</button>
            <button class="btn small" data-action="edit" ${archiveFinished ? 'disabled' : ''}>تعديل</button>
            <button class="btn small" data-action="finish" ${!canManageArchive ? 'disabled' : ''}>${archiveFinished ? 'تراجع عن الانتهاء' : 'انهاء'}</button>
            <button class="btn small" data-action="delete" ${!canManageArchive ? 'disabled' : ''}>حذف</button>
          </div>
        </td>
      `;
      const checkbox = tr.querySelector('.row-select input[type="checkbox"]');
      if (it._selected) tr.classList.add('selected');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          it._selected = e.target.checked;
          tr.classList.toggle('selected', e.target.checked);
          updateSelectAllCheckboxState(selectAllArchiveCheckbox, rows);
        });
      }
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      const transferBtn = tr.querySelector('[data-action="transfer"]');
      const editBtn = tr.querySelector('[data-action="edit"]');
      const finishBtn = tr.querySelector('[data-action="finish"]');
      if (deleteBtn) {
        deleteBtn.title = getSensitiveActionTitle(canManageArchive);
        deleteBtn.addEventListener('click', async () => {
          if (!canManageArchive) return;
          if (!confirm('هل تريد حذف هذا السجل؟')) return;
          registerDeletedRecordInTrash('archive', it);
          itemsArchive = itemsArchive.filter(x => x !== it);
          saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
          renderArchive(filter);
          renderTrash();
        });
      }
      if (transferBtn) {
        transferBtn.title = archiveFinished ? 'لا يمكن التحويل بعد إنهاء الأضبارة' : '';
        transferBtn.addEventListener('click', () => showTransferModal(it, 'archive', null, it.id));
      }
      if (finishBtn) {
        finishBtn.title = getSensitiveActionTitle(canManageArchive);
        finishBtn.addEventListener('click', () => {
          if (!canManageArchive) return;
          const currentDepartment = inferArchiveDepartmentFromItem(it) || getArchiveDepartmentFromStatus(it.status);
          it.status = isArchiveFinishedStatus(it.status) ? buildArchiveStatusValue('قيد العمل', currentDepartment) : 'منتهية';
          saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
          renderArchive(filter);
        });
      }
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => { populateArchiveForm(it); });
      const viewBtnArchive = tr.querySelector('[data-action="view"]');
      if (viewBtnArchive) viewBtnArchive.addEventListener('click', () => { showAttachmentsModal(it.attachments || [], 'مرفقات الأضبارة'); });
      annotateTooltipCells(tr);
      archiveTableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllArchiveCheckbox, filtered);

    const pag = renderPagination('archivePagination', 'archive', filtered.length, currentPageArchive);
    const wrapper = document.querySelector('#archiveTable').parentElement;
    if (!document.getElementById('archivePagination')) wrapper.appendChild(pag);
  };

  const renderCircles = () => {
    const container = document.getElementById('circlesContainer');
    if (!container) return;
    container.innerHTML = '';
    circles.forEach(name => {
      const card = document.createElement('div');
      card.className = 'circle-card';
      const mailCount = getNotificationsForCircleByCategory(name, 'MAIL').length;
      const dossierCount = getNotificationsForCircleByCategory(name, 'DOSSIER').length;
      const mailBadgeClass = mailCount === 0 ? 'circle-badge zero' : 'circle-badge mail';
      const dossierBadgeClass = dossierCount === 0 ? 'circle-badge zero' : 'circle-badge dossier';
      const mailBadge = `<div class="${mailBadgeClass}">${mailCount}</div>`;
      const dossierBadge = `<div class="${dossierBadgeClass}" style="margin-left:6px">${dossierCount}</div>`;
      card.innerHTML = `<div class="circle-name">${name}</div><div style="display:flex;gap:6px;align-items:center">${mailBadge}${dossierBadge}</div>`;
      if (currentUser && !isSupervisorRole(currentUser) && currentUser.role !== name) {
        card.classList.add('disabled');
        card.title = 'ليس لديك صلاحية الوصول لهذه الدائرة';
      } else {
      if (specialCircles.has(name)) {
        card.addEventListener('click', () => openCircleActions(name));
      } else {
        card.addEventListener('click', () => openCircleModal(name));
      }
      }
      container.appendChild(card);
    });
  };

  // Open a compact actions view (3 big buttons) for selected circles
  const openCircleActions = (name) => {
    try { pushCurrentToHistory(); } catch(e){}
    const modal = document.getElementById('circleModal');
    const title = document.getElementById('circleModalTitle');
    const body = document.getElementById('circleNotifList');
    if (!modal || !title || !body) return;
    title.textContent = name;
    body.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.gap = '18px';
    wrap.style.alignItems = 'center';
    wrap.style.justifyItems = 'stretch';
    wrap.style.padding = '18px';

    // Responsive: on wider screens show 2 columns for the action buttons
    const mq = window.matchMedia('(min-width:800px)');
    const applyCols = () => { wrap.style.gridTemplateColumns = mq.matches ? '1fr 1fr' : '1fr'; };
    applyCols(); mq.addEventListener && mq.addEventListener('change', applyCols);

    const makeBtn = (txt, id, bg='#1e3a8a') => {
      const b = document.createElement('button'); b.id = id; b.className = 'btn'; b.textContent = txt;
      b.style.padding = '26px 18px'; b.style.fontSize = '20px'; b.style.borderRadius = '12px'; b.style.width = '100%'; b.style.background = bg; b.style.color = '#fff'; b.style.border = 'none';
      return b;
    };

    const mailBtn = makeBtn('سجل البريد', 'circleActionMail', '#059669');
    const archiveBtn = makeBtn('سجل الأضابير', 'circleActionArchive', '#dc2626');

    mailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // open the existing circle mail modal/list
      modal.classList.add('hidden');
      // small delay to allow modal hide animation if any
      setTimeout(() => openCircleModal(name), 50);
    });

    archiveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.classList.add('hidden');
      setTimeout(() => { openArchiveList(true, name); }, 50);
    });

    wrap.appendChild(mailBtn); wrap.appendChild(archiveBtn);
    body.appendChild(wrap);

    // show modal (full-screen style)
    modal.classList.remove('hidden');
    modal.classList.add('fullscreen-mode');
    const win = modal.querySelector('.modal-window'); if (win) win.classList.add('full-screen');
    try { attachLocalBackToCurrentView(); } catch (e) {}
  };

  const openCircleModal = (name) => {
    try { pushCurrentToHistory(); } catch(e){}
    const modal = document.getElementById('circleModal');
    const title = document.getElementById('circleModalTitle');
    const bodyList = document.getElementById('circleNotifList');
    const countEl = document.getElementById('circleNotifCount');
    if (!modal || !title || !bodyList) return;
    title.textContent = name;
    const matches = getNotificationsForCircle(name).slice().sort((a, b) => {
      const getTimestamp = (item) => {
        const payload = parseCirclePayload(item);
        const dateValues = [
          payload.date,
          payload.arriveDate,
          payload.inDate,
          payload.submissionDate,
          payload.oldDate,
          payload.newDate,
          payload.createdAt,
          item.createdAt,
          item.updatedAt,
        ];
        for (const val of dateValues) {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const ts = new Date(val).getTime();
            if (!Number.isNaN(ts)) return ts;
          }
        }
        return 0;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
    countEl.textContent = matches.length;
    bodyList.innerHTML = '';
    if (!matches.length){
      bodyList.innerHTML = '<div>لا توجد إشعارات حالياً.</div>';
    } else {
      // Decide which headers to show: prefer the entity-specific headers (outgoing/incoming/reception).
      // If payloads look like archives, use archive-style columns.
      const looksLikeArchive = (cm) => {
        try {
          const p = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {};
          return p && (p.projectName || p.createDate || p.status || p.serial);
        } catch (e) { return false; }
      };

      // determine the rendering mode for the modal rows
      // For outgoing/incoming/reception transfers, always render the minimal mail record columns.
      // Only use archive layout when the source is explicitly an archive record.
      const useArchiveLayout = matches.some(cm => {
        const sourceEntity = String(cm.sourceEntity || '').toLowerCase();
        return sourceEntity.includes('archive');
      });
      const table = document.createElement('table');
      table.className = 'data-table circle-table';
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      if (!useArchiveLayout) {
        const columns = ['المضمون', 'نوع البريد', 'التاريخ', 'المرفقات', 'إجراءات'];
        columns.forEach(text => { const th = document.createElement('th'); th.textContent = text; headerRow.appendChild(th); });
      } else {
        // Archive layout: projectName, createDate, status, attachments, actions
        const cols = [{k:'projectName', l:'اسم المشروع'},{k:'createDate', l:'تاريخ الإنشاء'},{k:'status', l:'الحالة'}];
        cols.forEach(c => { const th = document.createElement('th'); th.textContent = c.l; headerRow.appendChild(th); });
        const attTh = document.createElement('th'); attTh.textContent = 'المرفقات'; headerRow.appendChild(attTh);
        const actionsTh = document.createElement('th'); actionsTh.textContent = 'إجراءات'; headerRow.appendChild(actionsTh);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      matches.slice(0,200).forEach(cm => {
        const payload = parseCirclePayload(cm);
        const tr = document.createElement('tr');
        // add columns in order according to the chosen layout
        if (!useArchiveLayout) {
          const rowValues = getCircleMailListRowValues(cm);
          const subjectTd = document.createElement('td'); subjectTd.textContent = rowValues.subject; tr.appendChild(subjectTd);
          const typeTd = document.createElement('td'); typeTd.textContent = rowValues.type; tr.appendChild(typeTd);
          const dateTd = document.createElement('td'); dateTd.textContent = rowValues.date; tr.appendChild(dateTd);
          const attTd = document.createElement('td'); attTd.textContent = rowValues.attachments.length ? rowValues.attachments.map(a => a.name || a).join(', ') : '-'; tr.appendChild(attTd);
        } else {
          const keys = ['projectName','createDate','status'];
          keys.forEach(k => {
            const td = document.createElement('td');
            let v = '-';
            if (payload && payload.hasOwnProperty(k)) v = payload[k];
            else if (payload && k === 'projectName' && payload.subject) v = payload.subject;
            else if (payload && k === 'createDate' && payload.date) v = payload.date;
            if (Array.isArray(v)) td.textContent = v.join(', ');
            else td.textContent = (v === undefined || v === null || v === '') ? '-' : v;
            tr.appendChild(td);
          });
        }

        // actions
        const actTd = document.createElement('td'); actTd.style.display = 'flex'; actTd.style.gap = '6px';
        // Only keep the 'عرض المعاملة' button in the row actions
        const viewRowBtn = document.createElement('button'); viewRowBtn.className = 'btn primary'; viewRowBtn.textContent = 'عرض المعاملة'; viewRowBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          (async () => {
            try {
              await loadCircleMails();
              const fresh = itemsCircleMail.find(x => x.sourceEntity === cm.sourceEntity && x.sourceId === cm.sourceId && x.circleName === cm.circleName);
              if (!fresh) { alert('تعذر العثور على السجل بعد التحديث.'); return; }
              await showTransactionFull(fresh);
            } catch (err) { console.error(err); alert('فشل عند فتح المعاملة'); }
          })();
        });
        actTd.appendChild(viewRowBtn);
        // make the whole row clickable to open full-screen detail
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', async () => {
          try {
            await loadCircleMails();
            const fresh = itemsCircleMail.find(x => x.sourceEntity === cm.sourceEntity && x.sourceId === cm.sourceId && x.circleName === cm.circleName);
            if (!fresh) {
              alert('تعذر العثور على السجل بعد التحديث.');
              return;
            }
            showCircleMailDetail(fresh);
          } catch (e) { console.error(e); alert('فشل عند فتح تفصيل السجل'); }
        });
        tr.appendChild(actTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      bodyList.appendChild(table);
    }
    // تطبيق نمط ملء الشاشة على نافذة الدوائر
    modal.classList.add('fullscreen-mode');
    const win = modal.querySelector('.modal-window');
    if (win) win.classList.add('full-screen');
    modal.classList.remove('hidden');
    try { attachLocalBackToCurrentView(); } catch (e) {}
  };

  const showCircleMailDetail = (cm) => {
    const modal = document.getElementById('circleModal');
    const title = document.getElementById('circleModalTitle');
    const bodyList = document.getElementById('circleNotifList');
    if (!modal || !bodyList) return;
    let payload = {};
    try { payload = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {}; } catch (e) { payload = { raw: cm.payload }; }
    bodyList.innerHTML = '';
    title.textContent = `سجل — ${cm.circleName || ''}`;
    const wrap = document.createElement('div'); wrap.className = 'card'; wrap.style.padding = '18px';

    const header = document.createElement('div'); header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
    const entityInfo = getEntityInfo(cm.sourceEntity);
    const hleft = document.createElement('div'); hleft.innerHTML = `<h2 style="margin:0">${payload.subject || payload.name || 'سجل'}</h2><div style="color:#64748b">من المصدر: ${entityInfo.display || '-'} ${cm.sourceId ? '#'+cm.sourceId : ''}</div>`;
    const createdAtText = payload.createdAt ? (new Date(payload.createdAt)).toLocaleString() : (cm.createdAt ? (new Date(cm.createdAt)).toLocaleString() : '-');
    const hright = document.createElement('div'); hright.style.textAlign = 'left'; hright.innerHTML = `<div>الحالة: <strong>${cm.status || 'open'}</strong></div><div>مُستلم عند: <strong>${createdAtText}</strong></div>`;
    header.appendChild(hleft); header.appendChild(hright);
    wrap.appendChild(header);

    // Details grid: show fields in the original order based on sourceEntity headers
    const details = document.createElement('div'); details.style.display = 'grid'; details.style.gridTemplateColumns = '1fr 1fr'; details.style.gap = '12px'; details.style.marginTop = '16px';
    const headerOrderMap = {
      outgoing: Object.keys(outgoingHeaders || {}),
      incoming: Object.keys(incomingHeaders || {}),
      reception: Object.keys(receptionHeaders || {}),
    };
    const orderKeys = headerOrderMap[entityInfo.key] || [];
    const shown = new Set();
    // First show keys in header order with their Arabic labels when available
    orderKeys.forEach(k => {
      if (payload.hasOwnProperty(k)){
        const v = payload[k];
        const card = document.createElement('div'); card.style.background = '#fbfdff'; card.style.padding = '10px'; card.style.borderRadius = '8px';
        const key = document.createElement('div'); key.style.fontWeight = '700'; key.textContent = (outgoingHeaders[k] || incomingHeaders[k] || receptionHeaders[k] || k);
        const val = document.createElement('div');
        if (Array.isArray(v)) val.textContent = v.join(', ');
        else if (typeof v === 'object' && v !== null) val.textContent = JSON.stringify(v);
        else val.textContent = v || '-';
        card.appendChild(key); card.appendChild(val); details.appendChild(card);
        shown.add(k);
      }
    });
    // Then show remaining fields in insertion order
    Object.keys(payload).forEach(k => {
      if (shown.has(k)) return;
      const v = payload[k];
      const card = document.createElement('div'); card.style.background = '#fbfdff'; card.style.padding = '10px'; card.style.borderRadius = '8px';
      const labelText = (outgoingHeaders[k] || incomingHeaders[k] || receptionHeaders[k] || k);
      const key = document.createElement('div'); key.style.fontWeight = '700'; key.textContent = labelText;
      const val = document.createElement('div');
      if (Array.isArray(v)) val.textContent = v.join(', ');
      else if (typeof v === 'object' && v !== null) val.textContent = JSON.stringify(v);
      else val.textContent = v || '-';
      card.appendChild(key); card.appendChild(val); details.appendChild(card);
    });
    wrap.appendChild(details);

    // Attachments
    const attachWrap = document.createElement('div'); attachWrap.style.marginTop = '16px';
    const attachTitle = document.createElement('div'); attachTitle.style.fontWeight = '700'; attachTitle.textContent = 'المرفقات'; attachWrap.appendChild(attachTitle);
    const preview = document.createElement('div'); preview.style.marginTop = '8px';
    try {
      const attsFromTop = Array.isArray(cm.attachments) ? cm.attachments : (cm.attachments ? JSON.parse(cm.attachments) : null);
      let attsFromPayload = [];
      if (payload && payload.attachments) {
        if (Array.isArray(payload.attachments)) attsFromPayload = payload.attachments;
        else if (typeof payload.attachments === 'string') {
          try { attsFromPayload = JSON.parse(payload.attachments); } catch (e) { attsFromPayload = []; }
        }
      }
      const atts = attsFromTop || attsFromPayload || [];
      renderPreview(preview, atts || []);
    } catch (e) { }
    attachWrap.appendChild(preview);
    wrap.appendChild(attachWrap);

    // Actions row at bottom
    const actions = document.createElement('div'); actions.style.marginTop = '18px'; actions.style.display = 'flex'; actions.style.gap = '8px'; actions.style.justifyContent = 'flex-end';
    const timelineBtn = document.createElement('button'); timelineBtn.className = 'btn'; timelineBtn.textContent = 'عرض سير المعاملة';
    timelineBtn.addEventListener('click', () => showTimelineByKey(cm));
    const addNoteBtn = document.createElement('button'); addNoteBtn.className = 'btn'; addNoteBtn.textContent = 'اضافة ملاحظة';
    addNoteBtn.addEventListener('click', () => openAddNote(cm));

    const addAttachmentsBtn = document.createElement('button'); addAttachmentsBtn.className = 'btn'; addAttachmentsBtn.textContent = 'اضافة مرفقات';
    addAttachmentsBtn.addEventListener('click', () => openAddAttachments(cm));
    
    const transferBtn = document.createElement('button'); transferBtn.className = 'btn'; transferBtn.textContent = 'تحويل';
    transferBtn.disabled = cm.status === 'finished';
    transferBtn.title = cm.status === 'finished' ? 'لا يمكن التحويل بعد إنهاء المعاملة' : '';
    transferBtn.addEventListener('click', () => showTransferModal(payload, cm.sourceEntity, cm.circleName, cm.sourceId));
    const canManageCircleMail = canManageSensitiveActions();
    const finishBtn = document.createElement('button'); finishBtn.className = 'btn secondary'; finishBtn.textContent = cm.status === 'finished' ? 'تراجع عن الانتهاء' : 'انهاء المعاملة';
    finishBtn.disabled = !canManageCircleMail;
    finishBtn.title = getSensitiveActionTitle(canManageCircleMail);
    finishBtn.addEventListener('click', async () => {
      if (!canManageCircleMail) return;
      try {
        const newStatus = cm.status === 'finished' ? 'open' : 'finished';
        // update by composite key
        await saveToServer('/api/circlemail/update-by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, updates: { status: newStatus } });
        // record history by key
        await saveToServer('/api/history/by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, action: newStatus === 'finished' ? 'finished' : 'reopened', actor: getCurrentActor() });
        await loadCircleMails();
        openCircleModal(cm.circleName);
        alert('تم تحديث حالة المعاملة.');
      } catch (err) { console.error(err); alert('خطأ عند تغيير حالة المعاملة'); }
    });
    actions.appendChild(timelineBtn); actions.appendChild(addNoteBtn); actions.appendChild(addAttachmentsBtn); actions.appendChild(transferBtn); actions.appendChild(finishBtn);
    wrap.appendChild(actions);

    bodyList.appendChild(wrap);
    // make modal full-screen for detail view (force inline styles to ensure full viewport)
    const win = modal.querySelector('.modal-window');
    if (win) {
      win.classList.add('full-screen');
      win.style.position = 'fixed';
      win.style.top = '0';
      win.style.left = '0';
      win.style.right = '0';
      win.style.bottom = '0';
      win.style.width = '100%';
      win.style.height = '100vh';
      win.style.margin = '0';
      win.style.borderRadius = '0';
      win.style.maxWidth = '100%';
      win.style.padding = '24px';
      win.style.display = 'flex';
      win.style.flexDirection = 'column';
    }
    // also mark modal container to relax flex centering so child can truly fill viewport
    modal.classList.add('fullscreen-mode');
    modal.style.alignItems = 'stretch';
    modal.style.justifyContent = 'stretch';
  };

  // Full transaction fullscreen viewer
  const showTransactionFull = async (cm) => {
    const modal = document.getElementById('circleModal');
    const title = document.getElementById('circleModalTitle');
    const bodyList = document.getElementById('circleNotifList');
    if (!modal || !bodyList) return;
    // build merged payload: prefer the explicit payload stored, but fall back to top-level fields on cm
    let payload = {};
    try { payload = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {}; } catch (e) { payload = { raw: cm.payload }; }
    // merge top-level simple fields from cm when missing in payload
    const metaKeys = ['id','sourceEntity','sourceId','circleName','attachments','status','alerted','createdAt','updatedAt','payload'];
    Object.keys(cm || {}).forEach(k => {
      if (metaKeys.includes(k)) return;
      const v = cm[k];
      if (v === undefined || v === null) return;
      if (!payload.hasOwnProperty(k) || payload[k] === '' || payload[k] === null) payload[k] = v;
    });
    title.textContent = `المعاملة — ${cm.circleName || ''}`;
    bodyList.innerHTML = '';

    // Top note area (show latest note if exists).
    const topNoteWrap = document.createElement('div'); topNoteWrap.style.marginBottom = '12px';
    // Fetch histories for this specific composite key so we can reliably find notes
    let lastNote = null;
    try {
      const q = `?sourceEntity=${encodeURIComponent(cm.sourceEntity||'')}&sourceId=${encodeURIComponent(cm.sourceId||'')}${cm.circleName ? `&circleName=${encodeURIComponent(cm.circleName)}` : ''}`;
      const entries = await fetchJson(`${API_BASE}/history/by-key${q}`);
      if (Array.isArray(entries) && entries.length) {
        lastNote = entries.slice().filter(h => h && (h.action === 'note' || h.action === 'note_added' || (h.action === 'transferred' && h.note))).sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
      }
    } catch (e) { /* ignore */ }
    const noteEl = document.createElement('div'); noteEl.style.background='#fff7ed'; noteEl.style.padding='12px'; noteEl.style.borderRadius='8px'; noteEl.style.marginBottom='8px';
    noteEl.textContent = lastNote ? (`ملاحظة: ${lastNote.note || lastNote.action} — ${new Date(lastNote.createdAt).toLocaleString()}`) : 'لا توجد ملاحظات حالياً.';
    topNoteWrap.appendChild(noteEl);

    // Main layout: left fields (readonly), right attachments + upload
    const main = document.createElement('div'); main.style.display='grid'; main.style.gridTemplateColumns='1fr 340px'; main.style.gap='16px';

    // Left fields
    const left = document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column'; left.style.gap='10px';
    const entityInfo = getEntityInfo(cm.sourceEntity);
    const fieldsOrder = (entityInfo.headers) ? Object.keys(entityInfo.headers) : Object.keys(payload);
    fieldsOrder.forEach(k => {
      const wrap = document.createElement('div'); wrap.style.background='#fbfdff'; wrap.style.padding='12px'; wrap.style.borderRadius='8px';
      const label = document.createElement('div'); label.style.fontWeight='700'; label.textContent = (entityInfo.headers && entityInfo.headers[k]) ? entityInfo.headers[k] : k;
      const val = document.createElement('div');
      const v = payload && payload.hasOwnProperty(k) ? payload[k] : '';
      if (Array.isArray(v)) val.textContent = v.join(', ');
      else if (typeof v === 'object' && v !== null) val.textContent = JSON.stringify(v);
      else val.textContent = v || '-';
      wrap.appendChild(label); wrap.appendChild(val); left.appendChild(wrap);
    });

    // Right attachments panel
    const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.gap='8px';
    const attTitle = document.createElement('div'); attTitle.style.fontWeight='800'; attTitle.textContent='المرفقات'; right.appendChild(attTitle);
    const attList = document.createElement('div'); attList.className='preview-list'; attList.style.maxHeight='60vh'; attList.style.overflow='auto';
    const atts = Array.isArray(cm.attachments) ? cm.attachments : (cm.attachments ? JSON.parse(cm.attachments) : (payload.attachments ? (Array.isArray(payload.attachments) ? payload.attachments : JSON.parse(payload.attachments||'[]')) : []));
    renderPreview(attList, atts || []);
    right.appendChild(attList);
    const addAttachBtn = document.createElement('button'); addAttachBtn.className='btn'; addAttachBtn.textContent='إضافة مرفقات جديدة';
    addAttachBtn.addEventListener('click', () => openAddAttachments(cm));
    if (cm && cm.status === 'finished') {
      addAttachBtn.disabled = true;
      addAttachBtn.title = 'المعاملة مُنهية ولا يمكن إضافة مرفقات';
    }
    right.appendChild(addAttachBtn);

    main.appendChild(left); main.appendChild(right);

    // Bottom actions
    const actions = document.createElement('div'); actions.style.display='flex'; actions.style.justifyContent='flex-end'; actions.style.gap='8px'; actions.style.marginTop='12px';
    const retransferBtn = document.createElement('button'); retransferBtn.className='btn'; retransferBtn.textContent='إعادة تحويل';
    retransferBtn.addEventListener('click', () => {
      const note = prompt('أدخل ملاحظة قبل التحويل (اختياري):');
      if (note === null) return;
      // open transfer modal prefilled
      showTransferModal(payload, cm.sourceEntity, cm.circleName, cm.sourceId);
      if (note) transferNoteEl.value = note;
    });
    const rollbackBtn = document.createElement('button'); rollbackBtn.className='btn'; rollbackBtn.textContent='تراجع عن التحويل';
    rollbackBtn.addEventListener('click', async () => {
      if (!confirm('تأكيد التراجع عن التحويل للسجل؟')) return;
      try { await saveToServer('/api/history/by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, action: 'revert_transfer', actor: getCurrentActor() }); alert('تم تسجيل التراجع'); await loadHistories(); } catch (e) { console.error(e); alert('فشل التراجع'); }
    });
    const timelineBtn = document.createElement('button'); timelineBtn.className='btn'; timelineBtn.textContent='عرض سير المعاملة'; timelineBtn.addEventListener('click', () => showTimelineByKey(cm));
    const canManageCircleMailDetails = canManageSensitiveActions();
    const finishBtn = document.createElement('button'); finishBtn.className='btn secondary'; finishBtn.textContent = cm.status==='finished' ? 'تراجع عن الانتهاء' : 'انهاء المعاملة';
    finishBtn.disabled = !canManageCircleMailDetails;
    finishBtn.title = getSensitiveActionTitle(canManageCircleMailDetails);
    finishBtn.addEventListener('click', async () => {
      if (!canManageCircleMailDetails) return;
      if (!confirm('تأكيد تغيير حالة المعاملة؟')) return;
      try { const newStatus = cm.status==='finished' ? 'open' : 'finished'; await saveToServer('/api/circlemail/update-by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, updates: { status: newStatus } }); await saveToServer('/api/history/by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, action: newStatus==='finished' ? 'finished' : 'reopened', actor: getCurrentActor() }); alert('تم تحديث الحالة'); await loadCircleMails(); } catch (e) { console.error(e); alert('فشل'); }
    });
    // explicit 'تراجع عن الانهاء' button (visible only when status is finished)
    if (cm.status === 'finished') {
      const unfinishBtn = document.createElement('button'); unfinishBtn.className = 'btn'; unfinishBtn.textContent = 'تراجع عن الانهاء';
      unfinishBtn.disabled = !canManageCircleMailDetails;
      unfinishBtn.title = getSensitiveActionTitle(canManageCircleMailDetails);
      unfinishBtn.addEventListener('click', async () => {
        if (!canManageCircleMailDetails) return;
        if (!confirm('تأكيد تراجع عن الإنهاء؟')) return;
        try {
          await saveToServer('/api/circlemail/update-by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, updates: { status: 'open' } });
          await saveToServer('/api/history/by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, action: 'reopened', actor: getCurrentActor() });
          await loadCircleMails();
          alert('تم التراجع عن الإنهاء');
        } catch (e) { console.error(e); alert('فشل التراجع'); }
      });
      actions.appendChild(unfinishBtn);
    }
    actions.appendChild(retransferBtn); actions.appendChild(rollbackBtn); actions.appendChild(timelineBtn); actions.appendChild(finishBtn);

    bodyList.appendChild(topNoteWrap);
    bodyList.appendChild(main);
    bodyList.appendChild(actions);

    // show modal fullscreen
    modal.classList.remove('hidden');
    const win = modal.querySelector('.modal-window');
    if (win) {
      win.classList.add('full-screen');
      win.style.position = 'fixed'; win.style.top='0'; win.style.left='0'; win.style.right='0'; win.style.bottom='0'; win.style.width='100%'; win.style.height='100vh'; win.style.margin='0'; win.style.borderRadius='0'; win.style.maxWidth='100%'; win.style.padding='24px'; win.style.display='flex'; win.style.flexDirection='column';
    }
    modal.classList.add('fullscreen-mode'); modal.style.alignItems='stretch'; modal.style.justifyContent='stretch';
  };

    // Open the outgoing form prefilled for editing a circle mail; show as fullscreen
  const openEditCircleMail = (cm) => {
      // parse payload
      let payload = {};
      try { payload = cm.payload ? (typeof cm.payload === 'string' ? JSON.parse(cm.payload) : cm.payload) : {}; } catch (e) { payload = { raw: cm.payload }; }
      // switch to outgoing tab
      const outgoingTab = Array.from(document.querySelectorAll('.tab')).find(t => t.getAttribute('data-tab') === 'outgoing');
      if (outgoingTab) outgoingTab.click();
      // populate outgoing form with payload fields
      populateForm(payload);
      // mark form as editing circle
      form.dataset.editingCircle = JSON.stringify({ sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName });
      // show fullscreen style on form card
      const formCard = document.querySelector('.outgoing-form-card'); if (formCard) formCard.classList.add('fullscreen');
      // If this circle mail is finished, disable editing controls (view-only)
      try {
        if (cm && cm.status === 'finished') {
          // mark form frozen
          form.dataset.frozen = '1';
          // disable inputs, selects, textareas and attachment controls except cancel/reset
          const allowIds = new Set([ (cancelBtn && cancelBtn.id) || '', (resetBtn && resetBtn.id) || '' ]);
          form.querySelectorAll('input,select,textarea,button').forEach(el => {
            if (el && el.id && allowIds.has(el.id)) return;
            // keep buttons that are type=button and have class 'btn secondary' visible? we'll disable all except allowIds
            el.disabled = true;
          });
          // disable add attachment button if present
          if (outgoingAddAttachmentBtn) outgoingAddAttachmentBtn.disabled = true;
          // show a frozen note
          let note = form.querySelector('.frozen-note');
          if (!note) {
            note = document.createElement('div');
            note.className = 'frozen-note';
            note.style.background = '#fff1f2'; note.style.padding = '8px'; note.style.border = '1px solid #fecaca'; note.style.borderRadius = '6px'; note.style.marginBottom = '10px';
            note.textContent = 'هذه المعاملة مُنهية ولا يمكن تعديلها. لرفع القفل، يجب أن يقوم مشرف بإعادة فتحها.';
            form.parentNode && form.parentNode.insertBefore(note, form);
          }
        } else {
          // ensure form not frozen
          if (form.dataset.frozen) {
            delete form.dataset.frozen;
            form.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = false; });
            if (outgoingAddAttachmentBtn) outgoingAddAttachmentBtn.disabled = false;
            const note = form.querySelector('.frozen-note'); if (note) note.remove();
          }
        }
      } catch (e) { /* ignore */ }
    };

  const showTimelineByKey = async (cm) => {
    try {
      if (!attachmentsModal || !attachmentsModalBody) return;
      
      // Fetch history for the full source path across all departments
      const q = `?sourceEntity=${encodeURIComponent(cm.sourceEntity)}&sourceId=${encodeURIComponent(cm.sourceId)}`;
      const entries = await fetchJson(`/api/history/by-key${q}`);
      
      // Resolve the original source record to find its creation time
      let sourceItem = null;
      if (cm.sourceEntity === 'outgoing') sourceItem = items.find(it => it.id === Number(cm.sourceId));
      else if (cm.sourceEntity === 'incoming') sourceItem = itemsIncoming.find(it => it.id === Number(cm.sourceId));
      else if (cm.sourceEntity === 'reception') sourceItem = itemsReception.find(it => it.id === Number(cm.sourceId));

      attachmentsModalBody.innerHTML = '';
      const heading = document.createElement('div');
      heading.className = 'attachments-modal-title';
      heading.style.fontSize = '22px';
      heading.style.marginBottom = '20px';
      heading.textContent = 'سير المعاملة الزمني';
      attachmentsModalBody.appendChild(heading);

      renderTimeline(attachmentsModalBody, entries || [], sourceItem, cm.sourceEntity);
      attachmentsModal.classList.remove('hidden');
    } catch (err) {
      // Make modal fullscreen on error too
      if (attachmentsModal) {
        attachmentsModal.classList.add('fullscreen-mode');
        const win = attachmentsModal.querySelector('.modal-content');
        if (win) win.classList.add('full-screen');
      }
      console.error('Failed to fetch timeline by key', err);
      alert('تعذر جلب سير المعاملة. تحقق من الاتصال.');
    }
  };

  const renderTimeline = (container, histories, sourceItem, sourceEntity) => {
    const timeline = document.createElement('div');
    timeline.className = 'timeline';

    // 1. Initial Creation Event
    if (sourceItem) {
      const info = getEntityInfo(sourceEntity);
      const item = document.createElement('div');
      item.className = 'timeline-item';
      const timeStr = sourceItem.createdAt ? new Date(sourceItem.createdAt).toLocaleString('ar-SY') : 'تاريخ البدء';
      item.innerHTML = `
        <div class="timeline-dot" style="background:#10b981"></div>
        <div class="timeline-content">
          <div class="timeline-time">${timeStr}</div>
          <div class="timeline-title">تم إنشاء المعاملة في ${info.display}</div>
          <div class="timeline-note">الموضوع: ${sourceItem.subject || '-'}</div>
        </div>`;
      timeline.appendChild(item);
    }

    // 2. Mapping Actions
    const actionLabels = { transferred: 'تحويل خارجي', finished: 'إنهاء المعاملة', reopened: 'إعادة فتح', note: 'إضافة ملاحظة', note_added: 'إضافة ملاحظة', delayed_alert: 'تنبيه تأخير', revert_transfer: 'تراجع عن التحويل' };

    histories.forEach(h => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      const timeStr = new Date(h.createdAt).toLocaleString('ar-SY');
      const actionLabel = actionLabels[h.action] || h.action;
      const sourceInfo = getEntityInfo(h.sourceEntity || '');
      const fromLabel = h.fromCircle || (sourceInfo.display && sourceInfo.display !== '-' ? sourceInfo.display : null) || 'الأرشيف';
      const toLabel = h.circleName || h.toCircle || '-';
      let title = (h.action === 'transferred') 
        ? `تحويل من [${fromLabel}] إلى [${toLabel}]` 
        : `${actionLabel} في ${h.circleName || '-'}`;

      item.innerHTML = `
        <div class="timeline-dot" style="background: ${h.action === 'finished' ? '#059669' : (h.action === 'transferred' ? '#2563eb' : '#f59e0b')}"></div>
        <div class="timeline-content">
          <div class="timeline-time">${timeStr}</div>
          <div class="timeline-title">${title}</div>
          ${h.note ? `<div class="timeline-note">"${h.note}"</div>` : ''}
          <div style="font-size:11px; color:#94a3b8; margin-top:6px">بواسطة: ${h.actor || 'النظام'}</div>
        </div>`;
      timeline.appendChild(item);
    });
    container.appendChild(timeline);
  };

  const openAddNote = (cm) => {
    const note = prompt('أدخل ملاحظة إضافية:');
    if (note === null) return;
    saveToServer('/api/history/by-key', { sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, action: 'note', note, actor: getCurrentActor() })
      .then(() => { loadHistories(); alert('تم إضافة الملاحظة'); })
      .catch(err => { console.error(err); alert('خطأ عند إضافة الملاحظة'); });
  };

  const openAddAttachments = (cm) => {
    // prevent adding attachments to finished circle mails
    if (cm && cm.status === 'finished') {
      return alert('هذه المعاملة مُنهية ولا يمكن إضافة مرفقات.');
    }
    // create a file input dynamically to allow multiple file selection
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = '*/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) { document.body.removeChild(input); return; }
      try {
        // استخدام الدالة الموحدة لرفع المرفقات الجديدة في واجهة الدوائر
        const attachments = await Promise.all(files.map(processAndUploadFile));
        // send to server to append attachments by composite key
        await fetchJson('/api/circlemail/append-attachments-by-key', {
          method: 'POST',
          body: JSON.stringify({ sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName, attachments })
        });
        await logActivity('add_attachment', { note: `إضافة مرفق إلى ${cm.circleName || '-'}`, sourceEntity: cm.sourceEntity, sourceId: cm.sourceId, circleName: cm.circleName });
        await loadCircleMails();
        alert('تم رفع المرفقات بنجاح');
      } catch (err) {
        console.error('Failed to upload attachments', err);
        alert('فشل رفع المرفقات');
      } finally {
        document.body.removeChild(input);
      }
    });
    input.click();
  };

  // Transfer modal logic
  let _transferContext = null; // { payload, sourceEntity, fromCircle, sourceId }
  const showTransferModal = (payload, sourceEntity, fromCircle = null, sourceId = null) => {
    if (!transferModal || !transferListEl) return;
    const finishedStatus = payload && (payload.status === 'finished' || payload.status === 'منتهية');
    if (finishedStatus) {
      alert('لا يمكن التحويل بعد إنهاء المعاملة أو الأضبارة.');
      return;
    }
    _transferContext = { payload, sourceEntity, fromCircle, sourceId };
    transferListEl.innerHTML = '';
    transferListEl.classList.add('transfer-list');
    circles.forEach(name => {
      const item = document.createElement('div'); item.className = 'transfer-item';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.value = name; chk.id = `transfer_${name}`;
      const lbl = document.createElement('label'); lbl.htmlFor = chk.id; lbl.textContent = name;
      item.appendChild(chk);
      item.appendChild(lbl);
      transferListEl.appendChild(item);
    });
  // Make transfer modal fullscreen
  if (transferModal) {
    transferModal.classList.add('fullscreen-mode');
    const win = transferModal.querySelector('.modal-window');
    if (win) win.classList.add('full-screen');
  }
    transferNoteEl.value = '';
    transferModal.classList.remove('hidden');
  };

  const updateSourceTransferState = (sourceEntity, sourceId, circleName, payload = null) => {
    if (!sourceEntity || sourceId === undefined || sourceId === null) return;
    const normalizedEntity = String(sourceEntity || '').toLowerCase();
    const departmentName = String(circleName || '').trim();
    const targetId = String(sourceId);

    let sourceItem = null;
    if (normalizedEntity.includes('archive')) sourceItem = (itemsArchive || []).find(it => String(it.id) === targetId);
    else if (normalizedEntity.includes('outg')) sourceItem = (items || []).find(it => String(it.id) === targetId);
    else if (normalizedEntity.includes('incom')) sourceItem = (itemsIncoming || []).find(it => String(it.id) === targetId);
    else if (normalizedEntity.includes('recept')) sourceItem = (itemsReception || []).find(it => String(it.id) === targetId);

    if (!sourceItem) return;

    const previousDepartment = String(
      (payload && (payload.previousDepartment || payload.previousLocation || payload.lastTransferredFrom || payload.currentDepartment || payload.department || payload.currentDepartmentName || sourceItem.previousDepartment || sourceItem.previousLocation || sourceItem.lastTransferredFrom))
      || (sourceItem && (sourceItem.currentDepartment || sourceItem.department || sourceItem.currentDepartmentName || sourceItem.lastTransferredTo || sourceItem.lastTransferredFrom || ''))
      || ''
    ).trim();

    if (departmentName) {
      if (previousDepartment && previousDepartment !== departmentName) {
        sourceItem.previousDepartment = previousDepartment;
        sourceItem.previousLocation = previousDepartment;
        sourceItem.lastTransferredFrom = previousDepartment;
      }
      sourceItem.currentDepartment = departmentName;
      sourceItem.department = departmentName;
      sourceItem.currentDepartmentName = departmentName;
      sourceItem.lastTransferredTo = departmentName;
      sourceItem.lastTransferAt = new Date().toISOString();
    }

    if (normalizedEntity.includes('archive')) {
      if (window.ArchiveTransferState && typeof window.ArchiveTransferState.resetArchiveTransferState === 'function') {
        window.ArchiveTransferState.resetArchiveTransferState(sourceItem);
      } else {
        ['studies','tech','gov','legal','gov2'].forEach(sectionKey => {
          const sectionData = sourceItem[sectionKey];
          if (!sectionData || typeof sectionData !== 'object') return;
          delete sectionData.savedAt;
          delete sectionData.deadlineAt;
          delete sectionData.durationStartedAt;
          delete sectionData.expectedMinutes;
          delete sectionData.startedAt;
        });
        if (sourceItem.status && String(sourceItem.status).includes('متأخرة')) {
          sourceItem.status = 'قيد العمل';
        }
      }
      sourceItem.status = buildArchiveStatusValue('تم الاستلام', departmentName || previousDepartment || sourceItem.currentDepartment || '');
    } else if (sourceItem.status !== 'finished' && sourceItem.status !== 'منتهية') {
      sourceItem.status = 'قيد العمل';
    }

    if (normalizedEntity.includes('archive')) saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
    else if (normalizedEntity.includes('outg')) saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
    else if (normalizedEntity.includes('incom')) saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
    else if (normalizedEntity.includes('recept')) saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
  };

  const performTransfer = async () => {
    if (!_transferContext) return;
    const selected = Array.from(transferListEl.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
    if (!selected.length) return alert('اختر دائرة واحدة على الأقل للتحويل');
    const note = transferNoteEl.value || '';
    try {
      if (confirmTransferBtn) confirmTransferBtn.disabled = true;
      console.debug('تم اختيار الدوائر:', selected);
      for (const circleName of selected) {
        // prefer attachments stored at the CircleMail top-level (added while in a circle)
        let attachmentsToSend = [];
        try {
          const existing = itemsCircleMail.find(x => String(x.sourceEntity) === String(_transferContext.sourceEntity) && String(x.sourceId) === String(_transferContext.payload.id) && x.circleName === _transferContext.fromCircle);
          if (existing) {
            attachmentsToSend = Array.isArray(existing.attachments) ? existing.attachments : (existing.attachments ? JSON.parse(existing.attachments) : []);
          }
        } catch (e) { attachmentsToSend = []; }
        if (!attachmentsToSend || !attachmentsToSend.length) {
          attachmentsToSend = _transferContext.payload.attachments || [];
        }

        // normalize sourceEntity so archive transfers are consistently labeled
        let normalizedSourceEntity = String(_transferContext.sourceEntity || '').toLowerCase();
        if (normalizedSourceEntity.includes('archive')) normalizedSourceEntity = 'archive';
        else if (normalizedSourceEntity.includes('outg')) normalizedSourceEntity = 'outgoing';
        else if (normalizedSourceEntity.includes('incom')) normalizedSourceEntity = 'incoming';
        else if (normalizedSourceEntity.includes('recept')) normalizedSourceEntity = 'reception';

        const inferredSourceId = _transferContext.sourceId !== undefined && _transferContext.sourceId !== null
          ? _transferContext.sourceId
          : ((_transferContext.payload && (_transferContext.payload.id || _transferContext.payload.sourceId || _transferContext.payload.archiveId || _transferContext.payload._id))
            ? (_transferContext.payload.id || _transferContext.payload.sourceId || _transferContext.payload.archiveId || _transferContext.payload._id)
            : null);

        const transferDepartment = String(circleName || '').trim();
        if (_transferContext.payload) {
          const previousTransferDepartment = String(
            (_transferContext.payload.previousDepartment || _transferContext.payload.previousLocation || _transferContext.payload.lastTransferredFrom || _transferContext.payload.currentDepartment || _transferContext.payload.department || _transferContext.payload.currentDepartmentName || '')
            || ''
          ).trim();
          if (previousTransferDepartment && previousTransferDepartment !== transferDepartment) {
            _transferContext.payload.previousDepartment = previousTransferDepartment;
            _transferContext.payload.previousLocation = previousTransferDepartment;
            _transferContext.payload.lastTransferredFrom = previousTransferDepartment;
          }
          _transferContext.payload.currentDepartment = transferDepartment;
          _transferContext.payload.department = transferDepartment;
          _transferContext.payload.currentDepartmentName = transferDepartment;
          _transferContext.payload.lastTransferredTo = transferDepartment;
          _transferContext.payload.lastTransferAt = new Date().toISOString();
          if (normalizedSourceEntity === 'archive') {
            if (window.ArchiveTransferState && typeof window.ArchiveTransferState.resetArchiveTransferState === 'function') {
              window.ArchiveTransferState.resetArchiveTransferState(_transferContext.payload);
            } else {
              ['studies','tech','gov','legal','gov2'].forEach(sectionKey => {
                const sectionData = _transferContext.payload[sectionKey];
                if (!sectionData || typeof sectionData !== 'object') return;
                delete sectionData.savedAt;
                delete sectionData.deadlineAt;
                delete sectionData.durationStartedAt;
                delete sectionData.expectedMinutes;
                delete sectionData.startedAt;
              });
              if (_transferContext.payload.status && String(_transferContext.payload.status).includes('متأخرة')) {
                _transferContext.payload.status = 'قيد العمل';
              }
            }
            _transferContext.payload.status = buildArchiveStatusValue('تم الاستلام', transferDepartment);
          } else if (_transferContext.payload.status !== 'finished' && _transferContext.payload.status !== 'منتهية') {
            _transferContext.payload.status = 'قيد العمل';
          }
        }

        const payload = {
          sourceEntity: normalizedSourceEntity,
          sourceId: inferredSourceId || null,
          circleName,
          // tell server which circle we are transferring from so it can prefer that circle's attachments
          fromCircle: _transferContext.fromCircle || null,
          payload: JSON.stringify(_transferContext.payload),
          attachments: JSON.stringify(attachmentsToSend || []),
          status: 'قيد العمل'
        };

        updateSourceTransferState(normalizedSourceEntity, inferredSourceId, circleName, _transferContext.payload);
        // Infer business-category: prefer explicit `recordCategory` or `record_type` on the payload,
        // but always treat archive source transfers as DOSSIER.
        let inferredCategory = 'MAIL';
        try {
          const srcPayload = _transferContext.payload || {};
          const payloadCategory = srcPayload.recordCategory || srcPayload.recordType || srcPayload.record_type || '';
          const categoryNorm = String(payloadCategory || '').trim().toLowerCase();
          const looksLikeDossier = categoryNorm.includes('اضاب') || categoryNorm === 'dossier' || categoryNorm === 'dosier';
          if (normalizedSourceEntity === 'archive' || looksLikeDossier) {
            inferredCategory = 'DOSSIER';
          } else if (categoryNorm) {
            inferredCategory = 'MAIL';
          } else if (normalizedSourceEntity === 'archive') {
            inferredCategory = 'DOSSIER';
          }
        } catch (e) { inferredCategory = (normalizedSourceEntity === 'archive') ? 'DOSSIER' : 'MAIL'; }
        payload.recordCategory = inferredCategory; // MAIL | DOSSIER
        // keep legacy Arabic marker for compatibility
        payload.record_type = (inferredCategory === 'DOSSIER') ? 'اضابير' : 'بريد عادي';

        // If the transfer represents a DOSSIER and destination is a special circle,
        // create a history entry using sourceEntity='archive' so existing archive-list
        // logic (which looks for archive transfers) will pick it up.
        const archiveSpecial = (inferredCategory === 'DOSSIER' && specialCircles.has(circleName));
        if (archiveSpecial) {
          try {
            await saveToServer('/api/history/by-key', { sourceEntity: 'archive', sourceId: payload.sourceId, circleName, action: 'transferred', note, actor: getCurrentActor() });
            console.debug('Saved DOSSIER transfer history for', payload.sourceId, '->', circleName);
          } catch (e) {
            console.warn('DOSSIER history fallback failed, storing locally', e);
            try {
              histories = histories || [];
              histories.push({ id: Date.now(), sourceEntity: 'archive', sourceId: payload.sourceId, circleName, action: 'transferred', note, actor: getCurrentActor(), createdAt: new Date().toISOString(), local: true });
            } catch (er) { console.warn('Failed to store local history fallback', er); }
          }
        }
        console.debug('إرسال /api/circlemail، الحمولة:', payload);
          // try with a couple retries on network failure
          let created = null;
          let attempts = 0;
          while (attempts < 3) {
            attempts += 1;
            try {
              created = await saveToServer('/api/circlemail', payload);
              break;
            } catch (err) {
              console.warn('Attempt', attempts, 'to create circlemail failed', err);
              if (attempts >= 3) { console.warn('Max attempts reached, will fallback to local copy'); break; }
              await new Promise(r => setTimeout(r, 500));
            }
          }
          // If server creation failed (no created), fall back to local copy so the archive exists in the target circle
          if (!created) {
            try {
              const localId = Date.now() + Math.floor(Math.random() * 999);
              const localCm = {
                id: localId,
                sourceEntity: normalizedSourceEntity,
                sourceId: payload.sourceId,
                circleName: circleName,
                fromCircle: payload.fromCircle || null,
                payload: payload.payload || JSON.stringify(_transferContext.payload),
                // keep the category on local fallback records too
                recordCategory: payload.recordCategory || payload.record_category || null,
                recordType: payload.record_type || payload.recordType || null,
                attachments: Array.isArray(attachmentsToSend) ? attachmentsToSend : (attachmentsToSend ? JSON.parse(attachmentsToSend) : []),
                status: payload.status || 'open',
                createdAt: new Date().toISOString(),
                local: true
              };
              itemsCircleMail.unshift(localCm);
              try { saveLocalBackup(LOCAL_STORAGE_KEYS.circlemail, itemsCircleMail); } catch (e) { console.warn('Failed to save local circlemail backup', e); }
              created = localCm;
              console.debug('Created local circleMail fallback for', circleName, localCm.id);
            } catch (e) {
              console.warn('Local fallback create failed', e);
            }
          }
          // record history — prefer attaching directly to created circleMailId so note is never lost
          // include source identifying keys so history/by-key can resolve when needed
          const historyPayload = { action: 'transferred', fromCircle: _transferContext.fromCircle || null, toCircle: circleName, note, actor: getCurrentActor() };
          if (created && created.id) {
            historyPayload.circleMailId = created.id;
            // also attach source info for consistency
            historyPayload.sourceEntity = payload.sourceEntity;
            historyPayload.sourceId = payload.sourceId;
            historyPayload.circleName = circleName;
          } else {
            historyPayload.sourceEntity = payload.sourceEntity; historyPayload.sourceId = payload.sourceId; historyPayload.circleName = circleName;
          }
          const createdHistory = await saveToServer('/api/history/by-key', historyPayload);
          // transfer note is included with the transfer history entry itself, do not create a separate note item
      }
      await loadCircleMails();
      await loadHistories();
      transferModal.classList.add('hidden');
      alert('تم التحويل إلى الدوائر المحددة.');
    } catch (err) {
      console.error('Transfer failed', err);
      const msg = (err && err.message) ? err.message : String(err);
      alert('حدث خطأ أثناء التحويل: ' + msg);
    }
    finally {
      if (confirmTransferBtn) confirmTransferBtn.disabled = false;
    }
  };

  if (closeTransferModal) closeTransferModal.addEventListener('click', () => { if (transferModal) transferModal.classList.add('hidden'); });
  if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', () => { if (transferModal) transferModal.classList.add('hidden'); });
  // Also remove fullscreen classes when closing transfer modal
  [closeTransferModal, cancelTransferBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      if (transferModal) transferModal.classList.remove('fullscreen-mode');
    });
  });
  if (confirmTransferBtn) confirmTransferBtn.addEventListener('click', () => performTransfer());

  const closeCircleModalBtn = document.getElementById('closeCircleModal');
  if (closeCircleModalBtn) closeCircleModalBtn.addEventListener('click', () => {
    const modal = document.getElementById('circleModal'); if (modal) {
      const win = modal.querySelector('.modal-window'); if (win) win.classList.remove('full-screen');
      // clear inline fullscreen styles when closing
      if (win) {
        win.style.position = '';
        win.style.top = '';
        win.style.left = '';
        win.style.right = '';
        win.style.bottom = '';
        win.style.width = '';
        win.style.height = '';
        win.style.margin = '';
        win.style.borderRadius = '';
        win.style.maxWidth = '';
        win.style.padding = '';
        win.style.display = '';
        win.style.flexDirection = '';
      }
      modal.classList.add('hidden');
      modal.classList.remove('fullscreen-mode');
      modal.style.alignItems = '';
      modal.style.justifyContent = '';
    }
  });


  const outgoingHeaderMap = buildHeaderKeyMap(outgoingHeaders);
  const incomingHeaderMap = buildHeaderKeyMap(incomingHeaders);
  const receptionHeaderMap = buildHeaderKeyMap(receptionHeaders);

  // Sorting flags for "عرض حسب الأحدث"
  let sortOutgoingLatest = true;
  let sortIncomingLatest = true;
  let sortReceptionLatest = true;

  const parseDateString = window.parseDateString || ((s) => {
    if (!s) return null;
    if (s instanceof Date) return s;
    const str = String(s).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const m = str.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})$/);
    if (m) {
      let p1 = parseInt(m[1], 10), p2 = parseInt(m[2], 10), p3 = parseInt(m[3], 10);
      if (p1 > 1000) return new Date(p1, p2 - 1, p3);
      if (p3 > 1000) return new Date(p3, p2 - 1, p1);
      const year = p3 < 100 ? 2000 + p3 : p3;
      return new Date(year, p2 - 1, p1);
    }
    const d1 = Date.parse(str);
    if (!Number.isNaN(d1)) return new Date(d1);
    return null;
  });

  const getItemMainDate = (item) => {
    if (!item) return null;
    const candidates = ['date','inDate','arriveDate','newDate','oldDate','submissionDate'];
    for (const k of candidates) {
      if (item[k]) {
        const d = parseDateString(item[k]);
        if (d) return d;
      }
    }
    return null;
  };

  // helper: map entity technical name to display name and headers
  const getEntityInfo = (entityName) => {
    if (!entityName) return { key: null, display: '-', headers: {} };
    const key = String(entityName).toLowerCase();
    if (key.includes('outg') || key === 'outgoing') return { key: 'outgoing', display: 'البريد الصادر', headers: outgoingHeaders };
    if (key.includes('incom') || key === 'incoming') return { key: 'incoming', display: 'البريد الوارد', headers: incomingHeaders };
    if (key.includes('recept') || key === 'reception') return { key: 'reception', display: 'الاستقبال والشكاوى', headers: receptionHeaders };
    if (key.includes('archive') || key === 'archive') return { key: 'archive', display: 'الأرشيف', headers: {} };
    return { key, display: entityName, headers: {} };
  };

  // --- Global search UI wiring ---
  const globalSearchQueryEl = document.getElementById('globalSearchQuery');
  const globalSearchFieldEl = document.getElementById('globalSearchField');
  const globalSearchResultsEl = document.getElementById('globalSearchResults');
  const globalSearchClearEl = document.getElementById('globalSearchClear');

  const buildSearchFieldOptions = () => {
    const opts = [{ value: 'all', text: 'كل الحقول' }];
    Object.entries(outgoingHeaders).forEach(([key, label]) => opts.push({ value: `outgoing:${key}`, text: `الكتب الصادرة — ${label}` }));
    Object.entries(incomingHeaders).forEach(([key, label]) => opts.push({ value: `incoming:${key}`, text: `الكتب الواردة — ${label}` }));
    Object.entries(receptionHeaders).forEach(([key, label]) => opts.push({ value: `reception:${key}`, text: `الاستقبال — ${label}` }));
    // remove duplicates by value
    const seen = new Set();
    return opts.filter(o => {
      if (seen.has(o.value)) return false; seen.add(o.value); return true;
    });
  };

  const populateSearchFieldSelect = () => {
    if (!globalSearchFieldEl) return;
    const opts = buildSearchFieldOptions();
    globalSearchFieldEl.innerHTML = '';
    opts.forEach(o => {
      const el = document.createElement('option'); el.value = o.value; el.textContent = o.text; globalSearchFieldEl.appendChild(el);
    });
  };

  const normalizeForSearch = (v) => (v === undefined || v === null) ? '' : String(v).toLowerCase();

  const itemMatchesQuery = (item, query, fieldKey) => {
    const q = normalizeForSearch(query);
    if (!q) return false;
    if (fieldKey) {
      const val = normalizeForSearch(item[fieldKey]);
      if (val.includes(q)) return true;
      // attachments field
      if (fieldKey === 'attachments' && Array.isArray(item.attachments)) {
        return item.attachments.some(a => normalizeForSearch(a.name).includes(q) || normalizeForSearch(a.data).includes(q));
      }
      return false;
    }
    // search across all fields and attachments
    for (const k of Object.keys(item)) {
      const val = item[k];
      if (Array.isArray(val)) {
        if (val.some(v => normalizeForSearch(v.name).includes(q) || normalizeForSearch(v.data).includes(q))) return true;
      } else if (normalizeForSearch(val).includes(q)) return true;
    }
    // attachments property fallback
    if (Array.isArray(item.attachments)) {
      if (item.attachments.some(a => normalizeForSearch(a.name).includes(q) || normalizeForSearch(a.data).includes(q))) return true;
    }
    return false;
  };

  const performGlobalSearch = (query, fieldValue) => {
    const results = [];
    const q = query ? String(query).trim() : '';
    if (!q) {
      globalSearchResultsEl.innerHTML = '<div class="search-no-results">اكتب كلمة للبحث لبدء العرض.</div>';
      return;
    }
    const [selEntity, selKey] = (fieldValue || 'all').split(':');

    const pushMatches = (arr, entityName) => {
      arr.forEach(it => {
        let matches = false;
        if (fieldValue === 'all') {
          matches = itemMatchesQuery(it, q, null);
        } else if (selEntity === entityName && selKey) {
          matches = itemMatchesQuery(it, q, selKey);
        }
        if (matches) results.push({ entity: entityName, item: it });
      });
    };

    pushMatches(items, 'outgoing');
    pushMatches(itemsIncoming, 'incoming');
    pushMatches(itemsReception, 'reception');

    renderGlobalSearchResults(results);
  };

  const renderGlobalSearchResults = (results) => {
    if (!globalSearchResultsEl) return;
    globalSearchResultsEl.innerHTML = '';
    if (!results || !results.length) {
      globalSearchResultsEl.innerHTML = '<div class="search-no-results">لم يتم العثور على سجلات مطابقة.</div>';
      return;
    }
    results.forEach(res => {
      const el = document.createElement('div'); el.className = 'search-result-card';
      const title = document.createElement('div'); title.className = 'result-header';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${res.entity === 'outgoing' ? 'البريد الصادر' : res.entity === 'incoming' ? 'البريد الوارد' : 'الاستقبال'}</strong>`;
      const right = document.createElement('div');
      right.innerHTML = res.item.serial ? `#${res.item.serial}` : (res.item.inNo || res.item.requestNo || (res.item.id ? `معرّف:${res.item.id}` : ''));
      title.appendChild(left); title.appendChild(right);
      el.appendChild(title);

      const fieldsWrap = document.createElement('div'); fieldsWrap.className = 'search-result-fields';
      const headersMap = res.entity === 'outgoing' ? outgoingHeaders : res.entity === 'incoming' ? incomingHeaders : receptionHeaders;
      Object.entries(headersMap).forEach(([key, label]) => {
        const fd = document.createElement('div'); fd.className = 'field';
        const val = res.item[key];
        fd.innerHTML = `<div style="font-weight:700">${label}</div><div>${(Array.isArray(val) ? val.length : (val || '-'))}</div>`;
        fieldsWrap.appendChild(fd);
      });
      // attachments preview small
      const attachDiv = document.createElement('div'); attachDiv.className = 'field';
      const atts = Array.isArray(res.item.attachments) ? res.item.attachments : [];
      attachDiv.innerHTML = `<div style="font-weight:700">المرفقات</div><div>${atts.length} ملف</div>`;
      if (atts.length) {
        const btn = document.createElement('button'); btn.className = 'btn secondary'; btn.textContent = 'عرض المرفقات';
        btn.addEventListener('click', () => showAttachmentsModal(atts, 'المرفقات'));
        attachDiv.appendChild(btn);
      }
      fieldsWrap.appendChild(attachDiv);

      el.appendChild(fieldsWrap);
      globalSearchResultsEl.appendChild(el);
    });
  };

  // wire search inputs
  populateSearchFieldSelect();
  if (globalSearchQueryEl) globalSearchQueryEl.addEventListener('input', (e) => performGlobalSearch(e.target.value, globalSearchFieldEl ? globalSearchFieldEl.value : 'all'));
  if (globalSearchFieldEl) globalSearchFieldEl.addEventListener('change', () => performGlobalSearch(globalSearchQueryEl ? globalSearchQueryEl.value : '', globalSearchFieldEl.value));
  if (globalSearchClearEl) globalSearchClearEl.addEventListener('click', () => { if (globalSearchQueryEl) globalSearchQueryEl.value = ''; performGlobalSearch('', 'all'); });


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

  const deleteSelectedItems = async (itemsArray, endpointBase, entityLabel) => {
    const selected = itemsArray.filter(it => it._selected);
    const selectedCount = selected.length;
    if (!selectedCount) {
      alert('لم يتم اختيار أي سجل للحذف.');
      return itemsArray;
    }
    if (!confirm(`هل تريد حذف ${selectedCount} سجل${selectedCount > 1 ? 'اً' : ''} محدد؟`)) {
      return itemsArray;
    }

    const failed = [];
    for (const item of selected) {
      if (item && item.id) {
        try {
          await deleteFromServer(`/api/${endpointBase}/${item.id}`);
        } catch (error) {
          console.error(`Bulk delete failed for ${entityLabel}`, error);
          failed.push(item);
        }
      }
    }

    const remaining = itemsArray.filter(it => !it._selected);
    if (failed.length) {
      alert(`تم حذف ${remaining.length} سجل${remaining.length !== 1 ? 'اً' : ''} محلياً، وقد فشل حذف ${failed.length} سجل${failed.length !== 1 ? 'اً' : ''} من الخادم.`);
    }
    return remaining;
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

  // Helper function for consistent error reporting during import
  const reportImportError = (message, errorDetails = null) => {
    console.error('Import Error:', message, errorDetails);
    let fullMessage = 'حدث خطأ عند معالجة الملف. تأكد من أن الملف بصيغة Excel أو CSV صالحة.';
    if (errorDetails && errorDetails.message) {
      fullMessage += `\nالتفاصيل: ${errorDetails.message}`;
    } else if (typeof errorDetails === 'string') {
      fullMessage += `\nالتفاصيل: ${errorDetails}`;
    }
    alert(fullMessage);
  };

  const importExcelFile = (file, headerKeyMap, callback) => {
    const isXlsxAvailable = !!window.XLSX;
    const fileExt = (file && file.name && file.name.split('.') && file.name.split('.').pop()) ? String(file.name.split('.').pop()).toLowerCase() : '';
    const isExcelExt = /^(xls|xlsx|xlsm|xlsb)$/i.test(fileExt);
    const reader = new FileReader();
    reader.onerror = (event) => {
      reportImportError('خطأ في قراءة الملف بواسطة FileReader.', event.target.error);
      console.log('Import flow: FileReader onerror triggered.');
      return; // Stop further processing
    };
    reader.onload = (event) => {
      const processWorkbook = (workbookOrAOA) => {
        let rows;
        if (Array.isArray(workbookOrAOA)) {
          rows = workbookOrAOA;
        } else {
          console.log('Import flow: Processing as Excel workbook.');
          if (!isXlsxAvailable) {
            reportImportError('التعامل مع ملف Excel يتطلب مكتبة XLSX. تأكد من اتصال الإنترنت أو إضافة المكتبة.');
            return;
          }
          const sheet = workbookOrAOA.Sheets[workbookOrAOA.SheetNames[0]];
          console.log('Import flow: First sheet name:', workbookOrAOA.SheetNames[0]);
          if (!sheet) {
            alert('تعذر قراءة الورقة الأولى من ملف الإكسل.');
            return;
          }
          // Log raw headers for debugging
          const detectedHeaders = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: true })[0];
          console.log('Detected raw headers from Excel:', detectedHeaders);

          // Build rows preserving displayed text (cell.w) to avoid Excel date auto-conversion
          try {
            const ref = sheet['!ref'] || 'A1:A1';
            const range = XLSX.utils.decode_range(ref);
            rows = [];
            for (let r = range.s.r; r <= range.e.r; ++r) {
              const row = [];
              for (let c = range.s.c; c <= range.e.c; ++c) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[addr];
                if (!cell) { row.push(''); continue; }

                let val = '';
                if (cell.t === 'd' && cell.v instanceof Date) {
                  // Use local date to prevent timezone/UTC shift (e.g. June becoming May)
                  const d = cell.v;
                  const dd = String(d.getDate()).padStart(2, '0');
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const yyyy = d.getFullYear();
                  val = `${yyyy}-${mm}-${dd}`;
                } else {
                  // Prioritize formatted text (.w) to keep language and formatting exact
                  val = (cell.w !== undefined) ? cell.w : (cell.v !== undefined ? cell.v : '');
                }
                row.push(String(val).trim());
              }
              rows.push(row);
            }
          } catch (e) {
            console.warn('Fallback to sheet_to_json due to error building rows', e);
            rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          }
        }
        if (rows.length < 2) {
          console.warn('Import flow: Workbook has less than 2 rows.');
          alert('ملف الإكسل لا يحتوي على بيانات للاستيراد.');
          return;
        }

        const headerSearchRows = rows.slice(0, 5);
        let headerRowIndex = 0;
        // Initialize bestMatch with a default that indicates no match yet
        // Includes headerLabels for property consistency
        let bestMatch = { index: 0, matched: 0, keyMap: [], headerLabels: [] };

        headerSearchRows.forEach((row, index) => {
          // handle case where the header row is a single cell containing all headers separated by '/'
          let headerLabels = row.map(cell => normalizeHeader(cell));
          if (headerLabels.length === 1 && headerLabels[0] && headerLabels[0].includes('/')) {
            headerLabels = headerLabels[0].split('/').map(h => normalizeHeader(h));
          }
          const keyMap = headerLabels.map(label => findHeaderKey(label, headerKeyMap));
          const matched = keyMap.filter(k => typeof k === 'string').length;
          if (matched > bestMatch.matched) {
            bestMatch = { index, matched, keyMap, headerLabels };
          }
          // This log was already there, keeping it.
          console.log(`Row ${index} headers:`, headerLabels, 'Key map:', keyMap, 'Matched:', matched);
        });

        // Try combining the first two header rows to handle multi-line or merged headers
        if (!bestMatch.matched) {
          try {
            const first = headerSearchRows[0] || [];
            const second = headerSearchRows[1] || [];
            if (Array.isArray(first) && Array.isArray(second)) {
              const maxLen = Math.max(first.length, second.length);
              const combined = Array.from({ length: maxLen }, (_, i) => {
                const a = normalizeHeader(first[i] || '');
                const b = normalizeHeader(second[i] || '');
                return `${a} ${b}`.trim();
              });
              console.log('Combined headers (row 0+1):', combined);
              const keyMap = combined.map(label => findHeaderKey(label, headerKeyMap));
              const matched = keyMap.filter(k => typeof k === 'string').length;
              if (matched > bestMatch.matched) {
                bestMatch = { index: 0, matched, keyMap, headerLabels: combined };
              }
            }
          } catch (e) { /* ignore */ }
        }

        // Fallback: if we couldn't match known headers, still attempt to use the first non-empty row
        // as header row and create permissive keys so rows can be imported (better than failing silently).
        if (!bestMatch.matched) {
          console.warn('importExcelFile: no confident header match found; using permissive fallback.');
          // pick first non-empty row as header
          const firstNonEmpty = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c).trim() !== ''));
          headerRowIndex = firstNonEmpty >= 0 ? firstNonEmpty : 0;
          const headerLabels = rows[headerRowIndex] ? rows[headerRowIndex].map(cell => normalizeHeader(cell)) : [];
          const keyMap = headerLabels.map((label, idx) => {
            const k = findHeaderKey(label, headerKeyMap);
            if (k) return k;
            // fall back to a sanitized label or generic column name
            if (label && label.length) return label.replace(/[^\w\u0600-\u06FF]+/g, '_') || `col${idx+1}`;
            return `col${idx+1}`;
          });
          console.warn('Permissive header key map generated:', keyMap);
          // continue with permissive keyMap
          // assign back to bestMatch.keyMap for consistency below
          bestMatch.keyMap = keyMap;
        }
        // Log final best match for debugging
        console.log('Final best header match:', bestMatch);

        headerRowIndex = bestMatch.index || headerRowIndex;
        const keyMap = bestMatch.keyMap || (rows[headerRowIndex] ? rows[headerRowIndex].map(() => null) : []);
        const importedItems = [];

        rows.slice(headerRowIndex + 1).forEach(row => {
          if (!Array.isArray(row) || row.every(cell => String(cell).trim() === '')) return;
          const item = {};
          row.forEach((cell, index) => {
            const key = keyMap[index];
            if (!key) return;

            if (cell === null || cell === undefined || String(cell).trim() === '') {
              item[key] = '';
            } else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('submission')) {
              const normalizedDate = window.normalizeImportedDateValue ? window.normalizeImportedDateValue(cell) : null;
              item[key] = normalizedDate || '';
            } else {
              item[key] = String(cell).trim();
            }
          });
          item.attachments = [];
          importedItems.push(item);
        });
        callback(importedItems);
      };

      const arrayBuffer = event.target.result;
      // If file extension is Excel and XLSX is available, try reading via XLSX
      if (isExcelExt && !isXlsxAvailable) {
        console.log('Import flow: Excel file detected, but XLSX library not available.');
        alert('لا يمكن استيراد ملفات Excel هنا لأن مكتبة XLSX غير محمّلة. افتح اتصال إنترنت أو احفظ الملف كـ CSV ثم حاول الاستيراد.');
        return;
      }
      if (isExcelExt && isXlsxAvailable) {
        try {
          let workbook;
          try {
            console.log('Import flow: Attempting XLSX.read with cellDates: true');
            workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
          } catch (firstError) {
            console.warn('XLSX read array failed, trying binary fallback', firstError);
            const data = new Uint8Array(arrayBuffer);
            // try converting to binary string
            let binary = '';
            try {
              console.log('Import flow: Attempting XLSX.read with type: "binary" (from array buffer conversion).');
              binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
              workbook = XLSX.read(binary, { type: 'binary', cellDates: true });
            } catch (convErr) {
              // As a last resort for old .xls, try reading file again as binary string
              if (typeof FileReader !== 'undefined' && typeof FileReader.prototype.readAsBinaryString === 'function') {
                const br = new FileReader();
                br.onload = (be) => {
                  try { const bin = be.target.result; workbook = XLSX.read(bin, { type: 'binary', cellDates: true }); processWorkbook(workbook); } catch (e) { reportImportError('تعذر قراءة ملف Excel القديم (.xls). جرب حفظه كـ .xlsx أو كـ CSV.', e); }
                };
                br.readAsBinaryString(file);
                return;
              }
              throw convErr;
            }
          }
          processWorkbook(workbook);
          return;
        } catch (excelProcessingError) {
          console.error('XLSX processing error caught:', excelProcessingError);
          reportImportError('خطأ أثناء معالجة ملف Excel (XLSX).', excelProcessingError);
          return; // Prevent CSV fallback if it was explicitly an Excel file and XLSX processing failed
        }
      } else {
        console.log('Import flow: Not an Excel file or XLSX library not available, attempting CSV/text fallback.');
      }

      // Fallback: try parse as CSV / TSV text
      try {
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(arrayBuffer);
        // handle common separators: comma, semicolon, tab
        console.log('Import flow: CSV/text fallback - detected separator:', text.includes('\t') ? 'tab' : (text.includes(';') ? 'semicolon' : 'comma'));
        const sep = text.includes('\t') ? '\t' : (text.includes(';') ? ';' : ',');
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (!lines.length) {
          alert('ملف CSV/النص فارغ أو غير مقروء. تأكد من تنسيقه ثم حاول مجدداً.');
          return;
        }
        const rows = lines.map(line => line.split(sep).map(cell => cell.trim()));

        // create a minimal sheet object consumed by sheet_to_json via utils. We'll set SheetNames and Sheets
        // If XLSX is available we can create a sheet and re-use processWorkbook; otherwise pass AOA directly
        if (isXlsxAvailable && window.XLSX && XLSX.utils && XLSX.utils.aoa_to_sheet) {
          console.log('Import flow: CSV/text fallback - using XLSX.utils.aoa_to_sheet to create pseudo workbook.');
          const pseudoWorkbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: XLSX.utils.aoa_to_sheet(rows) } };
          processWorkbook(pseudoWorkbook);
        } else if (!isXlsxAvailable && isExcelExt) { // If it was an Excel file but XLSX library is missing, don't try CSV
          reportImportError('لا يمكن استيراد ملفات Excel هنا لأن مكتبة XLSX غير محمّلة. افتح اتصال إنترنت أو احفظ الملف كـ CSV ثم حاول الاستيراد.');
          return;
        } else {
          processWorkbook(rows); // Pass the array of arrays directly
        }
        return;
      } catch (csvErr) {
        reportImportError('خطأ أثناء معالجة ملف CSV/النص.', csvErr);
      }
      return; // Added return here to prevent further execution if CSV processing fails
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
    let filtered = items.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    if (sortOutgoingLatest) {
      filtered = filtered.slice().sort((a,b) => {
        const da = getItemMainDate(a); const db = getItemMainDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPageOutgoing > totalPages) currentPageOutgoing = Math.max(1, totalPages);
    const rows = filtered.slice((currentPageOutgoing - 1) * PAGE_SIZE, currentPageOutgoing * PAGE_SIZE);

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
            <button class="btn" data-action="transfer">تحويل</button>
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
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      const canManageOutgoing = canManageSensitiveActions();
      if (deleteBtn) {
        deleteBtn.disabled = !canManageOutgoing;
        deleteBtn.title = getSensitiveActionTitle(canManageOutgoing);
        deleteBtn.addEventListener('click', async () => {
          if (!canManageOutgoing) return;
          if (!confirm('هل تريد حذف هذا السجل؟')) return;
          try {
            if (it.id) await deleteFromServer(`/api/outgoing/${it.id}`);
          } catch (error) {
            console.error('Delete outgoing failed', error);
            alert('تعذر حذف السجل من الخادم.');
            return;
          }
          registerDeletedRecordInTrash('outgoing', it);
          items = items.filter(x => x !== it);
          saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
          render(searchInput.value);
          renderTrash();
        });
      }
      tr.querySelector('[data-action="transfer"]').addEventListener('click', () => showTransferModal(it, 'outgoing', 'البريد الصادر', it.id));
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للكتاب الصادر');
      });
      annotateTooltipCells(tr);
      tableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllOutgoingCheckbox, filtered);
    updateDashboardStats();

    const pag = renderPagination('outgoingPagination', 'outgoing', filtered.length, currentPageOutgoing);
    const wrapper = document.querySelector('#outgoingTable').parentElement;
    if (!document.getElementById('outgoingPagination')) wrapper.appendChild(pag);
  };

  const renderIncoming = (filter='') => {
    incomingTableBody.innerHTML = '';
    let filtered = itemsIncoming.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    if (sortIncomingLatest) {
      filtered = filtered.slice().sort((a,b) => {
        const da = getItemMainDate(a); const db = getItemMainDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPageIncoming > totalPages) currentPageIncoming = Math.max(1, totalPages);
    const rows = filtered.slice((currentPageIncoming - 1) * PAGE_SIZE, currentPageIncoming * PAGE_SIZE);

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
            <button class="btn" data-action="transfer">تحويل</button>
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
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      const canManageIncoming = canManageSensitiveActions();
      if (deleteBtn) {
        deleteBtn.disabled = !canManageIncoming;
        deleteBtn.title = getSensitiveActionTitle(canManageIncoming);
        deleteBtn.addEventListener('click', async () => {
          if (!canManageIncoming) return;
          if (!confirm('هل تريد حذف هذا السجل؟')) return;
          try {
            if (it.id) await deleteFromServer(`/api/incoming/${it.id}`);
          } catch (error) {
            console.error('Delete incoming failed', error);
            alert('تعذر حذف السجل من الخادم.');
            return;
          }
          registerDeletedRecordInTrash('incoming', it);
          itemsIncoming = itemsIncoming.filter(x => x !== it);
          saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
          renderIncoming(searchInputIncoming.value);
          renderTrash();
        });
      }
      tr.querySelector('[data-action="transfer"]').addEventListener('click', () => showTransferModal(it, 'incoming', 'البريد الوارد', it.id));
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateIncomingForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للكتاب الوارد');
      });
      annotateTooltipCells(tr);
      incomingTableBody.appendChild(tr);
    });
    updateSelectAllCheckboxState(selectAllIncomingCheckbox, filtered);
    updateDashboardStats();

    const pag = renderPagination('incomingPagination', 'incoming', filtered.length, currentPageIncoming);
    const wrapper = document.querySelector('#incomingTable').parentElement;
    if (!document.getElementById('incomingPagination')) wrapper.appendChild(pag);
  };

  const renderReception = (filter='') => {
    receptionTableBody.innerHTML = '';
    let filtered = itemsReception.filter(it => {
      if (!filter) return true;
      return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
    });
    if (sortReceptionLatest) {
      filtered = filtered.slice().sort((a,b) => {
        const da = getItemMainDate(a); const db = getItemMainDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPageReception > totalPages) currentPageReception = Math.max(1, totalPages);
    const rows = filtered.slice((currentPageReception - 1) * PAGE_SIZE, currentPageReception * PAGE_SIZE);

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
            <button class="btn" data-action="transfer">تحويل</button>
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
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      const canManageReception = canManageSensitiveActions();
      if (deleteBtn) {
        deleteBtn.disabled = !canManageReception;
        deleteBtn.title = getSensitiveActionTitle(canManageReception);
        deleteBtn.addEventListener('click', async () => {
          if (!canManageReception) return;
          if (!confirm('هل تريد حذف هذا السجل؟')) return;
          try {
            if (it.id) await deleteFromServer(`/api/reception/${it.id}`);
          } catch (error) {
            console.error('Delete reception failed', error);
            alert('تعذر حذف السجل من الخادم.');
            return;
          }
          registerDeletedRecordInTrash('reception', it);
          itemsReception = itemsReception.filter(x => x !== it);
          saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
          renderReception(searchInputReception.value);
          renderTrash();
        });
      }
      tr.querySelector('[data-action="transfer"]').addEventListener('click', () => showTransferModal(it, 'reception', 'الاستقبال والشكاوى', it.id));
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
        populateReceptionForm(it);
      });
      tr.querySelector('[data-action="view"]').addEventListener('click', () => {
        showAttachmentsModal(it.attachments || [], 'المرفقات للاستقبال والشكاوى');
      });
      annotateTooltipCells(tr);
      receptionTableBody.appendChild(tr);
    });

    updateSelectAllCheckboxState(selectAllReceptionCheckbox, filtered);

    const pag = renderPagination('receptionPagination', 'reception', filtered.length, currentPageReception);
    const wrapper = document.querySelector('#receptionTable').parentElement;
    if (!document.getElementById('receptionPagination')) wrapper.appendChild(pag);
  };

  const renderTrash = () => {
    const tbody = document.querySelector('#trashTable tbody');
    if (!tbody) return;
    const rows = Array.isArray(trashItems) ? trashItems : [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">لا توجد سجلات في سلة المهملات.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(record => {
      const tr = document.createElement('tr');
      const label = record.label || 'سجل';
      const entityLabel = record.entity === 'outgoing' ? 'بريد صادر' : record.entity === 'incoming' ? 'بريد وارد' : record.entity === 'reception' ? 'استقبال وشكاوي' : record.entity === 'archive' ? 'أضبارة' : 'سجل';
      const deletedAt = record.deletedAt ? new Date(record.deletedAt).toLocaleString('ar-SY') : '-';
      tr.innerHTML = `
        <td class="row-select"><input type="checkbox" ${record._selected ? 'checked' : ''} aria-label="تحديد السطر" /></td>
        <td>${entityLabel}</td>
        <td>${label}</td>
        <td>${deletedAt}</td>
        <td class="actions">
          <button class="btn small" data-action="restore">تراجع عن الحذف</button>
          <button class="btn small danger" data-action="delete">حذف نهائي</button>
        </td>
      `;
      const checkbox = tr.querySelector('.row-select input[type="checkbox"]');
      if (record._selected) tr.classList.add('selected');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          record._selected = e.target.checked;
          tr.classList.toggle('selected', e.target.checked);
          updateSelectAllCheckboxState(document.getElementById('selectAllTrash'), rows);
        });
      }
      const restoreBtn = tr.querySelector('[data-action="restore"]');
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      if (restoreBtn) restoreBtn.addEventListener('click', () => restoreTrashItem(record));
      if (deleteBtn) deleteBtn.addEventListener('click', () => permanentDeleteTrashItem(record));
      tbody.appendChild(tr);
    });
    updateSelectAllCheckboxState(document.getElementById('selectAllTrash'), rows);
  };

  const trashRestoreSelectedBtn = document.getElementById('trashRestoreSelectedBtn');
  const trashDeleteSelectedBtn = document.getElementById('trashDeleteSelectedBtn');
  const trashEmptyBtn = document.getElementById('trashEmptyBtn');
  const selectAllTrashCheckbox = document.getElementById('selectAllTrash');

  if (trashRestoreSelectedBtn) {
    trashRestoreSelectedBtn.addEventListener('click', async () => {
      if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
      const selected = trashItems.filter(it => it._selected);
      if (!selected.length) return alert('لم يتم اختيار أي سجل للاسترجاع.');
      for (const record of selected) {
        await restoreTrashItem(record);
      }
    });
  }

  if (trashDeleteSelectedBtn) {
    trashDeleteSelectedBtn.addEventListener('click', async () => {
      if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
      const selected = trashItems.filter(it => it._selected);
      if (!selected.length) return alert('لم يتم اختيار أي سجل للحذف النهائي.');
      if (!confirm(`هل تريد حذف ${selected.length} سجل${selected.length > 1 ? 'اً' : ''} نهائياً؟`)) return;
      for (const record of selected) {
        await permanentDeleteTrashItem(record);
      }
    });
  }

  if (trashEmptyBtn) {
    trashEmptyBtn.addEventListener('click', () => emptyTrash());
  }

  if (selectAllTrashCheckbox) {
    selectAllTrashCheckbox.addEventListener('change', (e) => {
      trashItems.forEach(it => { it._selected = e.target.checked; });
      renderTrash();
    });
  }

  // Form handling and reset
  cancelBtn.addEventListener('click', clearForm);
  resetBtn.addEventListener('click', clearForm);
  cancelIncomingBtn.addEventListener('click', clearIncomingForm);
  resetIncomingBtn.addEventListener('click', clearIncomingForm);
  cancelReceptionBtn.addEventListener('click', clearReceptionForm);
  resetReceptionBtn.addEventListener('click', clearReceptionForm);
  // archive reset
  const archiveCancelBtn = document.getElementById('archiveCancelBtn');
  function openArchiveRecord(item){
    if (!item) return;
    const view = document.getElementById('archiveNewView');
    if (view) view.style.display = '';
    showArchiveSubview('archiveNewView');
    showArchivesTopNav('new');
    if (statsSection) statsSection.style.display = 'none';
    const cards = document.querySelector('.archives-cards'); if (cards) cards.style.display = 'none';
    populateArchiveForm(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function populateArchiveForm(item){
    if (!archiveForm) return;
    // map legacy fields if present
    document.getElementById('archiveProjectName').value = item.projectName || item.subject || item.recipient || '';
    setTimeout(resizeArchiveProjectNameField, 0);
    document.getElementById('archiveCreateDate').value = item.createDate || item.date || getTodayValue();
    const derivedStatusInfo = (window.ArchiveTransferState && typeof window.ArchiveTransferState.deriveArchiveStatusInfo === 'function')
      ? window.ArchiveTransferState.deriveArchiveStatusInfo(item, Date.now())
      : parseArchiveStatus(item.status);
    const statusInfo = derivedStatusInfo || parseArchiveStatus(item.status);
    const statusEl = document.getElementById('archiveStatus'); if (statusEl) statusEl.value = statusInfo.base || 'تم الاستلام';
    const departmentEl = document.getElementById('archiveDepartment'); if (departmentEl) departmentEl.value = statusInfo.department || inferArchiveDepartmentFromItem(item) || '';
    const statusDisplay = document.getElementById('archiveStatusDisplay'); if (statusDisplay) statusDisplay.value = buildArchiveStatusValue(statusInfo.base || 'تم الاستلام', departmentEl ? departmentEl.value : '');
    // studies
    document.getElementById('studies_cost').value = (item.studies && item.studies.cost) || '';
    document.getElementById('studies_team').value = (item.studies && item.studies.team) || '';
    document.getElementById('studies_notes').value = (item.studies && item.studies.notes) || '';
    document.getElementById('studies_outNo').value = (item.studies && item.studies.outNo) || '';
    document.getElementById('studies_outDate').value = (item.studies && item.studies.outDate) || '';
    document.getElementById('studies_expectedValue').value = (item.studies && item.studies.expected && item.studies.expected.value) || '';
    if (item.studies && item.studies.expected && item.studies.expected.unit) document.getElementById('studies_expectedUnit').value = item.studies.expected.unit;
    document.getElementById('studies_enteredBy').value = (item.studies && item.studies.enteredBy) || '';
    // tech
    document.getElementById('tech_inDate').value = (item.tech && item.tech.inDate) || '';
    document.getElementById('tech_inNo').value = (item.tech && item.tech.inNo) || '';
    document.getElementById('tech_notes').value = (item.tech && item.tech.notes) || '';
    document.getElementById('tech_outDate').value = (item.tech && item.tech.outDate) || '';
    document.getElementById('tech_outNo').value = (item.tech && item.tech.outNo) || '';
    document.getElementById('tech_expectedValue').value = (item.tech && item.tech.expected && item.tech.expected.value) || '';
    if (item.tech && item.tech.expected && item.tech.expected.unit) document.getElementById('tech_expectedUnit').value = item.tech.expected.unit;
    document.getElementById('tech_enteredBy').value = (item.tech && item.tech.enteredBy) || '';
    // gov
    document.getElementById('gov_inDate').value = (item.gov && item.gov.inDate) || '';
    document.getElementById('gov_inNo').value = (item.gov && item.gov.inNo) || '';
    document.getElementById('gov_notes').value = (item.gov && item.gov.notes) || '';
    document.getElementById('gov_expectedValue').value = (item.gov && item.gov.expected && item.gov.expected.value) || '';
    if (item.gov && item.gov.expected && item.gov.expected.unit) document.getElementById('gov_expectedUnit').value = item.gov.expected.unit;
    document.getElementById('gov_enteredBy').value = (item.gov && item.gov.enteredBy) || '';
    // legal
    document.getElementById('legal_inDate').value = (item.legal && item.legal.inDate) || '';
    document.getElementById('legal_inNo').value = (item.legal && item.legal.inNo) || '';
    document.getElementById('legal_notes').value = (item.legal && item.legal.notes) || '';
    document.getElementById('legal_outDate').value = (item.legal && item.legal.outDate) || '';
    document.getElementById('legal_outNo').value = (item.legal && item.legal.outNo) || '';
    document.getElementById('legal_expectedValue').value = (item.legal && item.legal.expected && item.legal.expected.value) || '';
    if (item.legal && item.legal.expected && item.legal.expected.unit) document.getElementById('legal_expectedUnit').value = item.legal.expected.unit;
    document.getElementById('legal_enteredBy').value = (item.legal && item.legal.enteredBy) || '';
    // gov2
    document.getElementById('gov2_outDate').value = (item.gov2 && item.gov2.outDate) || '';
    document.getElementById('gov2_outNo').value = (item.gov2 && item.gov2.outNo) || '';
    document.getElementById('gov2_notes').value = (item.gov2 && item.gov2.notes) || '';
    document.getElementById('gov2_inDate').value = (item.gov2 && item.gov2.inDate) || '';
    document.getElementById('gov2_inNo').value = (item.gov2 && item.gov2.inNo) || '';
    document.getElementById('gov2_enteredBy').value = (item.gov2 && item.gov2.enteredBy) || '';
    archiveForm.dataset.editingId = item.id;
    archiveForm._attachments = item.attachments || {};
    // enforce duration lock based on per-section saved timestamps if present
    try { enforceDurationLockForForm(archiveForm, item); } catch (e) {}
    const archiveFinished = isArchiveFinishedStatus(item.status);
    if (archiveFinished) {
      archiveForm.dataset.frozen = '1';
      archiveForm.querySelectorAll('input,select,textarea,button').forEach(el => {
        if (!el || !el.id) return;
        if (['archiveCancelBtn','archiveFormBackBtn','archiveSaveBtn','editArchiveBtn'].includes(el.id)) return;
        el.disabled = true;
      });
      const note = archiveForm.querySelector('.frozen-note');
      if (!note) {
        const frozenNote = document.createElement('div');
        frozenNote.className = 'frozen-note';
        frozenNote.style.background = '#fff1f2';
        frozenNote.style.padding = '8px';
        frozenNote.style.border = '1px solid #fecaca';
        frozenNote.style.borderRadius = '6px';
        frozenNote.style.marginBottom = '10px';
        frozenNote.textContent = 'هذه الأضبارة منتهية ولا يمكن تعديلها أو تحويلها. لرفع القفل، يجب أن يقوم مشرف بإعادة فتحها.';
        archiveForm.parentNode && archiveForm.parentNode.insertBefore(frozenNote, archiveForm);
      }
    } else {
      delete archiveForm.dataset.frozen;
      archiveForm.querySelectorAll('input,select,textarea,button').forEach(el => {
        if (!el || !el.id) return;
        el.disabled = false;
      });
      const note = archiveForm.querySelector('.frozen-note'); if (note) note.remove();
    }
    // if this circle mail has lockedAt set, disable expected-duration inputs
    try {
      const locked = item.lockedAt || item.locked_at || null;
      const expects = ['studies_expectedValue','tech_expectedValue','gov_expectedValue','legal_expectedValue','gov2_expectedValue'];
      expects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !!locked;
        if (locked) el.setAttribute('title', 'هذا الحقل تم تجميده'); else el.removeAttribute('title');
      });
    } catch (e) { /* ignore */ }
    // render previews for each preview area
    ['studies','tech','gov','legal','gov2'].forEach(sec => {
      const preview = document.getElementById((sec==='gov2')? 'gov2Preview': (sec+'Preview'));
      if (!preview) return;
      preview.innerHTML = '';
      const list = (archiveForm._attachments && archiveForm._attachments[sec]) ? archiveForm._attachments[sec] : [];
      list.forEach((a, idx) => {
        const div = document.createElement('div'); div.className='preview-item';
        const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='10px';
        if (a.type && a.type.startsWith('image')){
          const img = document.createElement('img'); img.src = a.data; img.alt = a.name; img.style.width='64px'; img.style.height='48px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
          left.appendChild(img);
        } else if (a.type === 'application/pdf'){
          const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='PDF'; icon.style.padding='10px'; left.appendChild(icon);
        } else {
          const icon = document.createElement('div'); icon.className='pdf-icon'; icon.textContent='FILE'; icon.style.padding='10px'; left.appendChild(icon);
        }
        const meta = document.createElement('div'); meta.className='meta'; const nameEl = document.createElement('div'); nameEl.textContent = a.name; meta.appendChild(nameEl);
        left.appendChild(meta);
        div.appendChild(left);
        const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx = idx; cb.style.marginLeft='8px';
        const open = document.createElement('button'); open.type='button'; open.className='btn small'; open.textContent='فتح'; open.addEventListener('click', () => showAttachmentsModal([a], a.name));
        right.appendChild(open); right.appendChild(cb);
        div.appendChild(right);
        preview.appendChild(div);
      });
    });
    const view = document.getElementById('archiveNewView'); if (view) view.style.display = '';
    archiveForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // enable edit button when populating an existing record
    const editBtn = document.getElementById('editArchiveBtn'); if (editBtn) editBtn.disabled = false;
  }
  function clearArchiveForm(){
    if (!archiveForm) return;
    archiveForm.reset();
    archiveForm.removeAttribute('data-editing-id');
    setTimeout(resizeArchiveProjectNameField, 0);
    archiveForm._attachments = {};
    // clear previews
    ['studiesPreview','techPreview','govPreview','legalPreview','gov2Preview'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    // default create date to today and set enteredBy to current user
    const createDateEl = document.getElementById('archiveCreateDate'); if (createDateEl) createDateEl.value = (new Date()).toISOString().slice(0,10);
    const enteredBy = (currentUser && (currentUser.name || currentUser.username)) ? (currentUser.name || currentUser.username) : '';
    ['studies_enteredBy','tech_enteredBy','gov_enteredBy','legal_enteredBy','gov2_enteredBy'].forEach(id => { const el = document.getElementById(id); if (el) el.value = enteredBy; });
    const statusEl = document.getElementById('archiveStatus'); if (statusEl) statusEl.value = 'قيد العمل';
    const departmentEl = document.getElementById('archiveDepartment'); if (departmentEl) departmentEl.value = '';
    const statusDisplay = document.getElementById('archiveStatusDisplay'); if (statusDisplay) statusDisplay.value = 'قيد العمل';
    // ensure edit button is disabled for a fresh new form
    const editBtn = document.getElementById('editArchiveBtn'); if (editBtn) editBtn.disabled = true;
    // ensure badges present
    try { ensureDurationBadges(['studies_expectedValue','tech_expectedValue','gov_expectedValue','legal_expectedValue','gov2_expectedValue']); } catch (e) {}
    // ensure duration inputs are enabled for a fresh form (no pre-lock)
    try {
      const fields = ['studies_expectedValue','tech_expectedValue','gov_expectedValue','legal_expectedValue','gov2_expectedValue'];
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = false;
        el.classList.remove('duration-locked');
        if (el._durationBadge) { el._durationBadge.style.display = 'none'; }
      });
      // clear any existing timers attached to the form
      try { if (archiveForm._durationLockTimers) { archiveForm._durationLockTimers.forEach(t => clearTimeout(t)); archiveForm._durationLockTimers = []; } } catch(e){}
    } catch (e) {}
  }
  if (archiveCancelBtn) archiveCancelBtn.addEventListener('click', clearArchiveForm);

  // Back button in archives: return to main dashboard (hide tab contents)
  if (archivesBackBtn) {
    archivesBackBtn.addEventListener('click', () => {
      // remove active state from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      // hide all tab contents
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      // show dashboard stats
      if (statsSection) statsSection.style.display = '';
      // scroll to top for clarity
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Print current archive (A4) — builds a print window and invokes print
  const printArchiveBtn = document.getElementById('printArchiveBtn');
  function buildArchiveFromForm(){
    const formEl = document.getElementById('archiveForm'); if (!formEl) return null;
    const payload = {
      projectName: document.getElementById('archiveProjectName') ? document.getElementById('archiveProjectName').value : '',
      createDate: document.getElementById('archiveCreateDate') ? document.getElementById('archiveCreateDate').value : '',
      status: document.getElementById('archiveStatus') ? document.getElementById('archiveStatus').value : 'قيد العمل',
      studies: {
        cost: document.getElementById('studies_cost') ? document.getElementById('studies_cost').value : '',
        team: document.getElementById('studies_team') ? document.getElementById('studies_team').value : '',
        notes: document.getElementById('studies_notes') ? document.getElementById('studies_notes').value : ''
      },
      attachments: formEl._attachments || {}
    };
    return payload;
  }
  const openPrintWindow = (record) => {
    const archiveNode = document.getElementById('archiveNewView');
    if (!archiveNode) return alert('لا يوجد عرض للأضبارة للطباعة.');
    const win = window.open('', '_blank');
    if (!win) return alert('غير قادر على فتح نافذة الطباعة — تحقق من إعدادات المنبثقات.');
    // build a minimal document that links the same stylesheet to preserve look
    const doc = win.document;
    doc.open();
    doc.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة الأضبارة</title>');
    doc.write('<link rel="stylesheet" href="css/styles.css">');
    doc.write('<style>@page{size:A4;margin:18mm;} body{background:#fff;padding:10mm}</style></head><body>');
    // clone the visible archive view content
    const clone = archiveNode.cloneNode(true);
    // remove interactive elements that shouldn't print (file inputs/buttons)
    clone.querySelectorAll('input[type=file], button, .btn').forEach(n=>n.remove());
    doc.body.appendChild(clone);
    doc.write('</body></html>');
    doc.close();
    setTimeout(()=>{ try { win.focus(); win.print(); } catch(e){ console.warn('Print failed', e); } }, 500);
  };
  if (printArchiveBtn) printArchiveBtn.addEventListener('click', () => {
    const formEl = document.getElementById('archiveForm'); let record = null;
    if (formEl && formEl.dataset.editingId) {
      record = itemsArchive.find(it => String(it.id) === String(formEl.dataset.editingId));
    }
    if (!record) record = buildArchiveFromForm();
    if (!record) return alert('لا يوجد سجل للطباعة.');
    openPrintWindow(record);
  });

  // Helper to open archives list view (same fields as archive tab)
  const openArchiveList = async (push, circleFilter = null) => {
    const shouldPush = (typeof push === 'boolean') ? push : true;
    if (shouldPush) try { pushCurrentToHistory(); } catch (e) {}
    // set optional circle filter (when opening from a circle)
    archiveListCircleFilter = circleFilter || null;
    // activate archives tab
    tabs.forEach(t => t.classList.remove('active'));
    const archivesTab = Array.from(tabs).find(t => t.getAttribute('data-tab') === 'archives');
    if (archivesTab) archivesTab.classList.add('active');
    // hide other tab contents and show archives
    document.querySelectorAll('.tab-content').forEach(c => { if (c.id === 'archives') c.style.display = ''; else c.style.display = 'none'; });
    const cards = document.querySelector('.archives-cards'); if (cards) cards.style.display = 'none';
    showArchiveSubview('archivesListView');
    if (statsSection) statsSection.style.display = 'none';
    try { await loadArchive(); } catch (e) {}
    // Ensure circle-mail transfer records and histories are loaded so transferred archives appear
    try { await loadCircleMails(); } catch (e) { console.warn('Failed to load circle mails before rendering archive list', e); }
    try { await loadHistories(); } catch (e) { console.warn('Failed to load histories before rendering archive list', e); }
    // Diagnostic logging to help detect why some transferred archives appear in mail list
    try {
      // (diagnostic logs removed)
    } catch (e) {}
    renderArchive(archiveSearchInput ? archiveSearchInput.value : '');
    try { showArchivesTopNav('list'); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { attachLocalBackToCurrentView(); } catch (e) {}
  };
  if (archiveListCard) archiveListCard.addEventListener('click', () => openArchiveList(true));

  // Back to cards list inside archives
  if (archivesListBackBtn) {
    archivesListBackBtn.addEventListener('click', () => {
      const cards = document.querySelector('.archives-cards');
      if (cards) cards.style.display = '';
      if (archivesListView) archivesListView.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try { attachLocalBackToCurrentView(); } catch (e) {}
    });
  }

  // Open late archives view when clicking the "الأضابير المتأخرة" card
  const openArchiveLate = (push) => {
    const shouldPush = (typeof push === 'boolean') ? push : true;
    if (shouldPush) try { pushCurrentToHistory(); } catch(e){}
    const cards = document.querySelector('.archives-cards'); if (cards) cards.style.display = 'none';
    showArchiveSubview('archivesLateView');
    if (statsSection) statsSection.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { attachLocalBackToCurrentView(); } catch (e) {}
    try { renderArchiveLate(); } catch (e) {}
    try { showArchivesTopNav('late'); } catch (e) {}
  };
  if (archiveLateCard) archiveLateCard.addEventListener('click', () => openArchiveLate(true));

  // Show/hide archives top nav and set active button state
  function showArchivesTopNav(active){
    const nav = document.getElementById('archivesTopNav'); if (!nav) return;
    nav.style.display = '';
    const btnNew = document.getElementById('archiveTopNewBtn'); const btnList = document.getElementById('archiveTopListBtn'); const btnLate = document.getElementById('archiveTopLateBtn');
    [btnNew,btnList,btnLate].forEach(b=>{ if(b) b.classList.remove('active'); });
    if (active === 'new' && btnNew) btnNew.classList.add('active');
    if (active === 'list' && btnList) btnList.classList.add('active');
    if (active === 'late' && btnLate) btnLate.classList.add('active');
  }

  // Wire top nav buttons (switch views without pushing history)
  const topNewBtn = document.getElementById('archiveTopNewBtn'); if (topNewBtn) topNewBtn.addEventListener('click', () => openArchiveNew(false));
  const topListBtn = document.getElementById('archiveTopListBtn'); if (topListBtn) topListBtn.addEventListener('click', () => openArchiveList(false));
  const topLateBtn = document.getElementById('archiveTopLateBtn'); if (topLateBtn) topLateBtn.addEventListener('click', () => openArchiveLate(false));

  // Back from late view to cards list
  if (lateBackBtn) {
    lateBackBtn.addEventListener('click', () => {
      const cards = document.querySelector('.archives-cards');
      if (cards) cards.style.display = '';
      if (archivesLateView) archivesLateView.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try { attachLocalBackToCurrentView(); } catch (e) {}
    });
  }

  // Archive search box
  if (archiveSearchInput) {
    archiveSearchInput.addEventListener('input', (e) => { currentPageArchive = 1; renderArchive(e.target.value); });
  }

  if (countAllBtn) {
    countAllBtn.addEventListener('click', () => {
      // toggle select all for visible rows
      const filter = archiveSearchInput ? (archiveSearchInput.value || '') : '';
      const visible = (itemsArchive || []).filter(it => {
        if (!filter) return true;
        return Object.values(it).join(' ').toLowerCase().includes(filter.toLowerCase());
      });
      const anyUnselected = visible.some(it => !it._selected);
      visible.forEach(it => { it._selected = anyUnselected; });
      renderArchive(filter);
    });
  }

  if (refreshAllBtn) {
    // renamed visually to 'انهاء المحدد' — mark selected records as finished
    refreshAllBtn.addEventListener('click', () => {
      if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
      const selected = (itemsArchive || []).filter(it => it._selected);
      if (!selected.length) return alert('لم يتم اختيار أي سجل لإنهائه.');
      if (!confirm(`هل تريد وضع حالة 'منتهية' على ${selected.length} سجل${selected.length>1?'اً':''}؟`)) return;
      selected.forEach(it => { it.status = 'منتهية'; it._selected = false; });
      saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
      renderArchive(archiveSearchInput ? archiveSearchInput.value : '');
      alert('تم وضع حالة الانتهاء على السجلات المحددة.');
    });
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      if (!canManageSensitiveActions()) return alert('هذه العملية متاحة فقط للمشرف العام والمشرف.');
      const selected = itemsArchive.filter(it => it._selected);
      if (!selected.length) return alert('لم يتم اختيار سجلات للحذف.');
      if (!confirm(`هل تريد حذف ${selected.length} سجل${selected.length>1?'ان':''}؟`)) return;
      itemsArchive = itemsArchive.filter(it => !it._selected);
      saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
      renderArchive(archiveSearchInput ? archiveSearchInput.value : '');
    });
  }

  // helper: read files as data URLs
  function readFilesAsDataURLs(fileList){
    const arr = Array.from(fileList || []);
    return Promise.all(arr.map(f => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, type: f.type, data: reader.result });
      reader.onerror = (err) => rej(new Error('File read error: ' + (err && err.message ? err.message : f.name)));
      try { reader.readAsDataURL(f); } catch (e) { rej(e); }
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
        const a = document.createElement('a'); a.href = att.data; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'فتح/تحميل ملف بي دي إف — ' + att.name; a.download = att.name; wrap.appendChild(a);
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

  // Enforce duration lock: disables duration numeric inputs 30 minutes after savedAt
  function enforceDurationLockForForm(formEl, itemOrSavedAt){
    if (!formEl) return;
    // clear previous timers
    try { if (formEl._durationLockTimers){ formEl._durationLockTimers.forEach(t => clearTimeout(t)); } } catch(e){}
    formEl._durationLockTimers = [];

    // mapping of section -> input id
    const sectionFieldMap = {
      studies: 'studies_expectedValue',
      tech: 'tech_expectedValue',
      gov: 'gov_expectedValue',
      legal: 'legal_expectedValue',
      gov2: 'gov2_expectedValue'
    };
    const lockAfterMs = 30 * 60 * 1000; // 30 minutes

    // helper to schedule lock for a single field based on its saved timestamp
    const scheduleLockForField = (fieldId, savedTimestamp) => {
      if (!fieldId) return;
      const el = document.getElementById(fieldId);
      if (!el) return;
      // ensure badge exists
      ensureDurationBadges([fieldId]);
      if (!savedTimestamp) return; // nothing to schedule
      const saved = new Date(savedTimestamp);
      if (isNaN(saved.getTime())) return;
      const now = Date.now();
      const elapsed = now - saved.getTime();
      const lockNow = () => {
        try { el.disabled = true; el.classList.add('duration-locked'); const b = el._durationBadge; if (b) { b.textContent = 'ممنوع التعديل بعد 30 دقيقة من حفظ الأضبارة'; b.className = 'duration-badge'; b.style.display = ''; } } catch(e){}
      };
      if (elapsed >= lockAfterMs) { lockNow(); return; }
      const remaining = lockAfterMs - elapsed;
      const t = setTimeout(() => { try { lockNow(); } catch(e){} }, remaining);
      formEl._durationLockTimers.push(t);
    };

    // If a string or Date was passed (legacy), apply same timestamp to all fields
    if (typeof itemOrSavedAt === 'string' || itemOrSavedAt instanceof Date) {
      const savedStr = (itemOrSavedAt instanceof Date) ? itemOrSavedAt.toISOString() : itemOrSavedAt;
      Object.values(sectionFieldMap).forEach(fid => scheduleLockForField(fid, savedStr));
      return;
    }

    // Otherwise expect an item object with per-section savedAt values: section.savedAt
    const item = itemOrSavedAt || {};
    Object.keys(sectionFieldMap).forEach(section => {
      const fieldId = sectionFieldMap[section];
      let savedTimestamp = null;
      try {
        if (item[section] && item[section].savedAt) savedTimestamp = item[section].savedAt;
        // Do NOT fall back to item.savedAt here. Locks are per-section only and
        // should only apply when that section has its own savedAt timestamp.
      } catch (e) { savedTimestamp = null; }
      scheduleLockForField(fieldId, savedTimestamp);
    });
  }

  // Create or update duration badges for a list of field ids
  function ensureDurationBadges(fieldIds){
    if (!Array.isArray(fieldIds)) return;
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // attach a reference holder for badge
      if (!el._durationBadge) {
        const span = document.createElement('span');
        span.className = 'duration-note';
        span.textContent = 'سيُمنع التعديل بعد حفظ الأضبارة (30 دقيقة)';
        span.style.display = 'inline-block';
        el.parentNode && el.parentNode.insertBefore(span, el.nextSibling);
        el._durationBadge = span;
      } else {
        // update note if exists
        const b = el._durationBadge; b.className = 'duration-note'; b.textContent = 'سيُمنع التعديل بعد حفظ الأضبارة (30 دقيقة)';
      }
    });
  }

  // دالة موحدة لمعالجة ورفع الملفات تدعم الأحجام الكبيرة
  async function processAndUploadFile(file) {
    const MAX_MB = 100;
    if (file.size > MAX_MB * 1024 * 1024) {
      throw new Error(`الملف "${file.name}" كبير جداً. الحد الأقصى المسموح به هو ${MAX_MB} ميجابايت.`);
    }

    const portsToTry = [];
    try {
      if (window && window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
        portsToTry.push(window.location.origin.replace(/\/$/, ''));
      }
    } catch (e) {}
    for (let p = 3000; p <= 3035; p++) portsToTry.push('http://localhost:' + p);

    const fd = new FormData(); 
    fd.append('file', file);
    
    const timeoutFetch = (url, ms = 60000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), ms);
      return fetch(url, { method: 'POST', body: fd, signal: controller.signal })
        .finally(() => clearTimeout(id));
    };

    for (const base of portsToTry) {
      try {
        const uploadUrl = base.replace(/\/$/, '') + '/api/upload-file';
        const resp = await timeoutFetch(uploadUrl, 60000);
        if (resp && resp.ok) {
          const j = await resp.json();
          const publicPath = base.replace(/\/$/, '') + (j.path || ('/uploads/' + (j.filename || file.name)));
          return { name: j.originalname || file.name, type: j.mimetype || file.type, data: publicPath, url: publicPath, size: j.size || file.size, uploaded: true };
        }
      } catch (e) {}
    }

    // حل احتياطي: تحويل الملف إلى Base64 إذا فشل الرفع المباشر
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
      reader.onerror = (err) => reject(new Error('File read error: ' + (err && err.message ? err.message : file.name)));
      reader.readAsDataURL(file);
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

    processAndUploadFile(file).then(att => {
      form._attachmentsTemp = form._attachmentsTemp || [];
      form._attachmentsTemp.push(att);
      renderPreview(previewEl, form._attachmentsTemp, { editable: true, onRemove: (idx) => removeAttachmentFromForm(form, previewEl, idx) });
      inputEl.value = '';
    }).catch(err => {
      console.error('Attachment processing failed', err);
      alert('حدث خطأ أثناء معالجة المرفق: ' + err.message);
      inputEl.value = '';
    });
  }

  if (outgoingAddAttachmentBtn){
    outgoingAddAttachmentBtn.addEventListener('click', () => {
      if (outgoingAttachmentInput) outgoingAttachmentInput.click();
    });
  }
  // archive attachments handlers
  const archiveAddAttachmentBtn = document.getElementById('archiveAddAttachment');
  const archiveAttachmentInput = document.getElementById('archiveAttachmentInput');
  const archivePreviewEl = document.getElementById('archivePreview');
  if (archiveAddAttachmentBtn){
    archiveAddAttachmentBtn.addEventListener('click', () => { if (archiveAttachmentInput) archiveAttachmentInput.click(); });
  }
  if (archiveAttachmentInput){
    archiveAttachmentInput.addEventListener('change', () => addAttachmentToForm(archiveForm, archiveAttachmentInput, archivePreviewEl));
  }
  if (outgoingAttachmentInput){
    outgoingAttachmentInput.addEventListener('change', () => addAttachmentToForm(form, outgoingAttachmentInput, outgoingPreviewEl));
  }
  if (outgoingImportBtn && outgoingImportInput){
    outgoingImportBtn.addEventListener('click', () => outgoingImportInput.click());
    outgoingImportInput.addEventListener('change', async () => {
      if (outgoingImportInput.files.length) {
        importExcelFile(outgoingImportInput.files[0], outgoingHeaderMap, async (importedItems) => {
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
  // wire up sort toggles
  const sortOutgoingEl = document.getElementById('sortOutgoingLatest');
  if (sortOutgoingEl) {
    sortOutgoingEl.checked = sortOutgoingLatest;
    sortOutgoingEl.addEventListener('change', (e) => { sortOutgoingLatest = !!e.target.checked; render(searchInput.value); });
  }
  const sortIncomingEl = document.getElementById('sortIncomingLatest');
  if (sortIncomingEl) {
    sortIncomingEl.checked = sortIncomingLatest;
    sortIncomingEl.addEventListener('change', (e) => { sortIncomingLatest = !!e.target.checked; renderIncoming(searchInputIncoming.value); });
  }
  const sortReceptionEl = document.getElementById('sortReceptionLatest');
  if (sortReceptionEl) {
    sortReceptionEl.checked = sortReceptionLatest;
    sortReceptionEl.addEventListener('change', (e) => { sortReceptionLatest = !!e.target.checked; renderReception(searchInputReception.value); });
  }
  if (outgoingExportBtn){
    outgoingExportBtn.addEventListener('click', () => exportDataToExcel(items, outgoingHeaders, 'الكتب_الصادرة.xlsx'));
  }
  if (outgoingDeleteSelectedBtn){
    outgoingDeleteSelectedBtn.addEventListener('click', async () => {
      items = await deleteSelectedItems(items, 'outgoing', 'الكتب الصادرة');
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
        importExcelFile(incomingImportInput.files[0], incomingHeaderMap, async (importedItems) => {
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
      itemsIncoming = await deleteSelectedItems(itemsIncoming, 'incoming', 'الكتب الواردة');
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

  if (selectAllArchiveCheckbox){
    selectAllArchiveCheckbox.addEventListener('change', (e) => {
      const visibleRows = itemsArchive.filter(it => true);
      toggleSelectionForVisibleRows(visibleRows, e.target.checked);
      renderArchive();
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
        importExcelFile(receptionImportInput.files[0], receptionHeaderMap, async (importedItems) => {
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
      itemsReception = await deleteSelectedItems(itemsReception, 'reception', 'الاستقبال والشكاوى');
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
    // Make attachments modal fullscreen
    attachmentsModal.classList.add('fullscreen-mode');
    const win = attachmentsModal.querySelector('.modal-content');
    if (win) win.classList.add('full-screen');
    attachmentsModal.classList.remove('hidden');
    // The line below was a duplicate and has been removed.
  }

  if (closeAttachmentsModal){
    closeAttachmentsModal.addEventListener('click', () => {
      if (attachmentsModal) attachmentsModal.classList.add('hidden');
      // Also remove fullscreen classes
      if (attachmentsModal) attachmentsModal.classList.remove('fullscreen-mode');
      const win = attachmentsModal.querySelector('.modal-content');
      if (win) win.classList.remove('full-screen');
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
    const editingCircle = form.dataset.editingCircle ? JSON.parse(form.dataset.editingCircle) : null;
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
      let saved;
      if (editingCircle) {
        // update the circle mail by composite key with the new payload and attachments
        await saveToServer('/api/circlemail/update-by-key', { sourceEntity: editingCircle.sourceEntity, sourceId: editingCircle.sourceId, circleName: editingCircle.circleName, updates: { payload: JSON.stringify(payload), attachments: JSON.stringify(attachments) } });
        // reload circle mails and histories
        await loadCircleMails();
        await loadHistories();
        // clear editingCircle flag
        delete form.dataset.editingCircle;
        // close fullscreen style if applied
        const formCard = document.querySelector('.outgoing-form-card'); if (formCard) formCard.classList.remove('fullscreen');
        alert('تم حفظ التعديلات على سجل البريد الدائري.');
      } else {
        saved = editingId
          ? await saveToServer(`/api/outgoing/${editingId}`, payload, 'PUT')
          : await saveToServer('/api/outgoing', payload, 'POST');
        const normalized = { ...saved, attachments: parseAttachments(saved.attachments) };
        if (editingId) {
          items = items.map(it => it.id === normalized.id ? normalized : it);
          await logActivity('edit_outgoing', { note: `تعديل سجل صادر: ${normalized.subject || normalized.serial || normalized.id}`, sourceEntity: 'outgoing', sourceId: normalized.id });
        } else {
          items.unshift(normalized);
          await logActivity('add_outgoing', { note: `إضافة سجل صادر: ${normalized.subject || normalized.serial || normalized.id}`, sourceEntity: 'outgoing', sourceId: normalized.id });
        }
        saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, items);
        render(searchInput.value);
        clearForm();
      }
      
    } catch (error) {
      console.error('Outgoing save failed', error);
      alert('حدث خطأ أثناء حفظ الكتاب الصادر في الخادم: ' + error.message);
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
        await logActivity('edit_incoming', { note: `تعديل سجل وارد: ${normalized.subject || normalized.inNo || normalized.id}`, sourceEntity: 'incoming', sourceId: normalized.id });
      } else {
        itemsIncoming.unshift(normalized);
        await logActivity('add_incoming', { note: `إضافة سجل وارد: ${normalized.subject || normalized.inNo || normalized.id}`, sourceEntity: 'incoming', sourceId: normalized.id });
      }
      saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, itemsIncoming);
      renderIncoming(searchInputIncoming.value);
      clearIncomingForm();
    } catch (error) {
      console.error('Incoming save failed', error);
      alert('حدث خطأ أثناء حفظ الكتاب الوارد في الخادم: ' + error.message);
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
        await logActivity('edit_reception', { note: `تعديل سجل استقبال: ${normalized.subject || normalized.requestNo || normalized.id}`, sourceEntity: 'reception', sourceId: normalized.id });
      } else {
        itemsReception.unshift(normalized);
        await logActivity('add_reception', { note: `إضافة سجل استقبال: ${normalized.subject || normalized.requestNo || normalized.id}`, sourceEntity: 'reception', sourceId: normalized.id });
      }
      saveLocalBackup(LOCAL_STORAGE_KEYS.reception, itemsReception);
      renderReception(searchInputReception.value);
      clearReceptionForm();
    } catch (error) {
      console.error('Reception save failed', error);
      alert('حدث خطأ أثناء حفظ سجل الاستقبال في الخادم: ' + error.message);
    }
  });

  // Archive form submit (saved locally if no server)
  if (archiveForm) {
    archiveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formEl = document.getElementById('archiveForm');
      if (!formEl) return;
      const payload = {
        projectName: document.getElementById('archiveProjectName') ? document.getElementById('archiveProjectName').value : '',
        createDate: document.getElementById('archiveCreateDate') ? document.getElementById('archiveCreateDate').value : '',
        status: 'قيد العمل',
        studies: {
          cost: document.getElementById('studies_cost') ? document.getElementById('studies_cost').value : '',
          team: document.getElementById('studies_team') ? document.getElementById('studies_team').value : '',
          notes: document.getElementById('studies_notes') ? document.getElementById('studies_notes').value : '',
          outNo: document.getElementById('studies_outNo') ? document.getElementById('studies_outNo').value : '',
          outDate: document.getElementById('studies_outDate') ? document.getElementById('studies_outDate').value : '',
          expected: { value: document.getElementById('studies_expectedValue') ? document.getElementById('studies_expectedValue').value : '', unit: document.getElementById('studies_expectedUnit') ? document.getElementById('studies_expectedUnit').value : 'days' },
          enteredBy: document.getElementById('studies_enteredBy') ? document.getElementById('studies_enteredBy').value : ''
        },
        tech: {
          inDate: document.getElementById('tech_inDate') ? document.getElementById('tech_inDate').value : '',
          inNo: document.getElementById('tech_inNo') ? document.getElementById('tech_inNo').value : '',
          notes: document.getElementById('tech_notes') ? document.getElementById('tech_notes').value : '',
          outDate: document.getElementById('tech_outDate') ? document.getElementById('tech_outDate').value : '',
          outNo: document.getElementById('tech_outNo') ? document.getElementById('tech_outNo').value : '',
          expected: { value: document.getElementById('tech_expectedValue') ? document.getElementById('tech_expectedValue').value : '', unit: document.getElementById('tech_expectedUnit') ? document.getElementById('tech_expectedUnit').value : 'days' },
          enteredBy: document.getElementById('tech_enteredBy') ? document.getElementById('tech_enteredBy').value : ''
        },
        gov: {
          inDate: document.getElementById('gov_inDate') ? document.getElementById('gov_inDate').value : '',
          inNo: document.getElementById('gov_inNo') ? document.getElementById('gov_inNo').value : '',
          notes: document.getElementById('gov_notes') ? document.getElementById('gov_notes').value : '',
          expected: { value: document.getElementById('gov_expectedValue') ? document.getElementById('gov_expectedValue').value : '', unit: document.getElementById('gov_expectedUnit') ? document.getElementById('gov_expectedUnit').value : 'days' },
          enteredBy: document.getElementById('gov_enteredBy') ? document.getElementById('gov_enteredBy').value : ''
        },
        legal: {
          inDate: document.getElementById('legal_inDate') ? document.getElementById('legal_inDate').value : '',
          inNo: document.getElementById('legal_inNo') ? document.getElementById('legal_inNo').value : '',
          notes: document.getElementById('legal_notes') ? document.getElementById('legal_notes').value : '',
          outDate: document.getElementById('legal_outDate') ? document.getElementById('legal_outDate').value : '',
          outNo: document.getElementById('legal_outNo') ? document.getElementById('legal_outNo').value : '',
          expected: { value: document.getElementById('legal_expectedValue') ? document.getElementById('legal_expectedValue').value : '', unit: document.getElementById('legal_expectedUnit') ? document.getElementById('legal_expectedUnit').value : 'days' },
          enteredBy: document.getElementById('legal_enteredBy') ? document.getElementById('legal_enteredBy').value : ''
        },
        gov2: {
          outDate: document.getElementById('gov2_outDate') ? document.getElementById('gov2_outDate').value : '',
          outNo: document.getElementById('gov2_outNo') ? document.getElementById('gov2_outNo').value : '',
          notes: document.getElementById('gov2_notes') ? document.getElementById('gov2_notes').value : '',
          inDate: document.getElementById('gov2_inDate') ? document.getElementById('gov2_inDate').value : '',
          inNo: document.getElementById('gov2_inNo') ? document.getElementById('gov2_inNo').value : '',
          enteredBy: document.getElementById('gov2_enteredBy') ? document.getElementById('gov2_enteredBy').value : ''
        }
      };
      // attachments per section
      const attachmentsStore = formEl._attachments || {};
      payload.attachments = attachmentsStore;
      const departmentEl = document.getElementById('archiveDepartment');
      const inferredDepartment = (departmentEl && departmentEl.value && String(departmentEl.value).trim()) || inferArchiveDepartmentFromItem({ studies: payload.studies, tech: payload.tech, gov: payload.gov, legal: payload.legal, gov2: payload.gov2 });
      if (departmentEl && !departmentEl.value && inferredDepartment) departmentEl.value = inferredDepartment;
      const candidateStatusItem = { ...payload, currentDepartment: inferredDepartment || '', status: payload.status };
      const derivedStatusInfo = window.ArchiveTransferState && typeof window.ArchiveTransferState.deriveArchiveStatusInfo === 'function'
        ? window.ArchiveTransferState.deriveArchiveStatusInfo(candidateStatusItem, Date.now())
        : { base: 'تم الاستلام', department: inferredDepartment || '' };
      payload.status = buildArchiveStatusValue(derivedStatusInfo.base || 'تم الاستلام', derivedStatusInfo.department || inferredDepartment || '');
      // mark record type for archives
      payload.record_type = 'اضابير';
      payload.recordCategory = 'DOSSIER';
      // require at least one duration value before saving
      const durFields = ['studies_expectedValue','tech_expectedValue','gov_expectedValue','legal_expectedValue','gov2_expectedValue'];
      const hasDuration = durFields.some(id => { const el = document.getElementById(id); return el && String(el.value || '').trim() !== ''; });
      if (!hasDuration) { alert('يجب إدخال قيمة واحدة على الأقل لحقل المدة الزمنية قبل حفظ الأضبارة.'); return; }
      try {
        const editingId = formEl.dataset.editingId;
        if (editingId) {
          // For edits: set per-section savedAt when that section is being filled for the first time
          try {
            const existing = itemsArchive.find(it => it.id === Number(editingId));
            const nowIso = new Date().toISOString();
            ['studies','tech','gov','legal','gov2'].forEach(sec => {
              const val = payload[sec] && payload[sec].expected && String(payload[sec].expected.value || '').trim();
              if (val) {
                if (!existing || !(existing[sec] && existing[sec].savedAt)) {
                  payload[sec] = payload[sec] || {};
                  payload[sec].savedAt = nowIso;
                }
              }
            });
          } catch (e) {}
          itemsArchive = itemsArchive.map(it => it.id === Number(editingId) ? ({ ...it, ...payload, attachments: payload.attachments }) : it);
          // ensure edit button is enabled for saved record
          const editBtn = document.getElementById('editArchiveBtn'); if (editBtn) editBtn.disabled = false;
          // Apply duration lock timers based on updated record's per-section savedAt
          try {
            const updated = itemsArchive.find(it => it.id === Number(editingId));
            if (updated) enforceDurationLockForForm(formEl, updated);
          } catch (e) {}
        } else {
          const id = Date.now();
          const savedAt = new Date().toISOString();
          // ensure createDate is set to saved date if empty
          if (!payload.createDate) payload.createDate = savedAt.slice(0,10);
          // For creation: set per-section savedAt for any section that has an expected value
          try {
            ['studies','tech','gov','legal','gov2'].forEach(sec => {
              const val = payload[sec] && payload[sec].expected && String(payload[sec].expected.value || '').trim();
              if (val) {
                payload[sec] = payload[sec] || {};
                payload[sec].savedAt = savedAt;
              }
            });
          } catch (e) {}
          const record = { id, ...payload, attachments: payload.attachments, savedAt };
          itemsArchive.unshift(record);
          // mark the form as editing this newly created record
          formEl.dataset.editingId = id;
          // set duration lock timer for this newly saved record (pass full record so per-section savedAt is used)
          enforceDurationLockForForm(formEl, record);
          // mark the form as editing this newly created record
          const editBtn = document.getElementById('editArchiveBtn'); if (editBtn) editBtn.disabled = false;
        }
        try { syncArchiveStatuses(); } catch (e) {}
        saveLocalBackup(LOCAL_STORAGE_KEYS.archive, itemsArchive);
        renderArchive();
        updateDashboardStats();
        try { if (archivesLateView && archivesLateView.style.display !== 'none') renderArchiveLate(); } catch (e) {}
        // after save: display the archives list view only
        const view = document.getElementById('archiveNewView'); if (view) view.style.display = 'none';
        const cards = document.querySelector('.archives-cards'); if (cards) cards.style.display = 'none';
        const listView = document.getElementById('archivesListView'); if (listView) listView.style.display = '';
        // ensure archive tab is visible (if tabs logic exists, mimic selecting it)
        try { const archiveTab = document.querySelector('.tab[data-view="archives"]'); if (archiveTab) archiveTab.classList.add('active'); } catch (e) {}
      } catch (err) {
        console.error('Archive save failed', err);
        alert('فشل حفظ الأضبارة: ' + (err && err.message ? err.message : 'خطأ غير معروف'));
      }
    });
  }

  // Search
  // Initialize archive info controls: default date, default status, and keep display in sync
  try {
    const statusSelectInit = document.getElementById('archiveStatus');
    const statusDisplayInit = document.getElementById('archiveStatusDisplay');
    const createDateInit = document.getElementById('archiveCreateDate');
    // helper for today's date
    const today = () => new Date().toISOString().slice(0,10);
    // set all date inputs inside the archive view to today if empty
    const archiveView = document.getElementById('archiveNewView');
    if (archiveView) {
      const dateInputs = archiveView.querySelectorAll('input[type="date"]');
      dateInputs.forEach(d => { if (!d.value || String(d.value).trim() === '') d.value = today(); });
    } else {
      if (createDateInit && (!createDateInit.value || String(createDateInit.value).trim() === '')) createDateInit.value = today();
    }

    if (statusSelectInit) {
      if (!statusSelectInit.value || String(statusSelectInit.value).trim() === '') statusSelectInit.value = 'تم الاستلام';
      const departmentInputInit = document.getElementById('archiveDepartment');
      const syncStatusDisplay = () => {
        const baseStatus = String(statusSelectInit.value || 'تم الاستلام').trim();
        if (statusDisplayInit) statusDisplayInit.value = buildArchiveStatusValue(baseStatus, departmentInputInit ? departmentInputInit.value : '');
      };
      syncStatusDisplay();
      if (departmentInputInit) departmentInputInit.addEventListener('input', syncStatusDisplay);
    }
  } catch (e) { console.warn('Archive info init failed', e); }
  searchInput.addEventListener('input', () => { currentPageOutgoing = 1; render(searchInput.value); });
  searchInputIncoming.addEventListener('input', () => { currentPageIncoming = 1; renderIncoming(searchInputIncoming.value); });
  searchInputReception.addEventListener('input', () => { currentPageReception = 1; renderReception(searchInputReception.value); });

  const clearDatabaseAndResetState = async () => {
    try {
      await fetchJson(`${API_BASE}/system/clear-database`, { method: 'POST' });

      items = [];
      itemsIncoming = [];
      itemsReception = [];
      itemsCircleMail = [];
      histories = [];
      itemsArchive = [];

      saveLocalBackup(LOCAL_STORAGE_KEYS.outgoing, []);
      saveLocalBackup(LOCAL_STORAGE_KEYS.incoming, []);
      saveLocalBackup(LOCAL_STORAGE_KEYS.reception, []);
      saveLocalBackup(LOCAL_STORAGE_KEYS.archive, []);

      render(); renderIncoming(); renderReception(); renderArchive(); renderCircles(); renderTrash();
      updateDashboardStats();

      alert('تم مسح كافة البيانات بنجاح من الخادم والمتصفح.');
    } catch (err) {
      console.error('Database clearing failed:', err);
      alert('حدث خطأ أثناء محاولة مسح البيانات: ' + err.message);
    }
  };

  // منطق مسح قاعدة البيانات الشامل
  if (clearDbBtn) {
    clearDbBtn.addEventListener('click', async () => {
      const isConfirmed = confirm('تحذير: هل أنت متأكد من رغبتك في مسح كافة بيانات النظام؟ (الصادر، الوارد، الاستقبال، بريد الدوائر، والسجلات). لا يمكن التراجع عن هذا الإجراء.');
      if (!isConfirmed) return;

      const reauthConfirmed = confirm('لأمانك، ستحتاج إلى تسجيل الدخول مرة أخرى قبل تنفيذ عملية المسح. هل تريد المتابعة؟');
      if (!reauthConfirmed) return;

      pendingDatabaseClear = true;
      sessionStorage.removeItem('diwan_user');
      currentUser = null;

      if (userInfoEl) userInfoEl.style.display = 'none';
      if (loggedInUserEl) loggedInUserEl.textContent = '';
      if (loginModal) loginModal.classList.remove('hidden');
      const mainEl = document.querySelector('main'); if (mainEl) mainEl.style.display = 'none';
      const headerEl = document.querySelector('header'); if (headerEl) headerEl.style.display = 'none';

      alert('يرجى تسجيل الدخول مرة أخرى للمتابعة، وسيتم تنفيذ عملية مسح قاعدة البيانات فور نجاح المصادقة.');
    });
  }

  // منطق النسخ الاحتياطي والاستعادة
  if (backupDbBtn) {
    backupDbBtn.addEventListener('click', async () => {
      try {
        alert('جاري إنشاء النسخة الاحتياطية، قد يستغرق الأمر بعض الوقت...');
        const backupData = await fetchJson(`${API_BASE}/system/backup-database`);
        const backupJson = JSON.stringify(backupData, null, 2);
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diwan_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('تم إنشاء النسخة الاحتياطية بنجاح وتنزيلها.');
      } catch (err) {
        console.error('Backup failed:', err);
        alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية: ' + err.message);
      }
    });
  }

  if (restoreDbBtn) {
    restoreDbBtn.addEventListener('click', () => {
      if (importBackupInput) importBackupInput.click();
    });
  }

  if (importBackupInput) {
    importBackupInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isConfirmed = confirm('تحذير: هل أنت متأكد من رغبتك في استعادة قاعدة البيانات؟ سيؤدي هذا إلى مسح كافة البيانات الحالية واستبدالها ببيانات النسخة الاحتياطية. لا يمكن التراجع عن هذا الإجراء.');
      if (!isConfirmed) {
        importBackupInput.value = ''; // Clear the input
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target.result);
          alert('جاري استعادة قاعدة البيانات، قد يستغرق الأمر بعض الوقت...');
          await fetchJson(`${API_BASE}/system/restore-database`, {
            method: 'POST',
            body: JSON.stringify(backupData),
          });

          // بعد الاستعادة، أعد تحميل جميع البيانات وتحديث الواجهة
          await load(); render();
          await loadIncoming(); renderIncoming();
          await loadReception(); renderReception();
          await loadCircleMails(); renderCircles();
          await loadHistories();
          updateDashboardStats();

          alert('تم استعادة قاعدة البيانات بنجاح.');
        } catch (err) {
          console.error('Restore failed:', err);
          alert('حدث خطأ أثناء استعادة النسخة الاحتياطية: ' + err.message);
        } finally {
          importBackupInput.value = ''; // Clear the input
        }
      };
      reader.onerror = (err) => {
        console.error('File read error:', err);
        alert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      };
      reader.readAsText(file);
    });
  }

  // منطق أزرار التنقل لأعلى وأسفل الصفحة
  const scrollToTopBtn = document.getElementById('scrollToTopBtn');
  const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');

  const toggleScrollButtons = () => {
    if (scrollToTopBtn) {
      // إظهار زر "أعلى" إذا كان المستخدم قد مرر أكثر من 200 بكسل
      if (window.scrollY > 200) {
        scrollToTopBtn.style.display = 'block';
      } else {
        scrollToTopBtn.style.display = 'none';
      }
    }

    if (scrollToBottomBtn) {
      // إظهار زر "أسفل" إذا لم يكن المستخدم في نهاية الصفحة (مع هامش 200 بكسل)
      if ((window.innerHeight + window.scrollY) < document.body.offsetHeight - 200) {
        scrollToBottomBtn.style.display = 'block';
      } else {
        scrollToBottomBtn.style.display = 'none';
      }
    }
  };

  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener('click', () => { window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' }); });
  }

  // إضافة مستمع حدث للتمرير لتحديث حالة الأزرار
  window.addEventListener('scroll', toggleScrollButtons);
  // استدعاء الدالة مرة واحدة عند التحميل لضبط الحالة الأولية للأزرار
  toggleScrollButtons();

  // --- Users & Permissions Logic ---
  let users = [];

  const normalizeRoleForUser = (user) => {
    if (!user) return null;
    return user.username === 'admin' && user.role === 'مشرف' ? 'مشرف عام' : user.role;
  };
  const isSupervisorRole = (userOrRole) => {
    const role = typeof userOrRole === 'string' ? userOrRole : normalizeRoleForUser(userOrRole);
    return role === 'مشرف عام' || role === 'مشرف';
  };
  const canManageSensitiveActions = () => isSupervisorRole(currentUser);
  const getSensitiveActionTitle = (allow) => allow ? '' : 'هذه العملية متاحة فقط للمشرف العام والمشرف';
  const getAllowedTabsForRole = (userOrRole) => {
    const role = typeof userOrRole === 'string' ? userOrRole : normalizeRoleForUser(userOrRole);
    if (role === 'مشرف عام') return ['outgoing', 'incoming', 'reception', 'search', 'archives', 'circles', 'trash', 'users', 'settings'];
    if (role === 'مشرف') return ['outgoing', 'incoming', 'reception', 'search', 'archives', 'circles', 'trash'];
    if (role === 'ديوان') return ['outgoing', 'incoming', 'reception', 'search'];
    if (role === 'اضابير') return ['archives'];
    if (circles.includes(role)) return ['circles'];
    return [];
  };

  const renderUserForm = (user = null) => {
    if (!addUserForm) return;
    const roles = ['مشرف عام', 'مشرف', 'ديوان', 'اضابير', ...circles];
    addUserForm.innerHTML = `
      <input type="hidden" id="userId" value="${user ? user.id : ''}">
      <div class="form-row">
        <label for="newUsername">اسم المستخدم</label>
        <input type="text" id="newUsername" required value="${user ? user.username : ''}">
      </div>
      <div class="form-row">
        <label for="newPassword">${user ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label>
        <input type="password" id="newPassword" ${user ? '' : 'required'}>
      </div>
      <div class="form-row">
        <label for="newRole">الصلاحية</label>
        <select id="newRole">
          ${roles.map(r => `<option value="${r}" ${user && user.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn primary">${user ? 'حفظ التعديلات' : 'إضافة مستخدم'}</button>
      ${user ? '<button type="button" id="cancelUserEdit" class="btn">إلغاء التعديل</button>' : ''}
    `;
    if (user) {
      document.getElementById('cancelUserEdit').addEventListener('click', () => renderUserForm());
    }
  };

  const renderUsers = () => {
    if (!usersTableContainer) return;
    usersTableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>اسم المستخدم</th>
            <th>الصلاحية</th>
            <th style="width: 400px;">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.username}</td>
              <td>${user.role}</td>
              <td class="actions">
                <button class="btn" data-action="edit-user" data-id="${user.id}">تعديل</button>
                <button class="btn" data-action="delete-user" data-id="${user.id}" ${user.username === 'admin' ? 'disabled' : ''}>حذف</button>
                <button class="btn secondary" data-action="activity-log" data-id="${user.id}">سجل النشاطات</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const loadUsers = async () => {
    const effectiveRole = normalizeRoleForUser(currentUser) || currentUser?.role;
    if (currentUser && effectiveRole !== 'مشرف عام') return;
    try {
      users = await fetchJson(`${API_BASE}/users`);
      renderUsers();
      renderUserForm(); // Render the add form initially
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  if (usersTableContainer) {
    usersTableContainer.addEventListener('click', async (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const id = target.dataset.id;
      const action = target.dataset.action;
      const user = users.find(u => u.id == id);
      if (!user) return;

      if (action === 'delete-user') {
        if (confirm(`هل أنت متأكد من حذف المستخدم "${user.username}"؟`)) {
          try {
            await deleteFromServer(`/api/users/${id}`);
            await loadUsers();
            alert('تم حذف المستخدم.');
          } catch (err) { alert('فشل حذف المستخدم: ' + err.message); }
        }
      } else if (action === 'edit-user') {
        renderUserForm(user);
        addUserForm.scrollIntoView({ behavior: 'smooth' });
      } else if (action === 'activity-log') {
        showActivityLog(user);
      }
    });
  }

  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('userId').value;
      const username = document.getElementById('newUsername').value;
      const password = document.getElementById('newPassword').value;
      const role = document.getElementById('newRole').value;

      const payload = { username, role };
      if (password) {
        payload.password = password;
      }

      try {
        if (id) { // Editing
          await saveToServer(`/api/users/${id}`, payload, 'PUT');
          alert('تم تحديث المستخدم بنجاح.');
        } else { // Adding
          await saveToServer('/api/users', payload, 'POST');
          alert('تمت إضافة المستخدم بنجاح.');
        }
        addUserForm.reset();
        renderUserForm();
        await loadUsers();
      } catch (err) {
        alert('فشل الإجراء: ' + err.message);
      }
    });
  }

  // --- Login and Permissions Enforcement ---
  const applyPermissions = () => {
    if (!currentUser) return;
    const allowedTabs = {};
    const role = normalizeRoleForUser(currentUser) || currentUser.role;
    if (isSupervisorRole(currentUser)) {
      allowedTabs[role] = getAllowedTabsForRole(currentUser);
    } else {
      allowedTabs[role] = getAllowedTabsForRole(currentUser);
    }

    // For department roles, they can only see 'circles'
    if (circles.includes(role)) {
      allowedTabs[role] = ['circles'];
    }

    const userAllowed = allowedTabs[role] || [];
    let firstVisibleTab = null;

    tabs.forEach(tab => {
      const tabKey = tab.dataset.tab;
      if (userAllowed.includes(tabKey)) {
        tab.style.display = '';
        if (!firstVisibleTab) firstVisibleTab = tab;
      } else {
        tab.style.display = 'none';
      }
    });

    // Hide dashboard cards for tabs the user is not allowed to open
    document.querySelectorAll('.dashboard-card').forEach(card => {
      const cardKey = card.getAttribute('data-tab');
      if (cardKey && !userAllowed.includes(cardKey)) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
      }
    });

    // Hide stats for users without supervisor/diwan access
    if (!isSupervisorRole(currentUser) && currentUser.role !== 'ديوان') {
      if (statsSection) statsSection.style.display = 'none';
    }

    // Do not auto-open a tab; keep the dashboard home visible until the user chooses a tab or card.
  };

  const handleLogin = async (username, password) => {
    // Try server authentication, fall back to local dev auth if server unavailable
    try {
      const user = await fetchJson(`${API_BASE}/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      currentUser = { ...user, role: normalizeRoleForUser(user) || user.role };
      sessionStorage.setItem('diwan_user', JSON.stringify(currentUser));
      await logActivity('login', { note: `تسجيل دخول المستخدم ${user.username}` });
      loginModal.classList.add('hidden');
      document.querySelector('main').style.display = '';
      document.querySelector('header').style.display = '';
      // Show user info
      if (userInfoEl) userInfoEl.style.display = 'flex';
      if (loggedInUserEl) loggedInUserEl.textContent = `أهلاً، ${user.username}`;

      const shouldClearDatabaseAfterLogin = pendingDatabaseClear;
      pendingDatabaseClear = false;
      if (shouldClearDatabaseAfterLogin) {
        await clearDatabaseAndResetState();
      }

      // Load all data first
      await Promise.all([
        load(),
        loadIncoming(),
        loadReception(),
        loadCircleMails(),
        loadArchive(),
        loadHistories(),
        loadTrash(),
        loadUsers()
      ]);

      // Then render and apply permissions
      applyPermissions();
      render();
      renderIncoming();
      renderReception();
      renderArchive();
      renderCircles();
      updateDashboardStats();
      
      await checkDelays();
      setInterval(checkDelays, 60 * 60 * 1000);

    } catch (err) {
      console.warn('Login error, attempting local fallback', err);
      // If server rejects credentials, show server error. If server is unreachable, allow local fallback for development.
      const msg = err && err.message ? err.message : String(err);
      const isNetworkOrServerError = /Failed to fetch|NetworkError|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg);

      // If server rejected credentials (authentication error), allow local fallback for testing.
      const isAuthErrorFromServer = /اسم المستخدم|كلمة المرور|غير صحيحة|غير موجود|401|unauthor/i.test(msg.toLowerCase());

      if (!isNetworkOrServerError && !isAuthErrorFromServer) {
        // Non-network and non-auth errors — show original message
        try {
          const p = JSON.parse(msg);
          alert('فشل تسجيل الدخول: ' + (p.error || p.message || msg));
        } catch (e) {
          alert('فشل تسجيل الدخول: ' + msg);
        }
        return;
      }

      // Local fallback users for offline/dev testing or when server says credentials are wrong
      const localUsers = [
        { username: 'admin', password: 'admin', role: 'مشرف عام' },
        { username: 'user', password: 'user', role: 'مستخدم' }
      ];
      const match = localUsers.find(u => u.username === username && u.password === password);
      if (match) {
        // Use local user as fallback
        currentUser = { username: match.username, role: normalizeRoleForUser(match) || match.role };
        await logActivity('login', { note: `تسجيل دخول تجريبي للمستخدم ${match.username}` });
      } else {
        // If server said credentials wrong but user still wants to proceed, create a trial local user
        if (isAuthErrorFromServer || isNetworkOrServerError) {
          // create a temporary local session with the provided username
          currentUser = { username: username || 'local-user', role: 'مستخدم (تجريبي)' };
          await logActivity('login', { note: `تسجيل دخول تجريبي للمستخدم ${currentUser.username}` });
          alert('تم تسجيل دخول تجريبي محلياً باسم: ' + currentUser.username + ' (لا يعتمد على الخادم)');
        } else {
          alert('فشل تسجيل الدخول: اسم المستخدم أو كلمة المرور غير صحيحة (الخادم غير متوفر ومطابقة محلية فشلت)');
          return;
        }
      }
      sessionStorage.setItem('diwan_user', JSON.stringify(currentUser));
      loginModal.classList.add('hidden');
      document.querySelector('main').style.display = '';
      document.querySelector('header').style.display = '';
      if (userInfoEl) userInfoEl.style.display = 'flex';
      if (loggedInUserEl) loggedInUserEl.textContent = `أهلاً، ${currentUser.username}`;

      // Load local data seeds and render
      items = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.outgoing, localSeedOutgoing);
      itemsIncoming = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.incoming, localSeedIncoming);
      itemsReception = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.reception, localSeedReception);
      itemsArchive = useLocalBackupIfEmpty([], LOCAL_STORAGE_KEYS.archive, []);
      render(); renderIncoming(); renderReception(); renderArchive(); renderCircles(); renderTrash(); updateDashboardStats();
    }
  };

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      handleLogin(username, password);
    });
  }

  // Hard refresh button: reload UI while preserving session (do not clear sessionStorage)
  const hardRefreshBtn = document.getElementById('hardRefreshBtn');
  if (hardRefreshBtn) {
    hardRefreshBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        // Save minimal UI state if needed
        const preserved = {
          user: sessionStorage.getItem('diwan_user') || null,
          lastTab: document.querySelector('.tab.active') ? document.querySelector('.tab.active').dataset.tab : null
        };
        localStorage.setItem('diwan_ui_preserve', JSON.stringify(preserved));
        // reload the page
        window.location.reload();
      } catch (e) { window.location.reload(); }
    });
  }

  // On load, if preserved UI state exists, re-apply it after login
  try {
    const preservedRaw = localStorage.getItem('diwan_ui_preserve');
    if (preservedRaw) {
      const preserved = JSON.parse(preservedRaw);
      if (preserved && preserved.user) {
        try { sessionStorage.setItem('diwan_user', preserved.user); } catch (e) {}
      }
      // remove preserve key once consumed
      localStorage.removeItem('diwan_ui_preserve');
    }
  } catch (e) {}

  // --- Activity Log Logic ---
  const showActivityLog = async (user) => {
    if (!activityLogModal || !activityLogBody || !activityLogTitle) return;

    activityLogTitle.textContent = `سجل نشاطات المستخدم: ${user.username}`;
    activityLogBody.innerHTML = '<div>جاري تحميل السجل...</div>';
    activityLogModal.classList.remove('hidden');

    try {
      // Fetch history entries made by this user and filter defensively in case the server returns more data.
      const userHistoriesRaw = await fetchJson(`${API_BASE}/history?actor=${encodeURIComponent(user.username)}`);
      const userHistories = Array.isArray(userHistoriesRaw)
        ? userHistoriesRaw.filter(h => String(h.actor || '') === String(user.username))
        : [];

      if (!userHistories.length) {
        activityLogBody.innerHTML = '<div class="search-no-results">لا توجد نشاطات مسجلة لهذا المستخدم.</div>';
        return;
      }

      activityLogBody.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>النشاط</th>
                <th>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              ${userHistories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(h => `
                <tr>
                  <td>${new Date(h.createdAt).toLocaleString('ar-SY')}</td>
                  <td>${h.action}</td>
                  <td>${h.note || (h.fromCircle ? `من ${h.fromCircle} إلى ${h.toCircle}` : '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      activityLogBody.innerHTML = `<div class="search-no-results">فشل تحميل سجل النشاطات: ${err.message}</div>`;
    }
  };

  if (closeActivityLogModal) {
    closeActivityLogModal.addEventListener('click', () => activityLogModal.classList.add('hidden'));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
        try { await logActivity('logout', { note: `تسجيل خروج المستخدم ${getCurrentActor()}` }); } catch (e) {}
        sessionStorage.removeItem('diwan_user');
        window.location.reload();
      }
    });
  }

  // --- Initial Load ---
  const checkSession = () => {
    // If a session user exists in sessionStorage, restore session automatically
    try {
      const raw = sessionStorage.getItem('diwan_user');
      if (raw) {
        const user = JSON.parse(raw);
        currentUser = { ...user, role: normalizeRoleForUser(user) || user.role };
        // show main UI
        loginModal.classList.add('hidden');
        document.querySelector('main').style.display = '';
        document.querySelector('header').style.display = '';
        if (userInfoEl) userInfoEl.style.display = 'flex';
        if (loggedInUserEl) loggedInUserEl.textContent = `أهلاً، ${user.username}`;
        // Load data and initialize UI
        (async () => {
          await Promise.all([load(), loadIncoming(), loadReception(), loadCircleMails(), loadArchive(), loadHistories(), loadTrash(), loadUsers()]);
          applyPermissions(); render(); renderIncoming(); renderReception(); renderArchive(); renderCircles(); renderTrash(); updateDashboardStats();
          try { await checkDelays(); } catch(e){}
          setInterval(checkDelays, 60 * 60 * 1000);
        })();
        return;
      }
    } catch (e) { /* ignore parse errors and fall through to show login */ }
    loginModal.classList.remove('hidden');
    document.querySelector('main').style.display = 'none';
    document.querySelector('header').style.display = 'none';
  };

  checkSession();

});
