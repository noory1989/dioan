require('dotenv').config();
require('reflect-metadata');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const Busboy = require('busboy');
let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  // fallback shim using Node crypto (not bcrypt-compatible with existing hashes)
  console.warn('bcryptjs not installed — using lightweight shim for hashing (development only)');
  const crypto = require('crypto');
  bcrypt = {
    genSalt: async (rounds = 10) => crypto.randomBytes(16).toString('hex'),
    hash: async (password, salt) => {
      return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derived) => {
          if (err) return reject(err);
          resolve(salt + '$' + derived.toString('hex'));
        });
      });
    },
    compare: async (password, stored) => {
      try {
        if (!stored || stored.indexOf('$') === -1) return false;
        const [salt, hashHex] = stored.split('$');
        return new Promise((resolve, reject) => {
          crypto.scrypt(password, salt, 64, (err, derived) => {
            if (err) return reject(err);
            resolve(derived.toString('hex') === hashHex);
          });
        });
      } catch (e) { return false; }
    }
  };
}

const { AppDataSource } = require('./src/data-source');
const cron = require('node-cron');
const app = express();
const PORT = process.env.PORT || 3000;
// Upload size limit in megabytes. Set to 0 for unlimited.
const UPLOAD_MAX_MB = parseInt(process.env.UPLOAD_MAX_MB || '100', 10); // رفع الحد إلى 100 ميجا
const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB > 0 ? UPLOAD_MAX_MB * 1024 * 1024 : null;

