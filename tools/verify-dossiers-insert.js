const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ddcopy-10',
    charset: 'utf8mb4',
  });

  try {
    const [beforeRows] = await conn.query('SELECT COUNT(*) as c FROM dossiers');
    const beforeCount = beforeRows[0].c;
    console.log('before_count=' + beforeCount);

    const payload = JSON.stringify({ source: 'direct-check', ts: new Date().toISOString() });
    const [result] = await conn.query(
      'INSERT INTO dossiers (title, projectName, subject, sourceEntity, sourceId, circleName, payload, attachments, status, currentDepartmentId, isLocked, isTransferred) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['direct-check', 'direct-project', 'direct-subject', 'archive', null, 'الأضابير', payload, null, 'قيد العمل', null, 0, 0]
    );

    console.log('insert_id=' + result.insertId);

    const [afterRows] = await conn.query('SELECT COUNT(*) as c FROM dossiers');
    console.log('after_count=' + afterRows[0].c);

    const [latest] = await conn.query('SELECT id, title, projectName, subject FROM dossiers ORDER BY id DESC LIMIT 1');
    console.log('latest=' + JSON.stringify(latest[0]));
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
