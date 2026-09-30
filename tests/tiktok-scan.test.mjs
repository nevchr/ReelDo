import test from 'node:test';
import assert from 'node:assert/strict';
import {scanPlatform,tiktokVideoUrl,tiktokCaptionText} from '../src/capture.js';
test('page scanning accepts exact Instagram/TikTok HTTPS origins only',()=>{
 for(const url of ['https://www.tiktok.com/@me','https://tiktok.com/favorites','https://m.tiktok.com/@me'])assert.equal(scanPlatform(url),'tiktok');
 assert.equal(scanPlatform('https://www.instagram.com/me/saved'),'instagram');
 for(const url of ['http://www.tiktok.com/@me','https://www.tiktok.com.evil.test/@me','https://u:p@www.tiktok.com/@me','https://www.tiktok.com:444/@me','https://vm.tiktok.com/a','https://www.tiktokv.com/share/video/7123456789012345678/','chrome://extensions/'])assert.equal(scanPlatform(url),'');
});
test('TikTok page reader retains complete video IDs and rejects unrelated links',()=>{
 assert.equal(tiktokVideoUrl('/@cook/video/7123456789012345678?tracking=private'),'https://www.tiktok.com/@cook/video/7123456789012345678');
 assert.equal(tiktokVideoUrl('https://www.tiktok.com/share/video/7123456789012345678/'),'https://www.tiktok.com/video/7123456789012345678');
 for(const url of ['/foryou','/@cook','/@cook/photo/7123456789012345678','https://evil.test/@cook/video/7123456789012345678'])assert.equal(tiktokVideoUrl(url),'');
});
test('TikTok caption reader rejects generic controls and image descriptions without inventing context',()=>{
 for(const value of ['TikTok - Make Your Day','Video cover','Video by @cook','Play','Watch this video','12.5K views','Photo by Someone. May be an image of food.','Log in to TikTok'])assert.equal(tiktokCaptionText(value),'');
 assert.equal(tiktokCaptionText('Pasta recipe. Cook pasta in boiling water.'),'Pasta recipe. Cook pasta in boiling water.');
 assert.equal(tiktokCaptionText('361.2K Likes, 10.2K Comments. TikTok video from Test (@cook): "Pasta recipe. Cook pasta in boiling water."'),'Pasta recipe. Cook pasta in boiling water.');
});

import {normalizeReel,mergeReels} from '../src/core.js';
test('scanner version upgrades do not reset manual captions, transcripts or filter decisions',()=>{
 const old={...normalizeReel({url:'https://www.tiktok.com/@cook/video/7123456789012345678',caption:'Pasta recipe. Cook pasta in boiling water.',transcript:'My pasted transcript',captionSource:'manual'}),status:'ignored',listDismissed:true};
 const result=mergeReels([old],[{url:old.url,caption:'A different caption',transcript:'Another transcript',captureVersion:2}])[0];
 assert.equal(result.caption,old.caption);assert.equal(result.transcript,old.transcript);assert.equal(result.status,'ignored');assert.equal(result.listDismissed,true);
});