// تطبيق الحد على طلبات JSON (Base64)
app.use(express.json({ limit: `${UPLOAD_MAX_MB}mb` }));
app.use(express.urlencoded({ limit: `${UPLOAD_MAX_MB}mb`, extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Allow simple CORS for API routes (so UI opened via file:// can call API)
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Ensure uploads directory exists and serve it statically
const uploadDir = path.join(__dirname, 'uploads');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { /* ignore */ }
app.use('/uploads', express.static(uploadDir));

// Note: using Busboy for streaming uploads (no size/type limits)

// Log incoming requests for debugging transfer route issues
app.use((req, res, next) => {
  try { console.log('HTTP', req.method, req.originalUrl); } catch (e) {}
  next();
});

// Normalize duplicate slashes in URL paths (e.g. /api//circlemail -> /api/circlemail)
app.use((req, res, next) => {
  if (req.url && req.url.includes('//')) {
    try { console.log('Normalizing URL from', req.url); } catch (e) {}
    req.url = req.url.replace(/\/\/{2,}/g, '/');
    try { console.log('Normalized URL to', req.url); } catch (e) {}
  }
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let dbReady = false;
const ensureDb = (res) => {
  if (!dbReady) {
    res.status(503).json({ error: 'Database is not initialized' });
    return false;
  }
  return true;
};

const normalizePayload = (payload) => ({
  ...payload,
  attachments: Array.isArray(payload && payload.attachments)
    ? JSON.stringify(payload.attachments)
    : payload && payload.attachments
      ? payload.attachments
      : JSON.stringify([]),
});

const computeDeadlineAt = (expectedDurationDays, startAt = new Date()) => {
  if (expectedDurationDays === undefined || expectedDurationDays === null) return null;
  const days = Number(expectedDurationDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  const startDate = startAt instanceof Date ? startAt : new Date(startAt);
  if (Number.isNaN(startDate.getTime())) return null;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
};

const parseExpectedDurationDays = (body = {}) => {
  if (body.expected_duration_days !== undefined && body.expected_duration_days !== null) return Number(body.expected_duration_days);
  if (body.expectedDurationDays !== undefined && body.expectedDurationDays !== null) return Number(body.expectedDurationDays);
  if (body.expected_duration_minutes !== undefined && body.expected_duration_minutes !== null) return Number(body.expected_duration_minutes) / 1440;
  if (body.expectedDurationMinutes !== undefined && body.expectedDurationMinutes !== null) return Number(body.expectedDurationMinutes) / 1440;
  return null;
};

const buildCircleMailWorkflowValues = (body = {}) => {
  const expectedDurationDays = parseExpectedDurationDays(body);
  if (!expectedDurationDays) return {};
  const durationStartedAt = body.durationStartedAt || body.duration_started_at || new Date();
  const expectedDurationMinutes = (body.expectedDurationMinutes !== undefined && body.expectedDurationMinutes !== null)
    ? Number(body.expectedDurationMinutes)
    : (body.expected_duration_minutes !== undefined && body.expected_duration_minutes !== null)
      ? Number(body.expected_duration_minutes)
      : Math.round(expectedDurationDays * 24 * 60);
  return {
    expectedDurationDays,
    expectedDurationMinutes,
    durationStartedAt,
    deadlineAt: computeDeadlineAt(expectedDurationDays, durationStartedAt),
    isOverdue: false,
  };
};

// Normalize status values to application canonical Arabic labels
const normalizeStatusValue = (s) => {
  if (s === undefined || s === null) return 'قيد العمل';
  try {
    const v = String(s).trim().toLowerCase();
    if (!v) return 'قيد العمل';
    if (v === 'finished' || v === 'منتهي' || v === 'منتهية' || v === 'ended') return 'منتهية';
    if (v === 'overdue' || v.includes('تأخر') || v === 'متأخرة') return 'متأخرة';
    // treat 'open' and other values as in-progress
    return 'قيد العمل';
  } catch (e) { return 'قيد العمل'; }
};

const hasActiveOwnerForOverdue = (cm = {}) => {
  const hasDepartmentId = cm.currentDepartmentId !== undefined && cm.currentDepartmentId !== null && String(cm.currentDepartmentId).trim() !== '';
  const hasCircleName = Boolean(cm.circleName && String(cm.circleName).trim());
  return hasDepartmentId || hasCircleName;
};

const clearPreviousCircleMailWorkflowState = async (cmRepo, sourceEntity, sourceId, currentId) => {
  if (!cmRepo || !sourceEntity || sourceId === undefined || sourceId === null) return;
  await cmRepo.createQueryBuilder()
    .update()
    .set({
      currentDepartmentId: null,
      isTransferred: true,
      isOverdue: false,
      deadlineAt: null,
      durationStartedAt: null,
      expectedDurationDays: null,
      expectedDurationMinutes: null,
      lockedAt: null,
    })
    .where('sourceEntity = :sourceEntity AND ((sourceId = :sourceId) OR (:sourceId IS NULL AND sourceId IS NULL)) AND id != :currentId', {
      sourceEntity,
      sourceId: Number(sourceId),
      currentId,
    })
    .execute();
};

const getRepository = (entityName) => AppDataSource.getRepository(entityName);

const createEntityRoutes = (routeBase, entityName) => {
  const sanitizeRecord = (record) => {
    if (!record) return record;
    if (entityName !== 'CircleMail') return record;

    // Return a full representation of CircleMail so the client sees the same
    // data as the original source entity, including attachments and timestamps.
    const out = { ...record };
    // Return payload and attachments exactly as stored (verbatim)
    out.payload = record.payload;
    out.attachments = record.attachments;

    return out;
  };

  const sanitizeRecords = (records) => {
    if (!Array.isArray(records)) return records;
    return records.map(r => sanitizeRecord(r));
  };
  app.get(`/api/${routeBase}`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      let records = await getRepository(entityName).find({ order: { id: 'DESC' } });
      records = sanitizeRecords(records);
      res.json(records);
    } catch (error) {
      console.error(`Failed to fetch ${entityName}:`, error);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  app.post(`/api/${routeBase}`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      // Special handling for CircleMail: if client provided sourceEntity+sourceId+circleName,
      // copy the original source record exactly (payload, attachments, timestamps) into the circle mail.
      if (entityName === 'CircleMail') {
        const body = req.body || {};
        const hasKeys = body.sourceEntity && (body.sourceId !== undefined && body.sourceId !== null) && body.circleName;
        if (hasKeys) {
          // Map sourceEntity to repository name
          const key = String(body.sourceEntity).toLowerCase();
          let sourceRepoName = null;
          if (key.includes('outg') || key === 'outgoing') sourceRepoName = 'Outgoing';
          else if (key.includes('incom') || key === 'incoming') sourceRepoName = 'Incoming';
          else if (key.includes('recept') || key === 'reception') sourceRepoName = 'Reception';

          if (sourceRepoName) {
            const srcRepo = getRepository(sourceRepoName);
            const src = await srcRepo.findOneBy({ id: Number(body.sourceId) });
            if (src) {
              const cmRepo = getRepository(entityName);
              // copy the entire source record into payload as JSON so client can display all fields
              // avoid including DB-managed timestamps twice by keeping the source as-is
              const srcCopy = { ...src };
              // remove internal TypeORM metadata if present
              delete srcCopy.__proto__;
              // Copy recordCategory strictly from the original source when available.
              // Do NOT override or infer from other fields. If the source record contains
              // recordCategory (direct property or embedded in payload), use it as-is.
              // Only if the source lacks any recordCategory, fall back to a client-provided value.
              try {
                let foundCategory = null;
                if (src && src.recordCategory) {
                  foundCategory = src.recordCategory;
                } else if (src && src.payload) {
                  try {
                    const parsed = (typeof src.payload === 'string') ? JSON.parse(src.payload) : src.payload;
                    if (parsed && parsed.recordCategory) foundCategory = parsed.recordCategory;
                  } catch (e) { /* ignore malformed payload */ }
                }
                if (foundCategory) {
                  srcCopy.recordCategory = foundCategory;
                } else if (body.recordCategory) {
                  // only use client-sent recordCategory if the source has none
                  srcCopy.recordCategory = body.recordCategory;
                }
                // Do not infer from body.record_type or sourceEntity; do not force a default.
              } catch (e) {}
              // by default take attachments from the source record
              let attachmentsValue = src.attachments || null;
              // if client specified a fromCircle, prefer attachments saved in that circle's CircleMail
              try {
                if (body.fromCircle) {
                  // pick the latest matching CircleMail for that fromCircle
                  console.log('CircleMail create: looking for existing circle mail for fromCircle', { sourceEntity: body.sourceEntity, sourceId: body.sourceId, fromCircle: body.fromCircle });
                  const existingCm = await getRepository('CircleMail').find({ where: { sourceEntity: body.sourceEntity, sourceId: Number(body.sourceId), circleName: body.fromCircle }, order: { id: 'DESC' }, take: 1 });
                  console.log('CircleMail create: existingCm result count', Array.isArray(existingCm) ? existingCm.length : 0);
                  if (Array.isArray(existingCm) && existingCm.length) {
                    const cm = existingCm[0];
                    console.log('CircleMail create: found cm id', cm && cm.id, 'attachments present?', !!(cm && cm.attachments));
                    if (cm && cm.attachments) attachmentsValue = cm.attachments;
                    // If the existing circle mail has a payload with a recordCategory, prefer that
                    try {
                      if (cm && cm.payload) {
                        const cmPayload = (typeof cm.payload === 'string') ? JSON.parse(cm.payload) : cm.payload;
                        if (cmPayload && cmPayload.recordCategory) {
                          srcCopy.recordCategory = cmPayload.recordCategory;
                        }
                      }
                    } catch (e) { /* ignore malformed payload */ }
                  }
                }
              } catch (e) { /* ignore and fall back to src.attachments */ }

              const toSave = {
                sourceEntity: body.sourceEntity,
                sourceId: Number(body.sourceId),
                circleName: body.circleName,
                payload: typeof srcCopy === 'string' ? srcCopy : JSON.stringify(srcCopy), // store full source
                attachments: attachmentsValue,
                status: normalizeStatusValue(body.status || 'open'),
                alerted: body.alerted || false,
                // optional dossier/workflow fields
                  currentDepartmentId: body.currentDepartmentId || body.current_department_id || null,
                  ...buildCircleMailWorkflowValues(body),
                isLocked: (body.isLocked !== undefined ? body.isLocked : (body.is_locked !== undefined ? body.is_locked : false)),
                isTransferred: (body.isTransferred !== undefined ? body.isTransferred : false),
              };
              const created = cmRepo.create(toSave);
              console.log('CircleMail create: saving new circle mail with attachments type', typeof toSave.attachments);
              const saved = await cmRepo.save(created);
              console.log('CircleMail create: saved id', saved && saved.id, 'stored attachments present?', !!(saved && saved.attachments));

              // If this CircleMail was created as part of a transfer from another circle,
              // clear overdue state and deadline info on previous circle records for the same source.
              if (body.fromCircle && body.sourceEntity && (body.sourceId !== undefined && body.sourceId !== null)) {
                try {
                  await clearPreviousCircleMailWorkflowState(cmRepo, body.sourceEntity, body.sourceId, saved.id);
                } catch (e) {
                  console.warn('CircleMail transfer cleanup failed for previous circle records:', e);
                }
              }

              return res.json(sanitizeRecord(saved));
            }
          }
        }
        // fallback: if client sent a payload body, store that verbatim but ensure recordCategory is present
        if (req.body && req.body.payload) {
          const cmRepo = getRepository(entityName);
          // parse payload into object so we can inject recordCategory
          let payloadObj;
          try { payloadObj = (typeof req.body.payload === 'string') ? JSON.parse(req.body.payload) : (req.body.payload || {}); } catch (e) { payloadObj = { raw: req.body.payload }; }
          try {
            if (req.body.recordCategory) payloadObj.recordCategory = req.body.recordCategory;
            else if (req.body.record_type && !payloadObj.recordCategory) {
              const rt = String(req.body.record_type || '').toLowerCase();
              payloadObj.recordCategory = rt.includes('اضاب') ? 'DOSSIER' : 'MAIL';
            }
          } catch (e) {}
          const payloadValue = JSON.stringify(payloadObj);
          const attachmentsValue = req.body.attachments ? (typeof req.body.attachments === 'string' ? req.body.attachments : JSON.stringify(req.body.attachments)) : null;
          const toSave = {
            sourceEntity: req.body.sourceEntity || null,
            sourceId: (req.body.sourceId !== undefined && req.body.sourceId !== null) ? Number(req.body.sourceId) : null,
            circleName: req.body.circleName || (req.body.sourceEntity ? `دفعة-${Date.now()}` : 'عام'),
            payload: payloadValue,
            attachments: attachmentsValue,
            status: normalizeStatusValue(req.body.status || 'open'),
            alerted: req.body.alerted || false,
            currentDepartmentId: req.body.currentDepartmentId || req.body.current_department_id || null,
            ...buildCircleMailWorkflowValues(req.body),
            isLocked: (req.body.isLocked !== undefined ? req.body.isLocked : (req.body.is_locked !== undefined ? req.body.is_locked : false)),
            isTransferred: (req.body.isTransferred !== undefined ? req.body.isTransferred : false),
            deletedAt: req.body.deletedAt || req.body.deleted_at || null,
          };
          const created = cmRepo.create(toSave);
          const saved = await cmRepo.save(created);

          if (req.body && req.body.fromCircle && req.body.sourceEntity && (req.body.sourceId !== undefined && req.body.sourceId !== null)) {
            try {
              await clearPreviousCircleMailWorkflowState(cmRepo, req.body.sourceEntity, req.body.sourceId, saved.id);
            } catch (e) {
              console.warn('CircleMail transfer cleanup failed for previous circle records:', e);
            }
          }

          return res.json(sanitizeRecord(saved));
        }
        // default behaviour when no payload provided
        // If client provided recordCategory but no payload, attach it into payload to persist
        if (req.body && req.body.recordCategory && !req.body.payload) {
          req.body.payload = JSON.stringify({ recordCategory: req.body.recordCategory });
        } else if (req.body && req.body.record_type && !req.body.payload) {
          const rt = String(req.body.record_type || '').toLowerCase();
          req.body.payload = JSON.stringify({ recordCategory: rt.includes('اضاب') ? 'DOSSIER' : 'MAIL' });
        }
        const recordData = entityName === 'CircleMail'
          ? normalizePayload({ ...req.body, status: normalizeStatusValue(req.body.status || 'open'), ...buildCircleMailWorkflowValues(req.body) })
          : normalizePayload(req.body);
        const record = getRepository(entityName).create(recordData);
        const saved = await getRepository(entityName).save(record);

        if (entityName === 'CircleMail' && req.body && req.body.fromCircle && req.body.sourceEntity && (req.body.sourceId !== undefined && req.body.sourceId !== null)) {
          try {
            const cmRepo = getRepository('CircleMail');
            await clearPreviousCircleMailWorkflowState(cmRepo, req.body.sourceEntity, req.body.sourceId, saved.id);
          } catch (e) {
            console.warn('CircleMail transfer cleanup failed for previous circle records:', e);
          }
        }

        return res.json(sanitizeRecord(saved));
      }

      // Default behavior for other entities
      const record = getRepository(entityName).create(normalizePayload(req.body));
      const saved = await getRepository(entityName).save(record);
      res.json(sanitizeRecord(saved));
    } catch (error) {
      console.error(`Failed to create ${entityName}:`, error);
      res.status(500).json({ error: error && error.message ? error.message : 'Failed to create record' });
    }
  });

  app.put(`/api/${routeBase}/:id`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const id = Number(req.params.id);
      // For CircleMail, prevent accidental changes to recordCategory: preserve from existing record
      if (entityName === 'CircleMail') {
        const repo = getRepository(entityName);
        const existing = await repo.findOneBy({ id });
        if (!existing) return res.status(404).json({ error: 'Record not found' });
        // determine existing category from direct field or payload
        let existingCategory = null;
        try {
          if (existing.recordCategory) existingCategory = existing.recordCategory;
          else if (existing.payload) {
            const parsed = (typeof existing.payload === 'string') ? JSON.parse(existing.payload) : existing.payload;
            if (parsed && parsed.recordCategory) existingCategory = parsed.recordCategory;
          }
        } catch (e) { /* ignore parse errors */ }

        // Prepare update body while enforcing existingCategory if present
        const newBody = { ...req.body };
        if (existingCategory) {
          try {
            let payloadObj = newBody.payload ? (typeof newBody.payload === 'string' ? JSON.parse(newBody.payload) : newBody.payload) : {};
            payloadObj.recordCategory = existingCategory;
            newBody.payload = JSON.stringify(payloadObj);
          } catch (e) { /* ignore malformed payload */ }
          newBody.recordCategory = existingCategory;
        }

        const workflowValues = buildCircleMailWorkflowValues(newBody);
        const normalizedUpdates = normalizePayload({ ...newBody, ...workflowValues });
        await repo.update(id, normalizedUpdates);
        const updated = await repo.findOneBy({ id });
        return res.json(sanitizeRecord(updated));
      }

      await getRepository(entityName).update(id, normalizePayload(req.body));
      const updated = await getRepository(entityName).findOneBy({ id });
      if (!updated) return res.status(404).json({ error: 'Record not found' });
      res.json(sanitizeRecord(updated));
    } catch (error) {
      console.error(`Failed to update ${entityName}:`, error);
      res.status(500).json({ error: error && error.message ? error.message : 'Failed to update record' });
    }
  });

  app.delete(`/api/${routeBase}/:id`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const id = Number(req.params.id);
      await getRepository(entityName).delete(id);
      res.json({ deleted: true });
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error);
      res.status(500).json({ error: error && error.message ? error.message : 'Failed to delete record' });
    }
  });

  app.post(`/api/${routeBase}/bulk`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const payloads = Array.isArray(req.body) ? req.body : [];
      const created = await getRepository(entityName).save(
        payloads.map(normalizePayload)
      );
      res.json(sanitizeRecords(created));
    } catch (error) {
      console.error(`Failed to bulk insert ${entityName}:`, error);
      res.status(500).json({ error: error && error.message ? error.message : 'Failed to insert records' });
    }
  });
};

