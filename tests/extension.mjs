import { chromium, expect } from '@playwright/test';
import { resolve, sep } from 'node:path';
import { writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
const folder=resolve('dist');
const profile=await mkdtemp(resolve('artifacts/extension-profile-'));
const context=await chromium.launchPersistentContext(profile,{
  executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,
  args:[`--disable-extensions-except=${folder}`,`--load-extension=${folder}`], viewport:{width:1280,height:900}
});
try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
  const id=worker.url().split('/')[2];
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/index.html`);
  await expect(page.getByRole('heading',{name:'My lists.'})).toBeVisible();
  await page.evaluate(()=>chrome.storage.local.clear());await page.reload();
  // Send a scan result through the genuine extension message/storage path.
  const replies=await page.evaluate(async()=>{
    const a=await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:true,count:1,message:'Controlled extension runtime test'}});
    const b=await chrome.runtime.sendMessage({type:'CAPTURE_BATCH',reels:[{url:'https://www.instagram.com/reel/runtimeTest/',caption:'Guitar practice tutorial. Learn the G chord. Practice it slowly.'}]});
    const c=await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:false,count:1,message:'Controlled extension runtime test complete'}});
    return {a,b,c,state:await chrome.storage.local.get('reeldo-v1')};
  });
  if(!replies.a?.ok||!replies.b?.ok||!replies.c?.ok)throw new Error('Runtime rejected scan messages');
  // An edit racing with an incremental scan must preserve the new capture.
  await page.evaluate(async()=>{
    const saved=(await chrome.storage.local.get('reeldo-v1'))['reeldo-v1'];
    await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:true,count:2,message:'Controlled concurrent capture'}});
    await chrome.runtime.sendMessage({type:'CAPTURE_BATCH',reels:[{url:'https://www.instagram.com/reel/runtimeMissing/'}]});
    await chrome.runtime.sendMessage({type:'SAVE_STATE',state:saved});
    const latest=(await chrome.storage.local.get('reeldo-v1'))['reeldo-v1'];
    if(latest.reels.length!==2)throw new Error('Concurrent save lost a scanned link');
    await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:false,count:2,message:'Controlled runtime test complete'}});
  });
  await page.getByRole('button',{name:'Sort my reels'}).click();
  await page.getByRole('button',{name:/Saved reels/}).click();await expect(page.getByRole('button',{name:'In your list',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/My lists/}).click();await expect(page.locator('.task-card')).toHaveCount(1);
  await context.setOffline(true);await page.reload();await expect(page.locator('.task-card')).toHaveCount(1);
  const stored=await page.evaluate(async()=> (await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
  if(stored.tasks.length!==1||stored.reels[0].analysis?.category!=='Learn')throw new Error('Extension state did not persist correctly');
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/extension-test-results.json',JSON.stringify({passed:true,extensionId:id,checks:['MV3 service worker loads','Dashboard loads with extension CSP','Scan messages persist via chrome.storage.local','Automatic topic lists persist','Packaged extension reloads offline with task intact'],notTested:['Authenticated Instagram page and toolbar activation','Real local Ollama model inference'],errors},null,2));
  console.log('Passed 5 installed Edge-extension checks, including offline reload.');
}catch(e){await writeFile('artifacts/extension-error.txt',await context.pages().at(-1)?.content()||e.message);throw e;}finally{
  await context.close();
  const actual=await realpath(profile),parent=await realpath(resolve('artifacts'));
  if(!actual.toLowerCase().startsWith((parent+sep).toLowerCase()))throw new Error('Test profile cleanup target escaped artifacts.');
  await rm(actual,{recursive:true,force:true});
}
