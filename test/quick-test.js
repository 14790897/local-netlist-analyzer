'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async()=>{
var b=await chromium.connectOverCDP('http://localhost:9273');
var p=b.contexts()[0].pages()[0];
await p.reload({waitUntil:'domcontentloaded',timeout:30000});
await new Promise(r=>setTimeout(r,15000));

// Click menu
await p.evaluate(function(){
    var btns=document.querySelectorAll('[class*=menu-btn-top-text]');
    for(var i=0;i<btns.length;i++){if(btns[i].textContent.trim()==='高级'){btns[i].click();return}}
});
await new Promise(r=>setTimeout(r,1000));
var pos=await p.evaluate(function(){
    var all=document.querySelectorAll('[class*=eda-menu-item]');
    for(var i=0;i<all.length;i++){if(all[i].textContent.includes('局部网表')){var r=all[i].getBoundingClientRect();return{x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2)}}}
    return null;
});
if(pos)await p.mouse.click(pos.x,pos.y);
await new Promise(r=>setTimeout(r,1000));
await p.evaluate(function(){
    var all=document.querySelectorAll('[class*=eda-menu-item]');
    for(var i=0;i<all.length;i++){if(all[i].textContent.includes('分析选中')){all[i].click();return}}
});
await new Promise(r=>setTimeout(r,30000));

var dlg=await p.evaluate(function(){
    var d=document.querySelector('#extapiDialogInformationMessageDlg');
    return d?d.innerText.substring(0,200):'no dialog';
});
console.log('Dialog:',dlg);
})();
