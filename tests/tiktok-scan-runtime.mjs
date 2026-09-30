import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {cp,readFile,writeFile,mkdtemp,rm,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {INITIAL,normalizeReel,classify,organizeWorkspace} from '../src/core.js';
const temp=await mkdtemp(resolve('artifacts/tiktok-scan-test-')),extension=resolve(temp,'extension');
await cp(resolve('dist'),extension,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));manifest.host_permissions=['<all_urls>'];
await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest));
const context=await chromium.launchPersistentContext(resolve(temp,'profile'),{executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1280,height:1000}});
let app,page,popup;const checks=[],errors=[],detailRequests=[];
const urls={food:'https://www.tiktok.com/@cook/video/7123456789012345678',tech:'https://www.tiktok.com/@tech/video/7234567890123456789',missing:'https://www.tiktok.com/@unknown/video/7345678901234567890',meme:'https://www.tiktok.com/@fun/video/7456789012345678901',extra:'https://www.tiktok.com/@new/video/7567890123456789012'};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const card=(url,caption,generic=false)=>'<article data-e2e="user-post-item" style="height:150px"><a href="'+url+'"><img src="/cover.png" width="96" height="120" alt="'+esc(generic?'Video cover':caption)+'">'+(generic?'':'<p data-e2e="user-post-item-desc">'+esc(caption)+'</p>')+'</a></article>';
function html(mode='favorites',lazy=false){
 let grid=card(urls.food,'Pasta recipe. Cook pasta in boiling water. Mix it with tomato sauce.')+card(urls.tech,'A new open source coding app for developers.')+(lazy?'':card(urls.missing,'',true)+card(urls.meme,'POV a relatable meme lmao.'));
 if(mode==='many')grid=Array.from({length:30},(_,i)=>card('https://www.tiktok.com/@bulk/video/'+String(7600000000000000000n+BigInt(i)),'Pasta recipe. Cook pasta in boiling water.')).join('');
 return '<!doctype html><body><main><h1>Controlled TikTok fixture</h1>'+(
 mode==='login'?'<div role="dialog" data-e2e="login-modal">Log in to TikTok</div>':
 mode==='challenge'?'<div id="captcha-verify">Verify that you are human</div>':
 mode==='unknown'?'': '<button role="tab" data-e2e="'+(['favorites','many'].includes(mode)?'favorites-tab':'videos-tab')+'" aria-selected="true" aria-controls="favorites-grid">'+(['favorites','many'].includes(mode)?'Favorites':'Videos')+'</button>'
 )+'<div id="favorites-grid" data-e2e="user-post-item-list">'+grid+(lazy?'<div style="height:1600px"></div>':'')+'</div><div data-e2e="related-videos">'+card(urls.extra,'Movie: Wrong recommendation')+'</div></main>'+(
 lazy?'<script>window.addEventListener("scroll",()=>{if(scrollY>100&&!window.added){window.added=true;document.getElementById("favorites-grid").insertAdjacentHTML("beforeend",'+JSON.stringify(card(urls.missing,'',true)+card(urls.meme,'POV a relatable meme lmao.'))+');}})</script>':'')+'</body>';
}
let mode='favorites',lazy=false;
try{
 const image=await readFile('artifacts/fixture-movie.png');
 await context.route('https://www.tiktok.com/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/cover.png')return route.fulfill({contentType:'image/png',body:image});
  if(url.pathname.includes('/video/')){detailRequests.push(url.href);return route.fulfill({contentType:'text/html',body:'<main data-e2e="video-detail"><p data-e2e="browse-video-desc">Movie: Arrival</p></main>'});}
  return route.fulfill({contentType:'text/html',body:html(mode,lazy)});
 });
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
 app=await context.newPage();await app.goto('chrome-extension://'+id+'/index.html');app.on('pageerror',e=>errors.push(e.message));
 const original=normalizeReel({url:'https://www.instagram.com/reel/keepExisting/',caption:'Movie: Arrival'});
 original.analysis=classify(original);original.status=original.analysis.status;
 const seed=organizeWorkspace({...INITIAL,reels:[original]});seed.tasks[0].notes='My existing note';seed.tasks[0].starred=true;
 await app.evaluate(s=>chrome.storage.local.set({'reeldo-v1':s}),seed);
 const state=()=>app.evaluate(async()=> (await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));lazy=true;await page.goto('https://www.tiktok.com/@fixture');
 const tabId=await app.evaluate(async()=> (await chrome.tabs.query({url:'https://www.tiktok.com/@fixture'}))[0].id);
 const popupEvent=context.waitForEvent('page');
 await app.evaluate(async()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html'),active:false}));
 popup=await popupEvent;await popup.waitForLoadState();await app.evaluate(async id=>chrome.tabs.update(id,{active:true}),tabId);
 async function sync({limit=100,refresh=false,autoSort=true}={}){
  await popup.evaluate(async({limit,refresh,autoSort})=>{document.querySelector('#limit').value=String(limit);document.querySelector('#refresh-thumbnails').checked=refresh;document.querySelector('#auto-sort').checked=autoSort;await document.querySelector('#scan').onclick();},{limit,refresh,autoSort});
  await expect(page.locator('#reeldo-scan-panel')).toBeVisible();
 }
 async function done(){await expect(page.locator('#reeldo-scan-panel button').first()).toHaveText('Close',{timeout:20000});}
 await sync();await done();
 let captured=await state();
 if(captured.reels.length!==5||captured.tasks.length!==3)throw new Error('Expected 4 TikTok saves and 2 immediate new tasks; got '+JSON.stringify({reels:captured.reels.length,tasks:captured.tasks.length}));
 if(captured.reels.some(r=>r.url===urls.extra))throw new Error('Related videos entered favourites');
 if(captured.reels.find(r=>r.url===urls.missing)?.status!=='context'||captured.reels.find(r=>r.url===urls.meme)?.status!=='ignored')throw new Error('Context/meme classification failed');
 if(!captured.reels.find(r=>r.url===urls.food)?.thumbnailData)throw new Error('Visible TikTok cover was not cropped and stored locally');
 assert.deepEqual(captured.tasks.find(t=>t.reelId==='keepExisting'),seed.tasks[0],'Sync changed existing Instagram task');
 checks.push('Real popup dispatch injects TikTok reader/scanner and persists through extension messaging');
 checks.push('Scoped Favourites grid includes lazy-loaded videos and excludes related recommendations');
 checks.push('One Sync action immediately creates grounded Food/Tech lists and keeps missing/meme decisions reviewable');
 checks.push('Visible TikTok thumbnails are cropped locally with unchanged production CSP');
 await page.screenshot({path:'artifacts/tiktok-scan-panel.png',fullPage:true});
 await popup.screenshot({path:'artifacts/tiktok-sync-popup.png',fullPage:true});
 await sync();await done();if((await state()).reels.length!==5||(await state()).tasks.length!==3)throw new Error('Repeated sync duplicated records or tasks');
 checks.push('Repeated incremental scans deduplicate, skip readable records and keep existing user tasks');
 // A workspace save that races with new auto-sorted captures must retain generated lists.
 await app.evaluate(async stale=>{await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:true,count:4,message:'Controlled race'}});const result=await chrome.runtime.sendMessage({type:'SAVE_STATE',state:stale});if(!result.ok)throw new Error(result.error);await chrome.runtime.sendMessage({type:'SCAN_PROGRESS',scan:{running:false,count:4,message:'Controlled race complete'}});},seed);
 captured=await state();if(captured.tasks.length!==3||captured.reels.length!==5)throw new Error('Concurrent workspace save lost auto-sorted captures/lists');
 checks.push('Workspace edits racing with sync preserve new captures and automatically generated lists');
 // Rescan with genuinely richer page text repairs missing context and creates its task.
 await page.locator('a[href="'+urls.missing+'"]').evaluate(a=>a.insertAdjacentHTML('beforeend','<p data-e2e="user-post-item-desc">Guitar practice tutorial. Learn the G chord. Practice it slowly.</p>'));
 await sync();await done();await expect.poll(async()=> (await state()).tasks.length).toBe(4);
 checks.push('Missing-caption retries enrich the original save and generate a grounded task without duplication');
 // Refuse known incorrect pages and sign-in / challenge blockers before collecting.
 const before=JSON.stringify((await state()).reels);
 for(const target of ['videos','login','challenge']){
  mode=target;lazy=false;await page.reload();await sync();await done();
  await expect(page.locator('#reeldo-scan-panel')).toContainText(target==='videos'?'Open the Favourites tab':target==='login'?'requires sign-in':'verification challenge');
  if(JSON.stringify((await state()).reels)!==before)throw new Error('Blocked '+target+' view changed captures');
 }
 checks.push('Posted-video views, sign-in dialogs and challenges stop without clicking controls or collecting data');
 mode='unknown';await page.reload();await sync();
 await expect(page.locator('#reeldo-scan-panel')).toContainText('cannot confirm');
 if(JSON.stringify((await state()).reels)!==before)throw new Error('Unconfirmed profile was scanned');
 await page.getByRole('button',{name:'This is my Favourites view — sync'}).click();await done();
 checks.push('Ambiguous profile layouts require explicit Favourites-view confirmation');
 mode='favorites';lazy=true;await page.reload();await sync({refresh:true});await page.getByRole('button',{name:'Stop sync',exact:true}).click();await done();
 await expect(page.locator('#reeldo-scan-panel')).toContainText('Stopped');
 if((await state()).reels.length!==5)throw new Error('Stop removed previously captured records');
 checks.push('User cancellation stops scrolling and preserves captured results');
 // Bounded scan in a clean state; all links may be loaded but only the chosen count enters storage.
 await app.evaluate(s=>chrome.storage.local.set({'reeldo-v1':s}),seed);
 mode='many';lazy=false;await page.reload();await sync({limit:25,autoSort:false});await done();
 captured=await state();if(captured.reels.length!==26||captured.tasks.length!==1||captured.reels.filter(r=>r.platform==='tiktok').some(r=>r.status!=='inbox'))throw new Error('Sort opt-out was ignored');
 checks.push('A 25-video bound stops a 30-video grid; sort opt-out preserves manual review');
 // Single-video capture uses only its rendered description; there is no metadata fetch.
 await page.goto(urls.extra);await sync();await done();
 if((await state()).reels.find(r=>r.url===urls.extra)?.analysis?.category!=='Movies')throw new Error('Individual TikTok description was not read');
 if(detailRequests.length!==1)throw new Error('Scanner made unexpected video/detail requests');
 checks.push('Individual video capture reads the visible description without fetching private APIs or other videos');
 await context.route('https://scontent.cdninstagram.com/**',route=>route.fulfill({contentType:'image/png',body:image}));
 await context.route('https://www.instagram.com/**',route=>route.fulfill({contentType:'text/html',body:'<main><a href="/reel/scanFreshInstagram/"><img src="https://scontent.cdninstagram.com/new.png" width="96" height="120" alt="Guitar practice tutorial. Learn the C chord."></a></main>'}));
 await page.goto('https://www.instagram.com/test/saved/all-posts/');await sync();await done();
 if((await state()).reels.find(r=>r.id==='scanFreshInstagram')?.analysis?.category!=='Learn'||(await state()).tasks.length!==3)throw new Error('Instagram one-action sorting failed');
 checks.push('The same popup Sync action automatically sorts Instagram captures into existing mixed-platform lists');
 await context.setOffline(true);await app.reload();await expect(app.locator('.task-card')).toHaveCount(3);
 await app.screenshot({path:'artifacts/tiktok-sync-workspace.png',fullPage:true});
 checks.push('Auto-created source links, task lists and cached thumbnails survive offline reload');
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile('artifacts/tiktok-scan-test-results.json',JSON.stringify({passed:true,checks,errors,scope:'Controlled TikTok DOM fixtures in an isolated Edge profile. Test-only all-URLs grant simulates a genuine activeTab toolbar click. Production permissions and CSP unchanged.',notVerified:['Authenticated TikTok DOM and favourites availability','Everyday installed Chrome toolbar activation','Browser save/favourite observer','Phone saves or cross-device sync']},null,2));
 console.log('Passed '+checks.length+' TikTok page-sync checks.');
}catch(error){
 await writeFile('artifacts/tiktok-scan-test-results.json',JSON.stringify({passed:false,checks,error:error.stack,errors},null,2));
 if(page)await page.screenshot({path:'artifacts/tiktok-scan-error.png',fullPage:true}).catch(()=>{});
 throw error;
}finally{
 await context.close();const actual=await realpath(temp),parent=await realpath(resolve('artifacts'));if(!actual.toLowerCase().startsWith((parent+sep).toLowerCase()))throw new Error('Cleanup escaped artifacts');await rm(actual,{recursive:true,force:true});
}
