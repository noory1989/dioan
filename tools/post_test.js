const http = require('http');
const data = JSON.stringify({
  sourceEntity: 'Outgoing',
  sourceId: 1,
  circleName: 'الدوار التجريبي',
  payload: '<DOCtype test>',
  attachments: ['<DOCtype file>'],
  status: 'open'
});

const tryPorts = [3006,3007,3008,3009,3010,3011,3012];

(async () => {
  for (const port of tryPorts) {
    await new Promise((resolve) => {
      const options = { hostname: 'localhost', port, path: '/api/circlemail', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
      const req = http.request(options, (res) => {
        console.log('\nTried port', port, 'STATUS:', res.statusCode);
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          console.log('BODY:', body);
          resolve();
        });
      });
      req.on('error', (e) => { console.log('port', port, 'error', e.message); resolve(); });
      req.write(data);
      req.end();
    });
  }
})();
