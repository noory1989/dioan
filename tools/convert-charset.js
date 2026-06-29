const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '' });
    console.log('Connected');
    const db = 'ddcopy-10';
    try {
      await conn.query(`ALTER DATABASE \`${db}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci`);
      console.log('Database charset set to utf8mb4');
    } catch (e) { console.warn('ALTER DATABASE failed:', e.message); }
    try {
      await conn.query(`ALTER TABLE \`${db}\`.\`circle_mail\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log('circle_mail table converted');
    } catch (e) { console.warn('ALTER TABLE failed:', e.message); }
    await conn.end();
  } catch (e) {
    console.error('Connection failed:', e.message);
    process.exit(1);
  }
})();
