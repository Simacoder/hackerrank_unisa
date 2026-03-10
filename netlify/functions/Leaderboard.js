const https = require('https');

const GAS = 'https://script.google.com/macros/s/AKfycbz9fdQ-0wNd56Jd2YkFXso2CMAcF-7LavDoMxWuvvie-4E9l7iAPmAVMs-jlh_mxDWR/exec';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

/* follow redirects, return final body as string */
function request(method, url, body, depth) {
  if (depth > 6) return Promise.reject(new Error('too many redirects'));
  return new Promise(function(resolve, reject) {
    var parsed = new URL(url);
    var opts = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   method,
      headers:  { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    };
    if (body) {
      opts.headers['Content-Type']   = 'text/plain';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    var req = https.request(opts, function(res) {
      /* follow 301/302/303 */
      if ([301,302,303].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(request('GET', res.headers.location, null, depth + 1));
      }
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end',  function()  { resolve(data); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  try {
    var url  = GAS + (event.httpMethod === 'GET' ? '?t=' + Date.now() : '');
    var body = event.httpMethod === 'POST' ? (event.body || '{}') : null;
    var text = await request(event.httpMethod === 'POST' ? 'POST' : 'GET', url, body, 0);
    JSON.parse(text); /* throws if not JSON — means GAS returned an error page */
    return { statusCode: 200, headers: CORS, body: text };
  } catch(err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};