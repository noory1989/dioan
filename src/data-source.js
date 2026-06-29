const { DataSource } = require('typeorm');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Read DB config from environment variables; keep defaults for local testing
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || 'root';
const DB_PASS = process.env.DB_PASS || process.env.MYSQL_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'ddcopy-10';

const entitiesPath = [path.join(__dirname, 'entity', '*.js')];

const AppDataSource = new DataSource({
  type: 'mysql',
  host: DB_HOST || undefined,
  port: DB_PORT,
  username: DB_USER || undefined,
  password: DB_PASS || undefined,
  database: DB_NAME || undefined,
  // Ensure connection uses UTF8 (utf8mb4) so Arabic text stores correctly
  charset: 'utf8mb4',
  synchronize: true, // IMPORTANT: rely on TypeORM synchronize (no migrations)
  logging: false,
  entities: entitiesPath,
});

module.exports = {
  AppDataSource,
};