createEntityRoutes('outgoing', 'Outgoing');
createEntityRoutes('incoming', 'Incoming');
createEntityRoutes('reception', 'Reception');
createEntityRoutes('circlemail', 'CircleMail');
createEntityRoutes('history', 'History');
createEntityRoutes('archive', 'Archive');
createEntityRoutes('overdues', 'Overdue');

// Custom controller: save a new dossier and initialize workflow fields
app.post('/api/dossiers', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const body = req.body || {};
    const cmRepo = getRepository('CircleMail');
    const workflowValues = buildCircleMailWorkflowValues(body);

    const toSave = {
      sourceEntity: body.sourceEntity || 'archive',
      sourceId: (body.sourceId !== undefined && body.sourceId !== null) ? Number(body.sourceId) : null,
      circleName: body.circleName || (body.circle_name || 'الأضابير'),
      payload: body.payload ? (typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload)) : JSON.stringify({}),
      attachments: body.attachments ? (typeof body.attachments === 'string' ? body.attachments : JSON.stringify(body.attachments)) : null,
      status: normalizeStatusValue(body.status || 'open'),
      alerted: body.alerted || false,
      currentDepartmentId: body.current_department_id || body.currentDepartmentId || null,
      ...workflowValues,
      lockedAt: null,
      isTransferred: false,
    };

    const record = cmRepo.create(normalizePayload(toSave));
    const saved = await cmRepo.save(record);
    return res.json(saved);
  } catch (error) {
    console.error('Failed to save dossier:', error);
    return res.status(500).json({ error: error && error.message ? error.message : 'Failed to save dossier' });
  }
});

