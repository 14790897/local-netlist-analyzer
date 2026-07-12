'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async()=>{
var b=await chromium.connectOverCDP('http://localhost:9273');
var pages=b.contexts()[0].pages();

// Find schematic page
var p=null;
for(var i=0;i<pages.length;i++){
    var t=await pages[i].title();
    console.log('Page '+i+':',t.substring(0,60));
    if(t.includes('P1.Schematic'))p=pages[i];
}
if(!p){console.log('No schematic page!');return}

console.log('Using schematic page');

// Collect all console
p.on('console',function(m){var t=m.text();console.log('[C]',t.substring(0,180))});

// Just try page.evaluate with eda directly
var result=await p.evaluate(function(){
    try{
        return typeof eda;
    }catch(e){
        return 'error: '+e.message;
    }
});
console.log('eda type:',result);

// Try calling APIs
var nl=await p.evaluate(async function(){
    try{
        var ids=await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        return 'ids='+ids.length;
    }catch(e){return 'err: '+e.message}
});
console.log('API test:',nl);
})();
