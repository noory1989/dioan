const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'ddcopy-10' });
  try {
    const [tables] = await conn.query('SHOW TABLES LIKE ?', ['dossiers']);
    console.log('tables', JSON.stringify(tables));
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM dossiers');
    console.log('count', JSON.stringify(rows));
  } finally {
    await conn.end();
  }
})();
