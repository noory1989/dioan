const { DataSource } = require('typeorm');
const path = require('path');

// Read DB config from environment variables; keep defaults for local testing
const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || '';
const DB_PASS = process.env.DB_PASS || process.env.MYSQL_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || '';

const entitiesPath = [path.join(__dirname, 'entity', '*.js')];

const AppDataSource = new DataSource({
  type: 'mysql',
  host: DB_HOST || undefined,
  port: DB_PORT,
  username: DB_USER || undefined,
  password: DB_PASS || undefined,
  database: DB_NAME || undefined,
  synchronize: true, // IMPORTANT: rely on TypeORM synchronize (no migrations)
  logging: false,
  entities: entitiesPath,
});

module.exports = {
  AppDataSource,
};
