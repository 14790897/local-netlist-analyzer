/**
 * Direct test of the deepseek API
 */
const https = require('https');

const data = JSON.stringify({
    model: 'deepseek-v4-pro',
    messages: [
        { role: 'system', content: '你是一个资深的电子电路设计专家。' },
        { role: 'user', content: '请用 50 字简要说明 ESP32 电路的主要功能' }
    ],
    temperature: 0.7,
    max_tokens: 500
});

const options = {
    hostname: 'new.sixiangjia.de',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-lR0N5SsgaWxTmujQTuNYZS2odRh76LDLwGtjLnf5ZmSCLxyc',
        'Content-Length': Buffer.byteLength(data)
    },
    timeout: 30000
};

const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response (first 2000 chars):');
        console.log(body.substring(0, 2000));
    });
});

req.on('error', e => console.error('Error:', e.message));
req.on('timeout', () => {
    console.error('Timeout after 30s');
    req.destroy();
});

req.write(data);
req.end();
