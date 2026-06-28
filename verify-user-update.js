const http = require('http');
const payload = JSON.stringify({ username: 'admin', role: 'مشرف عام' });
const req = http.request({
  hostname: '127.0.0.1',
  port: 3020,
  path: '/api/users/1',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(JSON.stringify({ status: res.statusCode, body }, null, 2));
  });
});
req.on('error', (err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
req.write(payload);
req.end();
