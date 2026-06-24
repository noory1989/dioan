const http = require('http');

const postJson = (port, path, obj) => new Promise((resolve) => {
  const data = JSON.stringify(obj);
  const options = { hostname: 'localhost', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
  const req = http.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => body += c);
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ error: e.message }));
  req.write(data);
  req.end();
});

(async () => {
  const port = 3007;
  // 1) create initial circlemail in 'مكتب السيد المدير'
  const initialPayload = { sourceEntity: 'outgoing', sourceId: 1, circleName: 'مكتب السيد المدير', payload: JSON.stringify({ serial: '1', date: '2026-06-13', recipient: 'المحافظة', subject: 'استقالة', attachments: [], id: 1, createdAt: new Date().toISOString() }), attachments: JSON.stringify([]), status: 'open' };
  console.log('Creating initial circlemail...');
  console.log(await postJson(port, '/api/circlemail', initialPayload));

  // 2) append attachments to that circlemail
  const attach = [{ name: 'demo.txt', type: 'text/plain', data: 'data:text/plain;base64,SGVsbG8gd29ybGQ=' }];
  console.log('Appending attachments to circlemail by key...');
  console.log(await postJson(port, '/api/circlemail/append-attachments-by-key', { sourceEntity: 'outgoing', sourceId: 1, circleName: 'مكتب السيد المدير', attachments: attach }));

  // 3) transfer to new circle: server should pick up attachments from existing CircleMail via fromCircle
  const transferPayload = { sourceEntity: 'outgoing', sourceId: 1, fromCircle: 'مكتب السيد المدير', circleName: 'الرقابة الداخلية', payload: JSON.stringify({ serial: '1', date: '2026-06-13', recipient: 'المحافظة', subject: 'استقالة', attachments: [], id: 1, createdAt: new Date().toISOString() }), attachments: JSON.stringify([]), status: 'open' };
  console.log('Transferring to another circle (should carry attachments)...');
  console.log(await postJson(port, '/api/circlemail', transferPayload));

  // 4) create a history note for the new circlemail by-key (note should appear)
  console.log('Creating history note (by-key) for transferred record...');
  const historyPayload = { sourceEntity: 'outgoing', sourceId: 1, circleName: 'الرقابة الداخلية', action: 'note', note: 'ملاحظة أثناء التحويل', actor: 'tester' };
  console.log(await postJson(port, '/api/history/by-key', historyPayload));

  process.exit(0);
})();
