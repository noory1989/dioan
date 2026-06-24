const http = require('http');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test_upload.txt');
const fileBuffer = fs.readFileSync(filePath);
const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);

const payloadParts = [];
payloadParts.push(Buffer.from(`--${boundary}\r\n`));
payloadParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\n`));
payloadParts.push(Buffer.from(`Content-Type: text/plain\r\n\r\n`));
payloadParts.push(fileBuffer);
payloadParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

const payload = Buffer.concat(payloadParts);

const options = {
  hostname: '127.0.0.1',
  port: 3010,
  path: '/api/upload-file',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': payload.length
  }
};

const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('RESPONSE', data);
    process.exit(0);
  });
});

req.on('error', (err) => { console.error('REQUEST ERROR', err); process.exit(1); });
req.write(payload);
req.end();
