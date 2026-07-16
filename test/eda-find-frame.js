'use strict';
/**
 * Real EDA test — find the schematic frame, run menu fn via EDA API,
 * test both analyzeSelection and aiAnalyzeSelection.
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT_DIR = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());
    console.log('URL:', p.url().substring(0, 80));

    // Find EDA frame with sch_SelectControl
    var frameInfo = await p.evaluate(function () {
        function walk(win, depth, found) {
            if (depth > 5 || !win) return;
            try {
                if (win.eda && win.eda.sch_SelectControl) {
                    found.push({ url: win.location.href, hasEda: true, hasSch: true });
                    return;
                }
                var frames = win.frames || [];
                for (var i = 0; i < frames.length; i++) walk(frames[i], depth + 1, found);
            } catch (e) {}
        }
        var found = [];
        walk(window, 0, found);
        return found;
    });
    console.log('FRAMES_WITH_EDA:', JSON.stringify(frameInfo));

    await b.close();
})();
