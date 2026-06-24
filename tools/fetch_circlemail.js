const http = require('http');
const fs = require('fs');
const url = 'http://localhost:3007/api/circlemail';
http.get(url, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      fs.writeFileSync('tools/circlemail_response.json', body, 'utf8');
      console.log('WROTE');
    } catch (e) {
      console.error('WRITEERR', e.message);
      process.exit(2);
    }
  });
}).on('error', (e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
