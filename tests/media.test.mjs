import test from 'node:test';
import assert from 'node:assert/strict';
import { safeThumbnail, safeThumbnailData, thumbnailRect, gridThumbnail, metadataThumbnail, detailThumbnail } from '../src/capture.js';
import { INITIAL, normalizeReel, mergeReels, classify, validateBackup } from '../src/core.js';
const url='https://scontent.cdninstagram.com/cover.jpg?token=123';
test('only Instagram image hosts can be used as thumbnails',()=>{
  assert.equal(safeThumbnail(url),url);
  for(const src of ['javascript:alert(1)','https://evil.org/x.png','https://cdninstagram.com.evil.org/x.png','https://user:pass@cdninstagram.com/x.png','http://cdninstagram.com/x.png','data:image/svg+xml,<svg/>'])assert.equal(safeThumbnail(src),'');
});
test('uses the rendered thumbnail or supplied poster without choosing an unrelated avatar',()=>{
  assert.deepEqual(gridThumbnail({querySelector:()=>({currentSrc:url})}),{thumbnail:url,mediaCaptureVersion:1});
  assert.equal(metadataThumbnail({querySelector:selector=>selector.includes('og:image')?{content:url}:null}).thumbnail,url);
  assert.equal(detailThumbnail({querySelector:()=>({getAttribute:()=>url})},null).thumbnail,url);
  assert.equal(detailThumbnail({querySelector:()=>null},null).thumbnail,'');
});
test('thumbnail-only rescans preserve task classification and manual captions',()=>{
  const r=normalizeReel({url:'https://www.instagram.com/reel/thumb/',caption:'A pasta recipe. Cook the pasta in boiling water.',captionSource:'manual',captureVersion:2});
  const analysis=classify(r),old={...r,status:analysis.status,analysis};
  const next=mergeReels([old],[{url:r.url,caption:r.caption,captureVersion:2,thumbnail:url,mediaCaptureVersion:1}])[0];
  assert.equal(next.thumbnail,url);assert.equal(next.status,old.status);assert.deepEqual(next.analysis,analysis);assert.equal(next.captionSource,'manual');
  assert.equal(mergeReels([next],[{url:r.url}])[0].thumbnail,url);
  assert.equal(validateBackup({...INITIAL,reels:[next],tasks:[]}).reels[0].thumbnail,url);
});
test('dark mode survives backups and legacy settings default to light',()=>{
  assert.equal(validateBackup({...INITIAL,settings:{...INITIAL.settings,theme:'dark'}}).settings.theme,'dark');
  assert.equal(validateBackup({...INITIAL,settings:{strictness:'balanced',engine:'rules'}}).settings.theme,'light');
});
test('local thumbnail copies survive rescans and backups without being sent to the source',()=>{
  const data='data:image/jpeg;base64,/9j/AA==';
  assert.equal(safeThumbnailData(data),data);assert.equal(safeThumbnailData('data:image/svg+xml,<svg/>'),'');
  assert.equal(safeThumbnailData('data:image/jpeg;base64,'+'A'.repeat(12000)),'');
  const r=normalizeReel({url:'https://www.instagram.com/reel/cache/',caption:'Movie: Arrival',thumbnail:url,thumbnailData:data,mediaCaptureVersion:2});
  assert.equal(mergeReels([r],[{url:r.url,thumbnail:url}])[0].thumbnailData,data);
  assert.equal(validateBackup({...INITIAL,reels:[r],tasks:[]}).reels[0].thumbnailData,data);
});
test('only fully visible loaded thumbnails can be cropped',()=>{
  const rect={left:20,top:30,width:100,height:150,right:120,bottom:180};
  const image={complete:true,naturalWidth:200,getBoundingClientRect:()=>rect};
  assert.deepEqual(thumbnailRect(image,800,600),{left:20,top:30,width:100,height:150});
  assert.equal(thumbnailRect({...image,complete:false},800,600),null);
  assert.equal(thumbnailRect({...image,getBoundingClientRect:()=>({...rect,top:-5})},800,600),null);
});