// Scheduler: check live CircleMail records for overdue dossiers using the stored deadline
const startOverdueChecker = async () => {
  if (!dbReady) return;
  try {
    const cmRepo = getRepository('CircleMail');
    const cms = await cmRepo.find({ order: { sourceEntity: 'ASC', sourceId: 'ASC', id: 'ASC' } });
    const now = Date.now();
    const latestBySource = new Map();

    // Determine the current circle mail per dossier source
    for (const cm of cms) {
      if (cm.sourceId === undefined || cm.sourceId === null) continue;
      const key = `${cm.sourceEntity || ''}::${cm.sourceId}`;
      const existing = latestBySource.get(key);
      if (!existing || cm.id > existing.id) {
        latestBySource.set(key, cm);
      }
    }

    // Clear overdue state for non-current records, and update current records based on deadline
    for (const cm of cms) {
      try {
        const key = (cm.sourceId === undefined || cm.sourceId === null) ? `id::${cm.id}` : `${cm.sourceEntity || ''}::${cm.sourceId}`;
        const currentCm = latestBySource.get(key);
        const hasActiveOwner = hasActiveOwnerForOverdue(cm);
        const hasActiveCountdown = cm.durationStartedAt !== null && cm.durationStartedAt !== undefined && cm.expectedDurationMinutes !== null && cm.expectedDurationMinutes !== undefined;
        const isFinishedStatus = (cm.status === 'finished' || cm.status === 'منتهية');
        const shouldBeOverdue = currentCm && currentCm.id === cm.id &&
          !isFinishedStatus &&
          hasActiveOwner &&
          hasActiveCountdown &&
          cm.deadlineAt &&
          !isNaN(new Date(cm.deadlineAt).getTime()) &&
          (Date.now() > new Date(cm.deadlineAt).getTime());

        if (cm.isOverdue !== Boolean(shouldBeOverdue)) {
          const newVals = { isOverdue: Boolean(shouldBeOverdue) };
          // Only adjust status for non-finished records
          if (!isFinishedStatus) {
            newVals.status = shouldBeOverdue ? normalizeStatusValue('overdue') : normalizeStatusValue('open');
          }
          await cmRepo.update(cm.id, newVals);
        }
      } catch (innerErr) {
        console.warn('Overdue checker row update failed for circle_mail id', cm.id, innerErr);
      }
    }
  } catch (err) {
    console.error('Overdue checker error:', err);
  }
};

