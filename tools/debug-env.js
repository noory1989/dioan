const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const out = {
  cwd: process.cwd(),
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_NAME: process.env.DB_NAME,
};
fs.writeFileSync(path.resolve(__dirname, 'debug-env.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
