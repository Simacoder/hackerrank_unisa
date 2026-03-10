// Netlify serverless function — proxies requests to Google Apps Script
// Sits between your website and Google Sheets, handling CORS transparently
// Deploy: place this file at netlify/functions/leaderboard.js in your repo root

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9fdQ-0wNd56Jd2YkFXso2CMAcF-7LavDoMxWuvvie-4E9l7iAPmAVMs-jlh_mxDWR/exec';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let response;

    if (event.httpMethod === 'GET') {
      response = await fetch(APPS_SCRIPT_URL, {
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (event.httpMethod === 'POST') {
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: event.body,
      });
    } else {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const text = await response.text();
    return { statusCode: 200, headers, body: text };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};