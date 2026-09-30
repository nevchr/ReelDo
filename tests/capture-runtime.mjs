import { chromium, expect } from '@playwright/test';
import { resolve, sep } from 'node:path';
import { cp, writeFile, readFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { INITIAL, normalizeReel, classify } from '../src/core.js';
// This isolated test grants Instagram access only to a copied test build so
// scripting can run against intercepted fixtures without a real toolbar click.
// The production manifest continues to use activeTab and has no such grant.
const temp=await mkdtemp(resolve('artifacts/capture-test-'));
const extension=resolve(temp,'extension');await cp(resolve('dist'),extension,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));manifest.host_permissions=['<all_urls>'];await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest));
const context=await chromium.launchPersistentContext(resolve(temp,'profile'),{executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:1000}});
try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const fixtures=[
    ['repairFavicon','How to make a favicon for your website ⤵️\n1️⃣ Take your logo.\n2️⃣ Make it a square, 32 by 32 pixels.\n3️⃣ Generate your favicon.\n4️⃣ Download the ZIP file.\n5️⃣ Add the favicon to your project.\n#webdevelopment'],
    ['repairTutorial','FL STUDIO SAMPLING TUTORIAL! #flstudio #flstudiotutorial'],
    ['repairMeme','#reel #satire #funny'],
    ['repairPhoto','Photo by Someone on September 18, 2026. May be an image of text.'],
    ['repairNoImage','Guitar practice tutorial. Learn the Em chord.']
  ];
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const html=`<main style="padding-top:1200px"><h2>All Posts</h2><div style="display:flex;flex-direction:column;gap:250px">${fixtures.map(([key,caption])=>`<a href="/p/${key}/" aria-label="${escape(caption)}">${key==='repairNoImage'?'':`<img src="https://scontent.cdninstagram.com/${key}.png" alt="${escape(caption)}">`}<svg aria-label="Clip"></svg></a>`).join('')}</div></main>`;
  const fixtureImage=await readFile('artifacts/fixture-movie.png');
  await context.route('https://scontent.cdninstagram.com/**',route=>route.fulfill({contentType:'image/png',body:fixtureImage}));
  let requests=0;
  await context.route('https://www.instagram.com/**',route=>{requests++;return route.fulfill({contentType:'text/html; charset=utf-8',body:route.request().url().includes('/saved/')?html:route.request().url().includes('repairNoImage')?'<meta property="og:image" content="https://scontent.cdninstagram.com/repaired.png">':'<title>Instagram</title><meta name="description" content="Instagram">'});});
  const app=await context.newPage();await app.goto(`chrome-extension://${id}/index.html`);
  const old={...INITIAL,reels:fixtures.map(([key])=>({...normalizeReel({url:`https://www.instagram.com/p/${key}/`}),status:'context',analysis:classify({caption:''})})),tasks:[{id:'keep-task',reelId:'repairFavicon',title:'Keep my existing task',category:'Learn',steps:[],due:'',notes:'',done:false,starred:true}]};
  await app.evaluate(state=>chrome.storage.local.set({'reeldo-v1':state}),old);
  const savedPage=await context.newPage();await savedPage.goto('https://www.instagram.com/test/saved/all-posts/');
  const tabId=await app.evaluate(async()=> (await chrome.tabs.query({url:'https://www.instagram.com/test/saved/all-posts/'}))[0].id);
  await app.evaluate(async tabId=>{
    await chrome.scripting.executeScript({target:{tabId},func:()=>{globalThis.__reeldoLimit=5;globalThis.__reeldoRefreshThumbnails=true;window.scrollTo(0,document.scrollingElement.scrollHeight);}});
    await chrome.scripting.executeScript({target:{tabId},files:['reader.js','scanner.js']});
  },tabId);
  await expect(savedPage.locator('#reeldo-scan-panel')).toContainText('4 readable captions',{timeout:20000});
  await expect(savedPage.locator('#reeldo-scan-panel')).toContainText('1 missing');
  const captured=await app.evaluate(async()=> (await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
  if(!captured.reels.every(r=>r.thumbnail?.includes('scontent.cdninstagram.com')))throw new Error('Reader did not persist Saved thumbnails');
  if(captured.reels.length!==5||captured.reels.filter(r=>r.caption).length!==4||captured.tasks.length!==1||!captured.tasks[0].starred)throw new Error('Repair lost data or failed to collect thumbnail captions');
  if(captured.reels.filter(r=>r.thumbnailData?.startsWith('data:image/jpeg;base64,')).length!==4)throw new Error('Visible thumbnails were not cached locally');
  // Readable thumbnails require no individual post requests; only the
  // genuinely missing photo can fall back to its metadata.
  if(requests!==3)throw new Error(`Expected collection + one missing-caption and one missing-thumbnail request, got ${requests}`);
  const known=await app.evaluate(()=>chrome.runtime.sendMessage({type:'GET_KNOWN'}));
  if(known.ids.length!==3||known.ids.includes('repairPhoto'))throw new Error('Missing-caption retry exclusions are incorrect');
  const refresh=await app.evaluate(()=>chrome.runtime.sendMessage({type:'GET_KNOWN',refreshThumbnails:true}));
  if(refresh.ids.length)throw new Error('Thumbnail refresh skipped earlier captures');
  await app.getByRole('button',{name:'Sort my reels'}).click();
  await app.getByRole('button',{name:/Saved reels/}).click();
  await expect(app.locator('.reel-card .status-tag.useful')).toHaveCount(3);await expect(app.locator('.reel-card .status-tag.ignored')).toHaveCount(1);await expect(app.locator('.reel-card .status-tag.context')).toHaveCount(1);
  await app.screenshot({path:'artifacts/caption-repair-verified.png',fullPage:true,animations:'disabled',style:'.toast{visibility:hidden!important}'});
  const after=await app.evaluate(async()=> (await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
  const favicon=after.reels.find(r=>r.id==='repairFavicon');if(favicon.analysis.steps.length!==5)throw new Error('Emoji checklist was not recovered');
  await context.setOffline(true);await app.reload();
  await expect(app.locator('.task-thumbnail img[src^="data:image/jpeg"]')).toHaveCount(2);
  await expect.poll(()=>app.locator('.task-thumbnail img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  const stored=await app.evaluate(async()=>(await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
  if(stored.reels.filter(r=>r.thumbnailData).length!==4)throw new Error('Offline reload lost local thumbnail copies');
  await writeFile('artifacts/caption-repair-test-results.json',JSON.stringify({passed:true,checks:['Actual reader and scanner injected together with chrome.scripting','Captions captured from alt text, without articles or metadata','Earlier empty records repaired without duplicates','Existing starred task preserved','Missing thumbnails are recovered even when captions are already readable','Visible thumbnails are cropped and cached locally and render offline','Missing captions remain eligible for retry','Three useful ideas, one meme filtered, one genuine missing caption','Five emoji-numbered checklist steps recovered'],scope:'Isolated Edge profile with intercepted Instagram fixtures and a test-only all-URLs host grant needed to simulate activeTab screenshot permission. Production permissions unchanged.'},null,2));
  console.log('Passed 9 capture-repair and thumbnail-cache runtime checks.');
}finally{
  await context.close();const actual=await realpath(temp),parent=await realpath(resolve('artifacts'));
  if(!actual.toLowerCase().startsWith((parent+sep).toLowerCase()))throw new Error('Test cleanup escaped artifacts');await rm(actual,{recursive:true,force:true});
}
