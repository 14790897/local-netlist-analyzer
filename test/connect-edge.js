/**
 * FINAL TEST: include netlist in system prompt for proper AI analysis
 */
'use strict';
var { chromium } = require('playwright-core');
var path = require('path');
var http = require('http');

function get(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (res) {
            var data = '';
            res.on('data', function (c) { data += c; });
            res.on('end', function () { resolve(data); });
        }).on('error', reject);
    });
}

(async function () {
    var shotsDir = path.join(__dirname, 'screenshots');
    var browser = await chromium.connectOverCDP('http://localhost:9224');
    var context = browser.contexts()[0];
    var page = context.pages()[0];

    var frames = page.frames();
    var chatFrame = null;
    for (var i = 0; i < frames.length; i++) {
        if (frames[i].url().indexOf('blob:') >= 0) {
            chatFrame = frames[i];
            break;
        }
    }
    if (!chatFrame) { console.log('No frame'); return; }

    // Get netlist
    var netlistStr = await chatFrame.evaluate(function () {
        if (typeof nlData !== 'undefined' && nlData && nlData.nets) {
            return JSON.stringify(nlData);
        }
        // Try from storage
        try {
            var d = eda.sys_Storage.getExtensionUserConfig('__nl_data');
            if (d) return d;
        } catch (e) {}
        try {
            var d2 = localStorage.getItem('__nl_data');
            if (d2) return d2;
        } catch (e) {}
        return null;
    });
    console.log('Netlist available:', netlistStr ? 'yes (' + netlistStr.length + ' chars)' : 'no');

    // Reset and inject proper doSend with netlist context
    await chatFrame.evaluate(function (nl) {
        isSending = false;
        window._sending = false;
        history = [];
        var btn = document.querySelector('button#sendBtn');
        if (btn) btn.disabled = false;
        var area = document.getElementById('chatArea');
        if (area) area.innerHTML = '';

        // Build system context with netlist
        var sysCtx = '你是电路分析专家。基于以下网表(57元件,40网络)回答用户问题,用中文,不超过 200 字。\n\n';
        try {
            var data = JSON.parse(nl);
            if (data && data.nets) {
                var keys = Object.keys(data.nets);
                for (var i = 0; i < Math.min(15, keys.length); i++) {
                    var net = keys[i];
                    sysCtx += net + ': ' + (data.nets[net] || []).slice(0, 5).join(',') + '\n';
                }
                if (keys.length > 15) sysCtx += '... 共 ' + keys.length + ' 个网络\n';
            }
        } catch (e) {
            sysCtx += '(网表解析失败: ' + e.message + ')';
        }
        window._sysCtx = sysCtx;
    }, netlistStr);

    // Inject doSend
    await chatFrame.evaluate(function () {
        window.doSend = async function() {
            if (window._sending) return;
            var text = userInput.value.trim();
            if (!text) return;

            userInput.value = '';
            userInput.style.height = 'auto';
            sendBtn.disabled = true;
            window._sending = true;

            addMsg('user', text);
            showTyping();

            try {
                var controller = new AbortController();
                var tid = setTimeout(function() { controller.abort(); }, 30000);

                var resp = await fetch(cfg.endpoint.replace(/\/+$/, '') + '/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + cfg.key
                    },
                    body: JSON.stringify({
                        model: cfg.model,
                        messages: [
                            { role: 'system', content: window._sysCtx },
                            { role: 'user', content: text }
                        ],
                        max_tokens: 500,
                        temperature: 0.7
                    }),
                    signal: controller.signal
                });
                clearTimeout(tid);

                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var data = await resp.json();
                var reply = '';
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    reply = data.choices[0].message.content || '';
                }
                if (!reply && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.reasoning_content) {
                    reply = '(无内容) ' + data.choices[0].message.reasoning_content.substring(0, 200);
                }
                if (!reply) reply = '(无响应)';
                hideTyping();
                addMsg('assistant', reply);
            } catch (e) {
                hideTyping();
                showError('请求失败: ' + e.name + ': ' + e.message);
            } finally {
                sendBtn.disabled = false;
                window._sending = false;
            }
        };

        var btn = document.querySelector('button#sendBtn');
        if (btn) {
            var newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', window.doSend);
        }
    });

    // Ask a meaningful question
    var inputArea = await chatFrame.$('textarea');
    if (inputArea) {
        await inputArea.fill('这是一个 ESP32 墨水屏驱动电路。请用 100 字介绍其电源网络和主要功能。');
    }
    var sendBtn = await chatFrame.$('button#sendBtn');
    if (sendBtn) {
        console.log('Sending...');
        await sendBtn.click();
    }

    // Wait
    for (var w = 0; w < 8; w++) {
        await page.waitForTimeout(10000);
        try { await page.screenshot({ path: path.join(shotsDir, 'final-wait' + w + '.png'), timeout: 3000 }); } catch (e) {}
        var s = await chatFrame.evaluate(function () {
            var msgs = Array.from(document.querySelectorAll('.msg')).map(function (m) { return m.innerText; });
            return { count: msgs.length, msgs: msgs, btnDisabled: document.querySelector('button#sendBtn') ? document.querySelector('button#sendBtn').disabled : null };
        });
        console.log('  +' + ((w + 1) * 10) + 's: count=' + s.count + ' btn=' + s.btnDisabled);
        if (s.btnDisabled === false && s.count > 1) break;
    }

    try { await page.screenshot({ path: path.join(shotsDir, 'final-result.png'), timeout: 5000 }); } catch (e) {}
    var finalMsgs = await chatFrame.evaluate(function () {
        return Array.from(document.querySelectorAll('.msg')).map(function (m) { return m.innerText; });
    });
    console.log('\n=== FINAL MESSAGES ===');
    finalMsgs.forEach(function (m, i) { console.log('--- ' + i + ' ---'); console.log(m); });

    await browser.close();
})();
