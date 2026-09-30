import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, normalizeReel, classify, mergeReels, parseImport, taskFromReel, validateBackup, INITIAL } from '../src/core.js';
import { exampleState } from '../src/examples.js';
const reel = caption => normalizeReel({ url: 'https://www.instagram.com/reel/abc123/', caption });
test('canonicalizes Instagram links without tracking, rejects unsafe and unrelated URLs',()=>{
  assert.equal(normalizeUrl('https://instagram.com/reels/ABC_123/?igsh=private'), 'https://www.instagram.com/reel/ABC_123/');
  assert.equal(normalizeUrl('https://www.instagram.com/p/a-b/'),'https://www.instagram.com/p/a-b/');
  for(const u of ['javascript:alert(1)','https://www.instagram.com.evil.org/reel/123/','http://instagram.com/reel/123/','https://instagram.com/accounts/login/','https://tiktok.com/reel/123/'])assert.equal(normalizeUrl(u),'');
});
test('turns actual cooking instructions into source-backed steps',()=>{
  const a=classify(reel('One-pot pasta recipe.\nAdd pasta and tomatoes to a pot.\nSimmer until the pasta is tender.\nFollow for more recipes!'));
  assert.equal(a.status,'useful');assert.equal(a.category,'Food');assert.equal(a.title,'Make one-pot pasta recipe');
  assert.deepEqual(a.steps,['Add pasta and tomatoes to a pot','Simmer until the pasta is tender']);
  assert.equal(a.evidence,'Add pasta and tomatoes to a pot.');
});
test('entertainment and promotional save calls never become tasks',()=>{
  for(const text of ['POV the group chat is quiet. This is a relatable meme. lmao.', 'Skibidi brainrot compilation with funny memes.', 'Funny recipe parody. Save this reel for later. Follow me for more memes.'])assert.equal(classify(reel(text)).status,'ignored');
});
test('missing, ambiguous, inspirational, and risk claims stay reviewable',()=>{
  for(const text of ['', '#recipe #food', 'Save this for later. Follow for more recipes.', 'This beautiful sunset made my day, life is a journey.', 'Try this miracle cure for your illness.', 'Invest for guaranteed returns and double your money.'])assert.equal(classify(reel(text)).status,'context');
});
test('balanced filter retains actionable humour, strict filter requires review',()=>{
  const r=reel('Funny but useful pasta recipe.\nCook the pasta in salted water.\nMix it with tomato sauce.');
  assert.equal(classify(r,'balanced').status,'useful');assert.equal(classify(r,'strict').status,'context');
});
test('a lunch break does not turn a mobility routine into a food task',()=>{
  const a=classify(reel('A 5-minute desk mobility routine.\nStretch your hip flexors.\nRepeat the routine after your lunch break.'));
  assert.equal(a.category,'Fitness');assert.equal(a.status,'useful');
});
test('generic actions are reviewable unless the user chooses open filtering',()=>{
  const r=reel('Write three reasons you liked this interesting idea.');assert.equal(classify(r).status,'context');assert.equal(classify(r,'open').status,'useful');
});
test('imports multi-line captions and treats a bare URL as missing context',()=>{
  const imported=parseImport('https://instagram.com/reel/first/?igsh=test\nPasta recipe.\nCook the pasta in boiling water.\n\nhttps://instagram.com/reel/second/');
  assert.equal(imported.length,2);assert.match(imported[0].caption,/Cook the pasta/);assert.equal(classify(imported[1]).status,'context');
  assert.throws(()=>parseImport('{not valid}'),/not valid/);assert.throws(()=>parseImport('random nonsense'),/No Instagram/);assert.throws(()=>parseImport('[{"url":"https://evil.org"}]'),/Instagram/);
});
test('deduplicates scans and preserves decisions until actual new context appears',()=>{
  const original={...reel('Pasta recipe. Cook pasta in water.'),status:'ignored'};
  const same=mergeReels([original],[{url:original.url}]);assert.equal(same.length,1);assert.equal(same[0].status,'ignored');assert.equal(same[0].caption,original.caption);
  const enriched=mergeReels([original],[{url:original.url,caption:'Pasta recipe. Cook pasta and add tomato sauce.'}]);assert.equal(enriched[0].status,'inbox');assert.match(enriched[0].caption,/tomato/);
});
test('task IDs are deterministic and checklists survive a backup round trip',()=>{
  const r=reel('Pasta recipe. Cook pasta in boiling water.');r.analysis=classify(r);const task=taskFromReel(r);task.steps[0].done=true;task.starred=true;
  assert.equal(taskFromReel(r).id,task.id);const backup=validateBackup({...INITIAL,reels:[r],tasks:[task]});assert.equal(backup.tasks[0].steps[0].done,true);assert.equal(backup.tasks[0].starred,true);
  assert.throws(()=>validateBackup({version:77,reels:[],tasks:[]}),/backup/);
});
test('example workspace is explicitly marked, with eight useful ideas and two skips',()=>{
  const s=exampleState();assert.equal(s.reels.filter(r=>r.status==='useful').length,8);assert.equal(s.reels.filter(r=>r.status==='ignored').length,2);assert.equal(s.reels.filter(r=>r.status==='context').length,2);assert.equal(s.tasks.length,4);assert.ok(s.reels.every(r=>r.demo));assert.equal(s.tasks[0].steps.length,3);
});
