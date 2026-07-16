'use strict';
/**
 * Find EDA sch API by querying every CDP target (frames + workers).
 * Workers can be evaluated with Target.attachToBrowserTarget or by sending
 * Runtime.evaluate to the worker's executionContextId.
 */
var http = require('http');
var WebSocket = require('ws');
var fs = require('fs');

(async function () {
    // Get browser-level WS
    var ver = await new Promise(function (resolve, reject) {
        http.get('http://localhost:9224/json/version', function (res) {
            var d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
    var wsUrl = ver.webSocketDebuggerUrl;
    console.log('Browser WS:', wsUrl);

    var ws = new WebSocket(wsUrl);
    var nextId = 1;
    var pending = new Map();
    var events = [];
    function send(method, params, sessionId) {
        var id = nextId++;
        var msg = { id: id, method: method, params: params || {} };
        if (sessionId) msg.sessionId = sessionId;
        return new Promise(function (resolve) {
            pending.set(id, resolve);
            ws.send(JSON.stringify(msg));
        });
    }
    ws.on('message', function (data) {
        var msg = JSON.parse(data);
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        } else if (msg.method) {
            events.push(msg);
        }
    });
    await new Promise(r => ws.once('open', r));

    // List all targets
    var targets = await send('Target.getTargets');
    console.log('Total targets:', targets.result.targetInfos.length);
    targets.result.targetInfos.forEach(function (t) {
        if (t.url.indexOf('lceda') >= 0 || t.type === 'service_worker' || t.type === 'worker') {
            console.log('  ['+t.type+']', t.url.substring(0, 80));
        }
    });

    // Find sch worker target
    var schTarget = targets.result.targetInfos.find(function (t) {
        return t.url.indexOf('sch-worker') >= 0;
    });
    if (!schTarget) { console.log('NO sch-worker'); process.exit(1); }
    console.log('\nAttaching to sch-worker:', schTarget.url);

    var att = await send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: true });
    var sessionId = att.result.sessionId;
    console.log('Session:', sessionId);

    // Enable Runtime
    await send('Runtime.enable', {}, sessionId);
    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    // Evaluate
    var ev = await send('Runtime.evaluate', {
        expression: 'typeof eda + " / " + (eda && eda.sch_SelectControl ? "has sch" : "no sch")',
        returnByValue: true
    }, sessionId);
    console.log('Eval result:', JSON.stringify(ev.result, null, 2));

    ws.close();
})().catch(e => console.log('ERR:', e.message));
