const https = require('https');

const GAS = 'https://script.google.com/macros/s/AKfycbz9fdQ-0wNd56Jd2YkFXso2CMAcF-7LavDoMxWuvvie-4E9l7iAPmAVMs-jlh_mxDWR/exec';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function fetch(method, url, body, hops) {
  hops = hops || 0;
  if (hops > 8) return Promise.reject(new Error('Too many redirects'));

  return new Promise(function(resolve, reject) {
    var u    = new URL(url);
    var opts = {
      hostname: u.hostname,
      port    : 443,
      path    : u.pathname + u.search,
      method  : method,
      headers : { 'User-Agent': 'Mozilla/5.0' }
    };

    if (body) {
      var buf = Buffer.from(body, 'utf8');
      opts.headers['Content-Type']   = 'text/plain';
      opts.headers['Content-Length'] = buf.length;
    }

    var req = https.request(opts, function(res) {
      var loc = res.headers.location;
      if ((res.statusCode === 301 || res.statusCode === 302 ||
           res.statusCode === 303 || res.statusCode === 307) && loc) {
        res.resume();
        // Always follow as GET after redirect (standard browser behaviour)
        return resolve(fetch('GET', loc, null, hops + 1));
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function()  { resolve(Buffer.concat(chunks).toString('utf8')); });
    });

    req.on('error', reject);
    if (body) req.write(Buffer.from(body, 'utf8'));
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    var isPost = (event.httpMethod === 'POST');
    var text   = await fetch(
      isPost ? 'POST' : 'GET',
      isPost ? GAS : GAS + '?t=' + Date.now(),
      isPost ? (event.body || '{}') : null
    );

    // If Apps Script returned HTML (login page / error page), surface it clearly
    if (text.trim().startsWith('<')) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({
          success: false,
          error: 'Apps Script returned HTML — check deployment: Execute as Me, Who has access: Anyone',
          preview: text.slice(0, 300)
        })
      };
    }

    var data = JSON.parse(text);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};