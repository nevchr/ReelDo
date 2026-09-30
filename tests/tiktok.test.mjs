import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeUrl,idFor,normalizeReel,parseImport,parseImportDetailed,mergeReels,classify,organizeWorkspace,validateBackup,INITIAL,sourceLabel} from '../src/core.js';
const url='https://www.tiktok.com/@cook/video/7123456789012345678';
const exportOf=list=>JSON.stringify({Activity:{'Favorite Videos':{FavoriteVideoList:list}},'Like List':[{Link:'https://www.tiktok.com/@x/video/7999999999999999999'}]});
test('TikTok URL variants deduplicate by video number and keep Instagram identities',()=>{
 assert.equal(normalizeUrl(url+'/?is_from_webapp=1#secret'),url);
 for(const u of ['https://m.tiktok.com/v/7123456789012345678.html','https://www.tiktok.com/video/7123456789012345678','https://www.tiktokv.com/share/video/7123456789012345678/?foo=private'])assert.equal(idFor(u),idFor(url));
 assert.notEqual(idFor('https://www.instagram.com/reel/7123456789012345678/'),idFor(url));
 assert.equal(normalizeReel({url}).creator,'cook');
 assert.equal(sourceLabel(normalizeReel({url})),'TikTok favourite');
});
test('unsafe, short, profile and nonvideo TikTok URLs are rejected',()=>{
 for(const u of ['http://www.tiktok.com/@x/video/7123456789012345678','https://www.tiktok.com.evil.test/@x/video/7123456789012345678','https://evil.test/?url='+url,'https://me:secret@www.tiktok.com/@x/video/7123456789012345678','https://www.tiktok.com:444/@x/video/7123456789012345678','https://vm.tiktok.com/ABC/','https://www.tiktok.com/t/ABC/','https://www.tiktok.com/@x','https://www.tiktok.com/@x/photo/7123456789012345678','https://www.tiktokv.com/@x/video/7123456789012345678'])assert.equal(normalizeUrl(u),'',u);
 assert.throws(()=>parseImport('https://vm.tiktok.com/ABC/'),/full TikTok/);
});
test('synthetic full export selects only favourites, reports invalid and duplicate entries',async()=>{
 const report=parseImportDetailed(await readFile(new URL('./fixtures/tiktok-favourites.json',import.meta.url),'utf8'));
 assert.equal(report.reels.length,3);assert.equal(report.skipped,3);assert.equal(report.duplicates,1);assert.equal(report.withoutContext,3);
 assert.equal(report.reels[0].savedAt,'2026-09-01 12:00:00');assert.equal(report.reels[0].caption,'');
 assert.ok(!report.reels.some(r=>r.url.includes('7999999999999999999')));
 assert.equal(classify(report.reels[0]).status,'context');
});
test('favourites sections can be direct, nested or British-spelled without importing liked or watched videos',()=>{
 for(const value of [{FavoriteVideoList:[{Link:url}]},{'Favourite Videos':{FavouriteVideoList:[{Link:url}]}},{'Your Activity':{'Favorite Videos':{FavoriteVideoList:[{Link:url}]}}}])assert.equal(parseImport(JSON.stringify(value)).length,1);
 assert.throws(()=>parseImport(JSON.stringify({Activity:{'Video Browsing History':{VideoList:[{Link:url}]}},'Like List':[{Link:url}]})),/No Favorite Videos/);
});
test('TXT dates and export labels never become captions or fabricated tasks',async()=>{
 const report=parseImportDetailed(await readFile(new URL('./fixtures/Favorite Videos.txt',import.meta.url),'utf8'));
 assert.equal(report.reels.length,2);assert.equal(report.duplicates,1);assert.equal(report.skipped,1);
 assert.ok(report.reels.every(r=>r.caption===''&&classify(r).status==='context'));
 assert.equal(report.reels[0].savedAt,'2026-09-01 12:00:00');
});
test('mixed pasted links and explicit captions retain the existing classification flow',()=>{
 const r=parseImport(url+'\nPasta recipe.\nCook pasta in boiling water.\n\nhttps://instagram.com/reel/testMixed/\nMovie: Arrival');
 assert.equal(r.length,2);assert.equal(classify(r[0]).category,'Food');assert.equal(classify(r[0]).status,'useful');assert.equal(classify(r[1]).category,'Movies');
});
test('empty, malformed, unsupported, all-invalid and oversized inputs fail before committing',()=>{
 for(const input of ['', '{"bad":',exportOf([]),exportOf([null,{Link:'https://evil.test'}]),JSON.stringify({'Favorite Videos':{Other:[]}}),'PK synthetic zip'])assert.throws(()=>parseImport(input));
 assert.throws(()=>parseImport(exportOf(Array.from({length:2001},()=>({Link:url})))),/2,000/);
 assert.throws(()=>parseImport('x'.repeat(10000001)),/10 MB/);
 assert.throws(()=>parseImport('é'.repeat(5000001)),/10 MB/);
});
test('import limits apply before deduplication and include invalid records',()=>{
 const records=Array.from({length:1999},()=>({Link:url}));records.push({Link:'bad'});
 assert.equal(parseImportDetailed(exportOf(records)).skipped,1);
 records.push({Link:'bad'});assert.throws(()=>parseImport(exportOf(records)),/2,000/);
});
test('enrichment imports preserve manually edited captions, decisions and existing task details',()=>{
 const original={...normalizeReel({url,caption:'Pasta recipe. Cook pasta in boiling water.',captionSource:'manual',transcript:'My private transcript'}),status:'useful',listDismissed:true};
 original.analysis=classify(original);
 const task={id:'user-task',reelId:original.id,title:'My dinner',category:'Food',autoGenerated:false,done:true,starred:true,notes:'Keep this note',due:'2026-10-01',steps:[{id:'step-0',text:'Cook pasta in boiling water',done:true}]};
 const state={...INITIAL,reels:[original],tasks:[task]};
 const imported=parseImport(exportOf([{Link:'https://www.tiktokv.com/share/video/7123456789012345678/',Date:'2026-09-01',caption:'Try a different dinner recipe.',transcript:'Replace the manual transcript'}]));
 const next=organizeWorkspace({...state,reels:mergeReels(state.reels,imported)});
 assert.equal(next.reels.length,1);assert.equal(next.reels[0].caption,original.caption);assert.equal(next.reels[0].transcript,original.transcript);assert.equal(next.reels[0].status,'useful');assert.equal(next.reels[0].listDismissed,true);
 assert.deepEqual(next.tasks,[task]);assert.equal(next.reels[0].savedAt,'2026-09-01');
 assert.deepEqual(mergeReels(next.reels,imported),next.reels);
});
test('mixed-platform backup restores TikTok sources, dates, lists and user progress',()=>{
 const reels=parseImport(url+'\nPasta recipe. Cook pasta in boiling water.\nhttps://instagram.com/reel/backupMixed/\nMovie: Arrival');
 reels[0].savedAt='2026-09-01';for(const r of reels){r.analysis=classify(r);r.status=r.analysis.status;}
 const state=organizeWorkspace({...INITIAL,reels});state.tasks[0].starred=true;state.tasks[0].steps[0].done=true;
 const restored=validateBackup(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.reels[0].platform,'tiktok');assert.equal(restored.reels[0].savedAt,'2026-09-01');assert.equal(restored.tasks[0].starred,true);assert.equal(restored.tasks[0].steps[0].done,true);
 assert.throws(()=>parseImport(JSON.stringify(state)),/Restore/);
});
test('untrusted export content cannot inject source URLs or thumbnail network requests',()=>{
 const r=parseImport(exportOf([{Link:url,caption:'<script>alert(1)</script>',thumbnail:'https://evil.test/pixel',creator:{bad:true}}]))[0];
 assert.equal(r.thumbnail,'');assert.equal(r.creator,'cook');assert.equal(r.transcript,'');
});
test('BOM and CRLF imports work and unsupported deep JSON fails clearly',()=>{
 assert.equal(parseImport('\uFEFF'+exportOf([{Link:url}])).length,1);
 assert.equal(parseImport('Date: 2026-09-01\r\nLink: '+url+'\r\n')[0].caption,'');
 let value={'Favorite Videos':{FavoriteVideoList:[{Link:url}]}};for(let i=0;i<22;i++)value={nested:value};
 assert.throws(()=>parseImport(JSON.stringify(value)),/too complex/);
});