// Run checker immediately and schedule it via cron every minute
try {
  setTimeout(() => { try { startOverdueChecker(); } catch (e) { console.error('Initial overdue checker failed:', e); } }, 5 * 1000);
  cron.schedule('*/1 * * * *', async () => {
    try { await startOverdueChecker(); } catch (e) { console.error('Scheduled overdue checker error:', e); }
  });
} catch (e) { console.error('Failed to schedule cron job for overdue checker:', e); }

// Scheduler: set locked_at = NOW() for dossiers that passed 30 minutes since durationStartedAt
const startLockScheduler = async () => {
  if (!dbReady) return;
  try {
    // update rows that meet the criteria: duration_started_at IS NOT NULL, current_department_id IS NOT NULL, deleted_at IS NULL, locked_at IS NULL, duration_started_at + 30 minutes <= NOW()
    const res = await AppDataSource.manager.query(
      `UPDATE circle_mail SET lockedAt = NOW() WHERE durationStartedAt IS NOT NULL AND currentDepartmentId IS NOT NULL AND deletedAt IS NULL AND lockedAt IS NULL AND TIMESTAMPDIFF(MINUTE, durationStartedAt, NOW()) >= 30`
    );
    if (res && res.affectedRows) console.log('Lock scheduler updated rows:', res.affectedRows);
  } catch (err) { console.error('Lock scheduler error:', err); }
};

// Debug route: return a small sample of circle_mail rows (diagnostic only)
app.get('/api/debug/circlemail-sample', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const rows = await AppDataSource.manager.query(
      `SELECT id, sourceEntity, sourceId, currentDepartmentId, expectedDurationMinutes, durationStartedAt, isOverdue FROM circle_mail ORDER BY id DESC LIMIT 20`
    );
    return res.json(rows || []);
  } catch (err) {
    console.error('Debug sample query failed:', err);
    return res.status(500).json({ error: 'Debug query failed' });
  }
});

// schedule lock checker every minute
try {
  cron.schedule('* * * * *', async () => {
    try { await startLockScheduler(); } catch (e) { console.error('Scheduled lock checker error:', e); }
  });
} catch (e) { console.error('Failed to schedule cron job for lock checker:', e); }

app.post('/api/upload-file', (req, res) => {
  try {
    const busboyOptions = { headers: req.headers };
    if (UPLOAD_MAX_BYTES) busboyOptions.limits = { fileSize: UPLOAD_MAX_BYTES };
    const busboy = Busboy(busboyOptions);
    const savedFiles = [];
    let hadFile = false;
    let limitExceeded = false;
    let responded = false;

    const doError = (code, msg, err) => {
      if (responded) return;
      responded = true;
      console.error(msg, err || '');
      try { res.status(code).json({ error: msg }); } catch (e) { console.error('Failed to send error response', e); }
    };

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      hadFile = true;
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const outName = unique + '-' + filename;
      const saveTo = path.join(uploadDir, outName);
      const writeStream = fs.createWriteStream(saveTo);
      let size = 0;
      file.on('data', (data) => { size += data.length; });
      // handle size limit event on the file stream
      file.on('limit', () => {
        limitExceeded = true;
        try { writeStream.destroy(); } catch (e) {}
        try { fs.unlink(saveTo, () => {}); } catch (e) {}
      });
      file.on('error', (err) => {
        doError(500, 'File stream error', err);
      });
      file.pipe(writeStream);
      writeStream.on('close', () => {
        if (!limitExceeded) savedFiles.push({ filename: outName, originalname: filename, mimetype, size, path: `/uploads/${outName}` });
      });
      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        doError(500, 'Write stream error', err);
      });
    });

    busboy.on('error', (err) => {
      doError(500, 'Busboy error', err);
    });

    busboy.on('finish', () => {
      if (responded) return;
      if (!hadFile) return doError(400, 'No file uploaded');
      if (limitExceeded) return doError(413, `تجاوز الملف الحد المسموح به (${UPLOAD_MAX_MB} ميجابايت)`);
      // return first file metadata (caller only sends one file)
      responded = true;
      return res.json(savedFiles[0] || {});
    });

    req.on('error', (err) => doError(500, 'Request error', err));
    req.pipe(busboy);
  } catch (err) {
    console.error('Upload failed (sync):', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Update circlemail by composite key (does not expose id in response)
app.post('/api/circlemail/update-by-key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { sourceEntity, sourceId, circleName, updates } = req.body || {};
    if (!sourceEntity || !circleName || (sourceId === undefined || sourceId === null)) {
      return res.status(400).json({ error: 'Missing identifying keys' });
    }
    const repo = getRepository('CircleMail');
    const found = await repo.findOneBy({ sourceEntity, sourceId, circleName });
    if (!found) return res.status(404).json({ error: 'Circle mail not found' });
    // Prevent modifications when circle mail is finished, except allowing reopen (status: 'open')
    const isUnfinish = updates && updates.status === 'open';
    if ((found.status === 'finished' || found.status === 'منتهية') && !isUnfinish) {
      return res.status(403).json({ error: 'هذه المعاملة مُنهية ولا يمكن تعديلها' });
    }

    const workflowValues = buildCircleMailWorkflowValues(updates || {});
    // normalize incoming status if present
    const incoming = { ...(updates || {}), ...workflowValues };
    if (incoming.status !== undefined && incoming.status !== null) incoming.status = normalizeStatusValue(incoming.status);
    await repo.update(found.id, incoming);
    const updated = await repo.findOneBy({ id: found.id });
    res.json(updated);
  } catch (err) {
    console.error('Failed to update circlemail by key:', err);
    res.status(500).json({ error: 'Failed to update circlemail' });
  }
});

