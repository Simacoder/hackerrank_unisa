const https = require('https');
const http  = require('http');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9fdQ-0wNd56Jd2YkFXso2CMAcF-7LavDoMxWuvvie-4E9l7iAPmAVMs-jlh_mxDWR/exec';

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type'                : 'application/json',
};

/* tiny http/https GET that follows redirects */
function httpGet(url, redirects) {
  redirects = redirects === undefined ? 5 : redirects;
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'netlify-proxy/1.0' } }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location && redirects > 0) {
        return resolve(httpGet(res.headers.location, redirects - 1));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end',  ()    => resolve(body));
    }).on('error', reject);
  });
}

/* tiny http/https POST that follows redirects */
function httpPost(url, body, redirects) {
  redirects = redirects === undefined ? 5 : redirects;
  return new Promise((resolve, reject) => {
    const buf  = Buffer.from(body, 'utf8');
    const parsed = new URL(url);
    const opts = {
      hostname : parsed.hostname,
      path     : parsed.pathname + parsed.search,
      method   : 'POST',
      headers  : {
        'Content-Type'  : 'text/plain',
        'Content-Length': buf.length,
        'User-Agent'    : 'netlify-proxy/1.0',
      },
    };
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(opts, res => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location && redirects > 0) {
        /* follow redirect as GET (standard browser behaviour after POST) */
        return resolve(httpGet(res.headers.location, redirects - 1));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end',  ()    => resolve(data));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    let text;
    if (event.httpMethod === 'POST') {
      text = await httpPost(APPS_SCRIPT_URL, event.body || '{}');
    } else {
      text = await httpGet(APPS_SCRIPT_URL);
    }

    /* validate it's actually JSON before returning */
    JSON.parse(text); /* throws if not JSON */
    return { statusCode: 200, headers: CORS, body: text };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};