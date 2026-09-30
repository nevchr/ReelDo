import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCaption, gridCaption } from '../src/capture.js';
import { normalizeReel, classify, mergeReels, validateBackup, INITIAL } from '../src/core.js';
const make=caption=>normalizeReel({url:'https://www.instagram.com/p/regression/',caption});
test('reads creator captions from Saved thumbnail alt text without an article',()=>{
  const caption='How to make a favicon for your website ⤵️';
  const anchor={querySelectorAll:()=>[{getAttribute:()=>caption}],getAttribute:()=>null};
  assert.deepEqual(gridCaption(anchor),{caption,captionSource:'grid',captureVersion:2});
});
test('generated accessibility descriptions stay missing, not made-up captions',()=>{
  const anchor={querySelectorAll:()=>[{getAttribute:()=>"Photo by Someone on September 18, 2026. May be a Twitter screenshot of text."}],getAttribute:()=>null};
  assert.equal(gridCaption(anchor),null);assert.equal(cleanCaption('Instagram'),'');
});
test('strips metadata author and date wrappers shown in the reported result',()=>{
  assert.equal(cleanCaption('juicewithkeya on September 21, 2026: "Dried eucalyptus + steam creates a soothing shower.".'),'Dried eucalyptus + steam creates a soothing shower.');
  assert.equal(cleanCaption('200 likes, 4 comments - cook on Instagram: "Cook pasta in water."'),'Cook pasta in water.');
});
test('emoji-numbered instructions become all five source-backed steps',()=>{
  const a=classify(make('How to make a favicon for your website ⤵️\n1️⃣ Take your logo.\n2️⃣ Make it a square, it should be 32 by 32 pixels.\n3️⃣ Head to realfavicongenerator.net and generate your favicon.\n4️⃣ Download the ZIP file and extract the contents.\n5️⃣ Add the file named favicon to your project.\n#webdevelopment'));
  assert.equal(a.status,'useful');assert.equal(a.title,'Make a favicon for your website');assert.equal(a.category,'Tech');assert.equal(a.steps.length,5);assert.ok(a.steps.every(s=>!s.includes('️⃣')));
});
test('named tutorials and concrete career leads are useful even without a checklist',()=>{
  const tutorial=classify(make('FL STUDIO SAMPLING TUTORIAL! #flstudio #flstudiotutorial'));
  assert.equal(tutorial.status,'useful');assert.equal(tutorial.category,'Learn');assert.deepEqual(tutorial.steps,[]);assert.ok(!tutorial.title.includes('#'));
  const career=classify(make('Some internships are designed for undergraduates. Explore Microsoft and undergraduate software engineering programs.'));
  assert.equal(career.status,'useful');assert.equal(career.category,'Learn');
});
test('a specific home idea is retained without inventing missing instructions',()=>{
  const a=classify(make('Dried eucalyptus + steam creates a fresh, soothing aroma that makes the shower feel relaxing.\nComment SPA and I’ll send you these bathroom essentials.\n#home'));
  assert.equal(a.status,'useful');assert.equal(a.category,'Home');assert.equal(a.title,'Explore a eucalyptus shower setup');assert.deepEqual(a.steps,[]);
});
test('short memes and ungrounded entertainment edits are filtered',()=>{
  for(const caption of ['#reel #satire #funny','THIS DUO. Made with an AI video tool. #higgsfieldgenjutsu'])assert.equal(classify(make(caption)).status,'ignored');
});
test('repairing an earlier empty capture preserves IDs and manual caption edits',()=>{
  const old={...make(''),status:'context'};
  const repaired=mergeReels([old],[{url:old.url,caption:'Learn computer vision with this tutorial.',captionSource:'grid',captureVersion:2}]);
  assert.equal(repaired.length,1);assert.equal(repaired[0].id,old.id);assert.equal(repaired[0].status,'inbox');assert.equal(repaired[0].captureVersion,2);
  const restored=validateBackup({...INITIAL,reels:repaired,tasks:[]});assert.equal(restored.reels[0].captionSource,'grid');assert.equal(restored.reels[0].captureVersion,2);
  const manual={...old,caption:'My own caption edited by me.',captionSource:'manual'};
  assert.equal(mergeReels([manual],[{url:old.url,caption:'Original caption',captionSource:'grid',captureVersion:2}])[0].caption,manual.caption);
});