// Create history by composite key (server resolves circleMailId internally)
app.post('/api/history/by-key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  // Automatically add actor if not provided by client (for security)
  // This part is simplified. In a real app, you'd get the user from a session/token.
  if (req.body && !req.body.actor) {
    req.body.actor = 'user'; // Placeholder, should be replaced with actual logged-in user
  }
  try {
    const payload = req.body || {};
    console.log('History by-key: incoming payload', JSON.stringify(payload));
    const repo = getRepository('History');
    if (!payload.circleMailId) {
      const { sourceEntity, sourceId, circleName } = payload;
      if (sourceEntity && circleName && (sourceId !== undefined && sourceId !== null)) {
        const cmRepo = getRepository('CircleMail');
        const found = await cmRepo.findOneBy({ sourceEntity, sourceId, circleName });
        console.log('History by-key: resolved circlemail found', found && found.id);
        if (found) {
          // Prevent creating history on a finished circle mail
          if (found.status === 'finished' || found.status === 'منتهية') return res.status(403).json({ error: 'هذه المعاملة مُنهية ولا يمكن تعديلها' });
          payload.circleMailId = found.id;
        }
      }
    }
    const record = repo.create(payload);
    const saved = await repo.save(record);
    console.log('History by-key: saved history id', saved && saved.id);
    res.json(saved);
  } catch (err) {
    console.error('Failed to create history by key:', err);
    res.status(500).json({ error: 'Failed to create history' });
  }
});

// Transfer dossier to a new department: update workflow fields and resolve overdue entries
app.post('/api/dossiers/transfer', async (req, res) => {
  if (!ensureDb(res)) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { sourceId, sourceEntity, targetDepartmentId, expectedDurationMinutes, expectedDurationDays, circleName, actor } = req.body || {};
    if (!sourceId || !targetDepartmentId) return res.status(400).json({ error: 'Missing sourceId or targetDepartmentId' });

    const cmRepo = getRepository('CircleMail');
    // the old overdue_dossiers table is no longer used for live delayed dossier status
    const historyRepo = getRepository('History');

    const se = sourceEntity || 'archive';
    // find latest circle mail for this source
    const related = await cmRepo.find({ where: { sourceEntity: se, sourceId: Number(sourceId) }, order: { id: 'DESC' }, take: 1 });
    const target = Array.isArray(related) && related.length ? related[0] : null;
    if (!target) return res.status(404).json({ error: 'Dossier CircleMail not found' });

    const now = new Date();
    const updates = {
      currentDepartmentId: Number(targetDepartmentId),
      expectedDurationDays: null,
      expectedDurationMinutes: null,
      durationStartedAt: null,
      deadlineAt: null,
      isOverdue: false,
      lockedAt: null,
      isTransferred: false,
      status: normalizeStatusValue('open'),
      ...(circleName ? { circleName } : {}),
    };

    let updated = target;
    try {
      await cmRepo.update(target.id, updates);
      updated = await cmRepo.findOneBy({ id: target.id });
    } catch (e) { console.warn('Failed to clear overdue state on transfer:', e); }

    // The live overdue status is now stored on circle_mail directly; no separate overdue table is required.
    try {
      await clearPreviousCircleMailWorkflowState(cmRepo, se, Number(sourceId), updated.id);
      await cmRepo.createQueryBuilder()
        .update()
        .set({
          isOverdue: false,
          deadlineAt: null,
          durationStartedAt: null,
          expectedDurationDays: null,
          expectedDurationMinutes: null,
          lockedAt: null,
        })
        .where('sourceEntity = :sourceEntity AND sourceId = :sourceId AND id != :currentId', {
          sourceEntity: se,
          sourceId: Number(sourceId),
          currentId: updated.id,
        })
        .execute();
    } catch (e) {
      console.warn('Failed to clear previous workflow state on transfer:', e);
    }

    // Create a history entry for the transfer
    try {
      const h = historyRepo.create({
        circleMailId: updated.id,
        actor: actor || 'system',
        action: 'transfer',
        details: JSON.stringify({ toDepartmentId: Number(targetDepartmentId), expectedDurationMinutes }),
      });
      await historyRepo.save(h);
    } catch (e) { console.warn('Failed to create history for transfer:', e); }

    return res.json({ success: true, updated });
  } catch (err) {
    console.error('Dossier transfer failed:', err);
    return res.status(500).json({ error: 'Dossier transfer failed' });
  }
});

