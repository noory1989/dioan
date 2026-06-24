const http = require('http');
const qs = require('querystring');
const check = (sourceEntity, sourceId, circleName) => new Promise((resolve)=>{
  const params = qs.stringify({ sourceEntity, sourceId, circleName });
  http.get(`http://localhost:3007/api/circlemail/attachments-by-key?${params}`, (res) => {
    let body=''; res.setEncoding('utf8'); res.on('data', c=>body+=c); res.on('end', ()=>{ console.log('CHECK', circleName, res.statusCode, body); resolve(); });
  }).on('error', e=>{ console.error('ERR', e.message); resolve(); });
});
(async ()=>{
  await check('outgoing', 1, 'مكتب السيد المدير');
  await check('outgoing', 1, 'الرقابة الداخلية');
})();
