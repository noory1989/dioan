require('dotenv').config();
require('reflect-metadata');
const express = require('express');
const path = require('path');

const { AppDataSource } = require('./src/data-source');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
  attachments: Array.isArray(payload.attachments)
    ? JSON.stringify(payload.attachments)
    : payload.attachments
      ? payload.attachments
      : JSON.stringify([]),
});

const getRepository = (entityName) => AppDataSource.getRepository(entityName);

const createEntityRoutes = (routeBase, entityName) => {
  app.get(`/api/${routeBase}`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const records = await getRepository(entityName).find({ order: { id: 'DESC' } });
      res.json(records);
    } catch (error) {
      console.error(`Failed to fetch ${entityName}:`, error);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  app.post(`/api/${routeBase}`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const record = getRepository(entityName).create(normalizePayload(req.body));
      const saved = await getRepository(entityName).save(record);
      res.json(saved);
    } catch (error) {
      console.error(`Failed to create ${entityName}:`, error);
      res.status(500).json({ error: 'Failed to create record' });
    }
  });

  app.put(`/api/${routeBase}/:id`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const id = Number(req.params.id);
      await getRepository(entityName).update(id, normalizePayload(req.body));
      const updated = await getRepository(entityName).findOneBy({ id });
      if (!updated) return res.status(404).json({ error: 'Record not found' });
      res.json(updated);
    } catch (error) {
      console.error(`Failed to update ${entityName}:`, error);
      res.status(500).json({ error: 'Failed to update record' });
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
      res.status(500).json({ error: 'Failed to delete record' });
    }
  });

  app.post(`/api/${routeBase}/bulk`, async (req, res) => {
    if (!ensureDb(res)) return;
    try {
      const payloads = Array.isArray(req.body) ? req.body : [];
      const created = await getRepository(entityName).save(
        payloads.map(normalizePayload)
      );
      res.json(created);
    } catch (error) {
      console.error(`Failed to bulk insert ${entityName}:`, error);
      res.status(500).json({ error: 'Failed to insert records' });
    }
  });
};

createEntityRoutes('outgoing', 'Outgoing');
createEntityRoutes('incoming', 'Incoming');
createEntityRoutes('reception', 'Reception');

const startServer = async () => {
  if (!process.env.DB_HOST) {
    console.error('DB_HOST is not set. The server requires a MySQL database connection.');
    process.exit(1);
  }

  try {
    await AppDataSource.initialize();
    dbReady = true;
    console.log('TypeORM DataSource initialized (synchronize=true)');
  } catch (err) {
    console.error('TypeORM initialization error:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer();