// Get pending overdue dossiers with linked dossier info
app.get('/api/overdue-dossiers', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    // allow optional filters: departmentId and transferStatus (PENDING -> isTransferred = false)
    const params = [];
    let sql = `SELECT cm.id, cm.sourceEntity AS sourceEntity, cm.sourceId AS sourceId, cm.currentDepartmentId AS currentDepartmentId, cm.circleName as circle_name,
              cm.status, cm.expectedDurationDays AS expectedDurationDays, cm.expectedDurationMinutes AS expectedDurationMinutes, cm.durationStartedAt AS durationStartedAt, cm.deadlineAt AS deadlineAt, cm.isOverdue AS isOverdue
       FROM circle_mail cm
       JOIN (
         SELECT MAX(id) AS id
         FROM circle_mail
         WHERE deletedAt IS NULL AND (isTransferred = 0 OR isTransferred IS NULL)
         GROUP BY sourceEntity, sourceId
       ) latest ON latest.id = cm.id
       WHERE cm.isOverdue = 1
         AND (cm.currentDepartmentId IS NOT NULL OR cm.circleName IS NOT NULL)
         AND cm.deletedAt IS NULL
         AND (cm.isTransferred = 0 OR cm.isTransferred IS NULL)`;

    if (req.query && req.query.departmentId) {
      sql += ' AND cm.currentDepartmentId = ?';
      params.push(Number(req.query.departmentId));
    }
    sql += ' ORDER BY cm.durationStartedAt ASC';

    const rows = await AppDataSource.manager.query(sql, params);

    const out = (rows || []).map(r => {
      const deadlineAt = r.deadlineAt ? new Date(r.deadlineAt).toISOString() : null;
      const delayMinutes = r.deadlineAt ? Math.max(0, Math.round((Date.now() - new Date(r.deadlineAt).getTime()) / 60000)) : 0;
      const formatDuration = (mins) => {
        if (!Number.isFinite(mins) || mins <= 0) return '0 دقيقة';
        const days = Math.floor(mins / 1440);
        const hours = Math.floor((mins % 1440) / 60);
        const minutes = mins % 60;
        const parts = [];
        if (days) parts.push(`${days} يوم${days === 1 ? '' : 'اً'}`);
        if (hours) parts.push(`${hours} ساعة${hours === 1 ? '' : 'اً'}`);
        if (minutes) parts.push(`${minutes} دقيقة`);
        return parts.join(' ');
      };

      const durationMinutes = Number(r.expectedDurationMinutes) || 0;
      const title = `أضبارة #${r.sourceId || r.id}`;
      return {
        id: r.id,
        dossierNumber: r.sourceId || r.id,
        dossierName: title,
        currentDepartment: r.circle_name || (`دائرة ${r.currentDepartmentId || '-'}`),
        assignedDurationMinutes: durationMinutes,
        assignedDuration: formatDuration(durationMinutes),
        deadlineAt,
        delayDuration: formatDuration(delayMinutes),
        status: r.status || '-',
      };
    });

    res.json(out);
  } catch (err) {
    console.error('Failed to fetch overdue dossiers:', err);
    res.status(500).json({ error: 'Failed to fetch overdue dossiers' });
  }
});

// Mark an overdue dossier as resolved by clearing the live isOverdue state
app.post('/api/overdue-dossiers/resolve', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { id, dossierId } = req.body || {};
    if (!id && !dossierId) return res.status(400).json({ error: 'Missing id or dossierId' });

    const openStatus = normalizeStatusValue('open');
    if (dossierId) {
      try {
        await AppDataSource.manager.query(`UPDATE circle_mail SET is_overdue = 0, deadlineAt = NULL, status = ? WHERE source_id = ?`, [openStatus, dossierId]);
      } catch (e) { console.warn('Failed to clear is_overdue by dossierId:', e); }
    }

    if (id) {
      try {
        await AppDataSource.manager.query(`UPDATE circle_mail SET is_overdue = 0, deadlineAt = NULL, status = ? WHERE id = ?`, [openStatus, id]);
      } catch (e) { console.warn('Failed to resolve overdue record row:', e); }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to resolve overdue record:', err);
    return res.status(500).json({ error: 'Failed to resolve overdue record' });
  }
});

// Get histories for a circlemail identified by composite key
app.get('/api/history/by-key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { sourceEntity, sourceId, circleName, actor } = req.query || {};

    // If searching by actor, perform a simple filter and return
    if (actor) {
      const histories = await getRepository('History').find({ where: { actor } });
      return res.json(histories);
    }

    if (!sourceEntity || (sourceId === undefined || sourceId === null)) return res.json([]);
    
    const cmRepo = getRepository('CircleMail');
    const filter = { sourceEntity, sourceId: Number(sourceId) };
    if (circleName) filter.circleName = circleName;

    const relatedCircles = await cmRepo.find({ where: filter });
    if (!relatedCircles.length) return res.json([]);

    const ids = relatedCircles.map(c => c.id);
    const hist = await getRepository('History').createQueryBuilder('h')
      .where('h.circleMailId IN (:...ids)', { ids })
      .orderBy('h.createdAt', 'ASC')
      .getMany();

    res.json(hist);
  } catch (err) {
    console.error('Failed to fetch histories by key:', err);
    res.status(500).json({ error: 'Failed to fetch histories' });
  }
});

// Get attachments for a circlemail by composite key (internal attachments only)
app.get('/api/circlemail/attachments-by-key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { sourceEntity, sourceId, circleName } = req.query || {};
    if (!sourceEntity || !circleName || (sourceId === undefined || sourceId === null)) return res.json([]);
    const cmRepo = getRepository('CircleMail');
    const found = await cmRepo.findOneBy({ sourceEntity, sourceId: Number(sourceId), circleName });
    if (!found) return res.json([]);
    let atts = [];
    try { atts = found.attachments ? JSON.parse(found.attachments) : []; } catch (e) { atts = []; }
    res.json(atts);
  } catch (err) {
    console.error('Failed to fetch attachments by key:', err);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Append attachments to a circlemail identified by composite key
app.post('/api/circlemail/append-attachments-by-key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database is not initialized' });
  try {
    const { sourceEntity, sourceId, circleName, attachments } = req.body || {};
    if (!sourceEntity || !circleName || (sourceId === undefined || sourceId === null)) {
      return res.status(400).json({ error: 'Missing identifying keys' });
    }
    const cmRepo = getRepository('CircleMail');
    const found = await cmRepo.findOneBy({ sourceEntity, sourceId, circleName });
    if (!found) return res.status(404).json({ error: 'Circle mail not found' });
    // Prevent appending attachments to a finished circle mail
    if (found.status === 'finished' || found.status === 'منتهية') return res.status(403).json({ error: 'هذه المعاملة مُنهية ولا يمكن تعديلها' });
    let existing = [];
    try { existing = found.attachments ? JSON.parse(found.attachments) : []; } catch (e) { existing = []; }
    const toAppend = Array.isArray(attachments) ? attachments : [];
    const combined = existing.concat(toAppend);
    await cmRepo.update(found.id, { attachments: JSON.stringify(combined) });
    res.json({ attachments: combined });
  } catch (err) {
    console.error('Failed to append attachments by key:', err);
    res.status(500).json({ error: 'Failed to append attachments' });
  }
});

