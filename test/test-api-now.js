'use strict';
/**
 * Test the exact same API call that chat.html makes, with same model+key+endpoint
 * Verify if the API is reachable in real time
 */
var https = require('https');

var data = JSON.stringify({
    model: 'deepseek-v4-pro',
    messages: [
        { role: 'user', content: '电路中有哪些电源网络?简单说明。' }
    ],
    temperature: 0.7,
    max_tokens: 4000
});

var options = {
    hostname: 'new.sixiangjia.de',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-lR0N5SsgaWxTmujQTuNYZS2odRh76LDLwGtjLnf5ZmSCLxyc',
        'Content-Length': Buffer.byteLength(data)
    },
    timeout: 90000
};

console.log('Sending request...');
var start = Date.now();
var req = https.request(options, function (res) {
    console.log('Status:', res.statusCode, '(after ' + (Date.now() - start) + 'ms)');
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () {
        console.log('Total time:', Date.now() - start, 'ms');
        console.log('Body length:', body.length);
        try {
            var obj = JSON.parse(body);
            if (obj.choices && obj.choices[0]) {
                console.log('Content:', obj.choices[0].message.content.substring(0, 200));
            }
            if (obj.usage) console.log('Usage:', JSON.stringify(obj.usage));
        } catch (e) { console.log('Parse err:', e.message); console.log('Body:', body.substring(0, 300)); }
    });
});
req.on('error', function (e) { console.log('Error:', e.message); });
req.write(data);
req.end();
