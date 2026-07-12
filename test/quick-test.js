'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async()=>{
var b=await chromium.connectOverCDP('http://localhost:9273');
var p=b.contexts()[0].pages()[0];
var logs=[];
p.on('console',function(m){var t=m.text();if(t.startsWith('[NL]')){logs.push(t);console.log(t)}});

// Fresh start
await p.goto('https://pro.lceda.cn/editor?cll=debug',{waitUntil:'domcontentloaded',timeout:30000});
await new Promise(r=>setTimeout(r,10000));

// Menu click on home page
await p.evaluate(function(){
    var btns=document.querySelectorAll('[class*=menu-btn-top-text]');
    for(var i=0;i<btns.length;i++){if(btns[i].textContent.trim()==='\u9ad8\u7ea7'){btns[i].click();return}}
});
await new Promise(r=>setTimeout(r,1000));
var pos=await p.evaluate(function(){
    var all=document.querySelectorAll('[class*=eda-menu-item]');
    for(var i=0;i<all.length;i++){if(all[i].textContent.includes('\u5c40\u90e8\u7f51\u8868')){var r=all[i].getBoundingClientRect();return{x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2)}}}
    return null;
});
if(pos)await p.mouse.click(pos.x,pos.y);
await new Promise(r=>setTimeout(r,1000));
await p.evaluate(function(){
    var all=document.querySelectorAll('[class*=eda-menu-item]');
    for(var i=0;i<all.length;i++){if(all[i].textContent.includes('\u5206\u6790\u9009\u4e2d')){all[i].click();return}}
});
await new Promise(r=>setTimeout(r,30000));

var dlg=await p.evaluate(function(){var d=document.querySelector('#extapiDialogInformationMessageDlg');return d?d.innerText.substring(0,200):'no dialog'});
console.log('Dialog:',dlg);
console.log('=== ALL LOGS ===');
logs.forEach(function(l){console.log(l)});
})();
