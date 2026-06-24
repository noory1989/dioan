const http = require('http');
const data = JSON.stringify({
  sourceEntity: 'outgoing',
  sourceId: 1,
  circleName: 'مكتب السيد المدير',
  payload: JSON.stringify({ serial: '1', date: '2026-06-13', recipient: 'المحافظة', subject: 'استقالة', attachments: [], id: 1, createdAt: new Date().toISOString() }),
  attachments: JSON.stringify([]),
  status: 'open'
});

const options = {
  hostname: 'localhost',
  port: 3007,
  path: '/api/circlemail',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('HEADERS', res.headers);
    console.log('BODY', body);
  });
});

req.on('error', (e) => {
  console.error('REQUEST ERROR', e.message);
});

req.write(data);
req.end();
