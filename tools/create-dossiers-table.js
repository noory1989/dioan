const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '' });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`ddcopy-10\`.\`dossiers\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NULL,
        projectName VARCHAR(255) NULL,
        subject VARCHAR(512) NULL,
        sourceEntity VARCHAR(50) NULL,
        sourceId INT NULL,
        circleName VARCHAR(255) NULL,
        payload TEXT NULL,
        attachments LONGTEXT NULL,
        status VARCHAR(50) DEFAULT 'قيد العمل',
        currentDepartmentId INT NULL,
        isLocked BOOLEAN DEFAULT FALSE,
        isTransferred BOOLEAN DEFAULT FALSE,
        deletedAt DATETIME NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dossiers_created (createdAt),
        INDEX idx_dossiers_status (status)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('dossiers table ready');
  } finally {
    await conn.end();
  }
})();