// مسار مسح قاعدة البيانات بالكامل
app.post('/api/system/clear-database', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    // مسح الجداول باستخدام Repositories الخاصة بـ TypeORM
    await getRepository('History').clear();
    await getRepository('CircleMail').clear();
    await getRepository('Reception').clear();
    await getRepository('Incoming').clear();
    await getRepository('Outgoing').clear();
    res.json({ message: "تم مسح كافة البيانات بنجاح" });
  } catch (error) {
    console.error('Clear database failed:', error);
    res.status(500).json({ error: 'فشل في مسح قاعدة البيانات: ' + error.message });
  }
});

// مسار إنشاء نسخة احتياطية (JSON)
app.get('/api/system/backup-database', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const backupData = {
      outgoing: await getRepository('Outgoing').find(),
      incoming: await getRepository('Incoming').find(),
      reception: await getRepository('Reception').find(),
      circlemail: await getRepository('CircleMail').find(),
      history: await getRepository('History').find(),
    };
    res.json(backupData);
  } catch (error) {
    console.error('Backup database failed:', error);
    res.status(500).json({ error: 'فشل في إنشاء النسخة الاحتياطية: ' + error.message });
  }
});

// مسار استعادة نسخة احتياطية (JSON)
app.post('/api/system/restore-database', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'بيانات النسخة الاحتياطية غير صالحة.' });
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // مسح جميع الجداول بترتيب عكسي للتبعيات (إذا وجدت)
      await queryRunner.clearTable('History');
      await queryRunner.clearTable('CircleMail');
      await queryRunner.clearTable('Reception');
      await queryRunner.clearTable('Incoming');
      await queryRunner.clearTable('Outgoing');

      // استعادة البيانات
      if (backupData.outgoing && backupData.outgoing.length) await queryRunner.manager.save('Outgoing', backupData.outgoing);
      if (backupData.incoming && backupData.incoming.length) await queryRunner.manager.save('Incoming', backupData.incoming);
      if (backupData.reception && backupData.reception.length) await queryRunner.manager.save('Reception', backupData.reception);
      if (backupData.circlemail && backupData.circlemail.length) await queryRunner.manager.save('CircleMail', backupData.circlemail);
      if (backupData.history && backupData.history.length) await queryRunner.manager.save('History', backupData.history);

      await queryRunner.commitTransaction();
      res.status(200).json({ message: "تم استعادة قاعدة البيانات بنجاح." });
    } catch (transactionError) {
      await queryRunner.rollbackTransaction();
      console.error('Database restore transaction failed:', transactionError);
      res.status(500).json({ error: 'فشل في استعادة قاعدة البيانات: ' + transactionError.message });
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error('Restore database failed:', error);
    res.status(500).json({ error: 'فشل في استعادة النسخة الاحتياطية: ' + error.message });
  }
});

// --- User and Auth Routes ---

// Login
app.post('/api/login', async (req, res) => {
  // If DB is not ready, allow a temporary dev fallback for testing only:
  // username: admin, password: admin -> returns a mock admin user.
  if (!dbReady) {
    try {
      const { username, password } = req.body || {};
      if (username === 'admin' && password === 'admin') {
        return res.json({ id: 0, username: 'admin', role: 'مشرف', dev: true });
      }
      return res.status(503).json({ error: 'Database is not initialized' });
    } catch (err) {
      console.error('Dev fallback login error:', err);
      return res.status(500).json({ error: 'فشل تسجيل الدخول' });
    }
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
    }
    const repo = getRepository('User');
    const user = await repo.findOneBy({ username });
    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const { password: _, ...userResponse } = user;
    res.json(userResponse);
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'فشل تسجيل الدخول' });
  }
});

// Get all users (for admin)
app.get('/api/users', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const users = await getRepository('User').find({ order: { id: 'ASC' } });
    const sanitized = users.map(u => { const { password, ...rest } = u; return rest; });
    res.json(sanitized);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create user (with password hashing)
app.post('/api/users', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'الرجاء ملء جميع الحقول المطلوبة.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = getRepository('User').create({ username, password: hashedPassword, role });
    const saved = await getRepository('User').save(user);
    const { password: _, ...userResponse } = saved;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user (with optional password hashing)
app.put('/api/users/:id', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const id = Number(req.params.id);
    const payload = { ...req.body };
    if (payload.password) {
      const salt = await bcrypt.genSalt(10);
      payload.password = await bcrypt.hash(payload.password, salt);
    }
    await getRepository('User').update(id, payload);
    const updated = await getRepository('User').findOneBy({ id });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userResponse } = updated;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    await getRepository('User').delete(Number(req.params.id));
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// JSON parse error handler (after routes)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

// general API 404 for clearer client errors (after routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  next();
});

const startServer = async () => {
  if (!process.env.DB_HOST) {
    console.warn('DB_HOST is not set. Starting server without database connection (DB-related routes will be unavailable).');
  } else {
    try {
      await AppDataSource.initialize();
      dbReady = true;
      // Create admin user if not exists
      const userRepo = getRepository('User');
      const admin = await userRepo.findOneBy({ username: 'admin' });
      if (!admin) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin', salt);
        await userRepo.save({ username: 'admin', password: hashedPassword, role: 'مشرف' });
        console.log('Default admin user created.');
      }
      console.log('TypeORM DataSource initialized (synchronize=true)');
    } catch (err) {
      console.error('TypeORM initialization error:', err);
      console.warn('Continuing without DB. DB-related endpoints will return 503 until DB is available.');
    }
  }

  const startListening = (port) => {
    const server = http.createServer(app);
    server.listen(port);
    server.on('listening', () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        const nextPort = Number(port) + 1;
        console.warn(`Port ${port} in use, trying ${nextPort}`);
        // try next port
        startListening(nextPort);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  };

  startListening(PORT);
};

startServer();
