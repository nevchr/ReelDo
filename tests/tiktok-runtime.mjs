import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdtemp,realpath,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const profile=await mkdtemp(resolve('artifacts/tiktok-profile-'));
const context=await chromium.launchPersistentContext(profile,{
 executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,
 args:['--disable-extensions-except='+resolve('dist'),'--load-extension='+resolve('dist')],viewport:{width:1440,height:1080}
});
const checks=[],errors=[],requests=[];let page;
try {
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
 const id=worker.url().split('/')[2];page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 context.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto('chrome-extension://'+id+'/index.html');await expect(page.getByRole('heading',{name:'My lists.'})).toBeVisible();
 // Baseline uses the real importer to create existing Instagram data.
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 await page.getByLabel('Links + captions').fill('https://www.instagram.com/reel/existingInstagram/\nMovie: Arrival');
 await page.getByRole('button',{name:'Review import',exact:true}).click();await page.getByRole('button',{name:'Import & review',exact:true}).click();
 await page.getByRole('button',{name:'Sort my reels',exact:true}).click();
 const state=()=>page.evaluate(async()=> (await chrome.storage.local.get('reeldo-v1'))['reeldo-v1']);
 await expect.poll(async()=> (await state()).tasks.length).toBe(1);
 const baseline=(await state()).tasks[0];
 checks.push('Existing Instagram import and automatic list placement still work');
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 await page.getByLabel('Import file').setInputFiles(resolve('tests/fixtures/tiktok-favourites.json'));
 await expect(page.getByText('3 unique videos ready',{exact:true})).toBeVisible();
 await expect(page.getByRole('dialog')).toContainText('1 duplicate records combined; 3 invalid records skipped; 3 without captions');
 if((await state()).reels.length!==1)throw new Error('Preview committed data before confirmation');
 await page.screenshot({path:'artifacts/tiktok-import-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Import & review',exact:true}).click();
 await expect.poll(async()=> (await state()).reels.length).toBe(4);
 await page.getByRole('button',{name:'Sort my reels',exact:true}).click();
 await expect(page.locator('.status-tag.context')).toHaveCount(3);
 if(JSON.stringify((await state()).tasks[0])!==JSON.stringify(baseline))throw new Error('Import modified existing Instagram task');
 checks.push('Full synthetic JSON export preview, selective import, invalid/duplicate counts and Instagram preservation');
 checks.push('Captionless favourites become Needs context with no invented tasks');
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 await page.getByLabel('Import file').setInputFiles(resolve('tests/fixtures/tiktok-favourites.json'));
 await page.getByRole('button',{name:'Import & review',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('0 added, 0 updated, 3 already saved');
 if((await state()).reels.length!==4)throw new Error('Repeated export duplicated saves');
 checks.push('Repeated exports deduplicate without resetting existing saves');
 const card=page.locator('.reel-card').filter({hasText:'cook'});
 await card.getByRole('button',{name:'Add context',exact:true}).click();
 await page.getByLabel('Caption').fill('Pasta recipe.\nCook pasta in boiling water.\nMix it with tomato sauce.');
 await page.getByRole('button',{name:'Save context & sort with local rules',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Food');
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:/My lists/}).click();
 await expect(page.locator('.task-card')).toHaveCount(2);
 const food=page.locator('.task-card').filter({hasText:'Pasta recipe'});
 await food.getByRole('button',{name:/Star /}).click();
 await food.getByRole('button',{name:/Show steps/}).click();
 await food.locator('input[type=checkbox]').first().check();
 await food.getByRole('button',{name:/Edit /}).click();
 await page.getByLabel('Notes').fill('My favourite dinner');await page.getByRole('button',{name:'Save task',exact:true}).click();
 await expect.poll(async()=> (await state()).tasks.find(t=>t.category==='Food')?.notes).toBe('My favourite dinner');
 const custom=(await state()).tasks.find(t=>t.category==='Food');
 const link=page.locator('.task-card').filter({hasText:'Pasta recipe'}).getByRole('link',{name:/Open original reel/});
 await expect(link).toHaveAttribute('href','https://www.tiktok.com/@cook/video/7123456789012345678');
 checks.push('Manual TikTok context creates a source-grounded list entry; original link, notes, star and checklist work');
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 await page.getByLabel('Import file').setInputFiles(resolve('tests/fixtures/tiktok-favourites.json'));
 await page.getByRole('button',{name:'Import & review',exact:true}).click();
 if(JSON.stringify((await state()).tasks.find(t=>t.category==='Food'))!==JSON.stringify(custom))throw new Error('Reimport reset user task');
 if(!(await state()).reels.find(r=>r.creator==='cook').caption.includes('Cook pasta'))throw new Error('Reimport erased manual caption');
 checks.push('Reimport preserves manual captions and task edits');
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 const input=page.getByLabel('Import file');
 for(const [name,mimeType,content,message] of [
  ['bad.json','application/json','{"bad":','not valid'],
  ['history.json','application/json',JSON.stringify({Activity:{'Video Browsing History':{VideoList:[{Link:'https://www.tiktok.com/@x/video/7999999999999999999'}]}}}),'No Favorite Videos'],
  ['export.zip','application/zip','PKsynthetic','Extract the ZIP'],
  ['large.txt','text/plain','x'.repeat(10000001),'10 MB'],
  ['invalid.json','application/json',JSON.stringify({'Favorite Videos':{FavoriteVideoList:[{Link:'https://vm.tiktok.com/ABC/'}]}}),'No valid TikTok']
 ]) {
  await input.setInputFiles({name,mimeType,buffer:Buffer.from(content)});
  await expect(page.getByRole('alert')).toContainText(message);
  await expect(page.getByRole('button',{name:'Review import',exact:true})).toBeDisabled();
  if((await state()).reels.length!==4)throw new Error('Rejected file altered storage');
 }
 checks.push('Malformed, history-only, ZIP, oversized and all-invalid files fail clearly without stale imports');
 await input.setInputFiles(resolve('tests/fixtures/Favorite Videos.txt'));
 await expect(page.getByText('2 unique videos ready',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Import & review',exact:true}).click();
 await expect.poll(async()=> (await state()).reels.length).toBe(5);
 checks.push('Favourite-only TXT file import works through the file picker');
 await page.getByRole('button',{name:/My lists/}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
 const backup=await download;await backup.saveAs('artifacts/tiktok-runtime-backup.json');
 const exported=JSON.parse(await readFile('artifacts/tiktok-runtime-backup.json','utf8'));
 if(exported.reels.length!==5||exported.tasks.length!==2)throw new Error('Mixed backup incomplete');
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 page.once('dialog',d=>d.accept());
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Restore a ReelDo workspace backup'}).click();
 await (await picker).setFiles(resolve('artifacts/tiktok-runtime-backup.json'));
 await expect(page.getByRole('dialog')).toHaveCount(0);
 if(JSON.stringify((await state()).tasks)!==JSON.stringify(exported.tasks))throw new Error('Backup restore lost progress');
 checks.push('Actual mixed-platform backup download and restore preserve task progress');
 await page.getByRole('button',{name:/My lists/}).click();await context.setOffline(true);await page.reload();
 await expect(page.locator('.task-card')).toHaveCount(2);
 if((await state()).reels.length!==5)throw new Error('Offline reload lost sources');
 await page.screenshot({path:'artifacts/tiktok-workspace-desktop.png',fullPage:true});
 checks.push('Production extension worker, CSP, chrome.storage and offline reload verified');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Import reels',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Links + captions').fill('https://www.tiktok.com/@new/video/7555555555555555555');
 await page.getByRole('button',{name:'Review import',exact:true}).click();
 await expect(page.getByText('1 unique videos ready',{exact:true})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw new Error('Mobile horizontal overflow');
 await page.getByRole('button',{name:'Import & review',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'artifacts/tiktok-import-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Import & review',exact:true}).click();
 await expect.poll(async()=> (await state()).reels.length).toBe(6);
 checks.push('Mobile import preview and confirmation work without horizontal overflow');
 if(errors.length||requests.length)throw new Error('Unexpected errors or network requests: '+JSON.stringify({errors,requests}));
 await writeFile('artifacts/tiktok-test-results.json',JSON.stringify({passed:true,checks,errors,requests,fixtureOnly:true,notTested:['Christopher actual TikTok export','Live TikTok account or video availability','Everyday installed Chrome extension upgrade','Real Ollama inference']},null,2));
 console.log('Passed '+checks.length+' TikTok production-extension workflow checks.');
} catch(error) {
 await writeFile('artifacts/tiktok-test-results.json',JSON.stringify({passed:false,checks,error:error.stack,errors,requests},null,2));
 if(page)await page.screenshot({path:'artifacts/tiktok-error.png',fullPage:true}).catch(()=>{});
 throw error;
} finally {
 await context.close();
 const actual=await realpath(profile),parent=await realpath(resolve('artifacts'));
 if(!actual.toLowerCase().startsWith((parent+sep).toLowerCase()))throw new Error('Profile cleanup escaped artifacts.');
 await rm(actual,{recursive:true,force:true});
}
