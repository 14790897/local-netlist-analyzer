/**
 * Direct API test to see usage stats
 */
const https = require('https');

const data = JSON.stringify({
    model: 'deepseek-v4-pro',
    messages: [
        { role: 'system', content: '你是电路分析专家。基于以下网表(57元件,40网络)用中文回答用户问题。\n\n3V3: U1-1,U1-7,U1-12\nGND: U1-9,U1-19,U3-2\n+5V: U4-2,U4-11\nCLK: U1-3,FPC1-13\nCS: U1-6,FPC1-12\nDIN: U1-5,FPC1-14\nBUSY: U1-10,FPC1-9\nEN: U1-2,U5-2\nGND: FPC1-8,FPC1-17' },
        { role: 'user', content: '这是一个 ESP32 墨水屏驱动电路。请用 200 字介绍其电源网络和主要功能。' }
    ],
    temperature: 0.7,
    max_tokens: 4000
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
    timeout: 120000
};

const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        var j;
        try { j = JSON.parse(body); } catch (e) { console.log('Body:', body.substring(0, 500)); return; }
        console.log('Usage:', JSON.stringify(j.usage, null, 2));
        console.log('Content length:', (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').length);
        console.log('Content:', j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
        console.log('Reasoning length:', (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.reasoning_content || '').length);
        console.log('Finish reason:', j.choices && j.choices[0] && j.choices[0].finish_reason);
    });
});

req.on('error', e => console.error('Error:', e.message));
req.on('timeout', () => { console.error('Timeout'); req.destroy(); });

req.write(data);
req.end();
