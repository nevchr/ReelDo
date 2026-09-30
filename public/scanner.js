(() => {
  if (globalThis.__reeldoRunning) return;
  if (!/^https:\/\/(www\.)?instagram\.com\//.test(location.href)) return;
  if (!globalThis.ReelDoCapture) throw new Error('Reload ReelDo before scanning: the caption reader is missing.');
  globalThis.__reeldoRunning = true;
  const limit = Math.min(100, Math.max(1, Number(globalThis.__reeldoLimit) || 50));
  let stopped = false;
  let known = new Set();
  const records = new Map();
  let localCaptureUnavailable=false;
  const previousPanel = document.getElementById('reeldo-scan-panel'); previousPanel?.remove();
  const panel = document.createElement('div'); panel.id = 'reeldo-scan-panel';
  Object.assign(panel.style, { position: 'fixed', bottom: '24px', right: '24px', width: '300px', padding: '20px', background: '#faf9f6', color: '#273532', border: '1px solid #d8e9e6', borderRadius: '14px', boxShadow: '0 10px 40px #0002', zIndex: '2147483647', font: '14px/1.5 system-ui' });
  const heading = document.createElement('strong'); heading.textContent = 'ReelDo · reading your saves';
  const label = document.createElement('p'); label.setAttribute('role','status'); label.textContent = 'Finding reels on this page…';
  const stop = document.createElement('button'); stop.textContent = 'Stop scan';
  Object.assign(stop.style, { padding: '8px 14px', background: '#1c7b69', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer' });
  stop.onclick = () => { stopped = true; stop.disabled = true; label.textContent = 'Stopping after the current request…'; };
  panel.append(heading, label, stop); document.body.append(panel);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function send(message) { const result = await chrome.runtime.sendMessage(message); if (result?.error) throw new Error(result.error); return result; }
  async function progress(message, running = true) { label.textContent = message; await send({ type: 'SCAN_PROGRESS', scan: { running, count: records.size, message } }); }
  function canonical(input) {
    try { const u = new URL(input, location.origin); const m = u.pathname.match(/^\/(?:reels?|p)\/([A-Za-z0-9_-]+)\/?$/); return ['www.instagram.com','instagram.com'].includes(u.hostname) && m ? `https://www.instagram.com/${u.pathname.startsWith('/p/') ? 'p' : 'reel'}/${m[1]}/` : ''; } catch { return ''; }
  }
  function add(url, container, isDetail = false, grid = null, media = null) {
    if (!url || (!records.has(url) && records.size >= limit)) return;
    if (!isDetail && known.has(url.split('/').filter(Boolean).at(-1))) return;
    const existing = records.get(url);
    const content = globalThis.ReelDoCapture.detailCaption(container) || grid;
    media ||= globalThis.ReelDoCapture.detailThumbnail(container, isDetail ? document : null);
    const caption = content?.caption || '';
    const creatorLink = container?.querySelector('header a[href]');
    const creator = creatorLink?.textContent?.trim() || '';
    if (existing && !caption && !media?.thumbnail) return;
    records.set(url, { ...existing, ...content, ...media, thumbnail:media?.thumbnail || existing?.thumbnail || '', url, title: caption ? caption.split(/\n|(?<=[.!?])\s/)[0].slice(0,120) : existing?.title || 'Saved reel', creator: creator || existing?.creator || '', caption: caption || existing?.caption || '', capturedAt: new Date().toISOString() });
  }
  function collect() {
    const current = canonical(location.href);
    if (current) add(current, document.querySelector('[role="dialog"]') || document.querySelector('article') || document, true);
    for (const anchor of document.querySelectorAll('a[href*="/reel/"],a[href*="/reels/"],a[href*="/p/"]')) {
      if (panel.contains(anchor)) continue;
      const url = canonical(anchor.href); const article = anchor.closest('article');
      const articleLinks = article ? new Set([...article.querySelectorAll('a[href]')].map(a=>canonical(a.href)).filter(Boolean)) : new Set();
      add(url, articleLinks.size === 1 ? article : null, false, globalThis.ReelDoCapture.gridCaption(anchor), globalThis.ReelDoCapture.gridThumbnail(anchor));
    }
  }
  function selectedImages() {
    return [...document.querySelectorAll('a[href*="/reel/"],a[href*="/reels/"],a[href*="/p/"]')].map(a=>({anchor:a,url:canonical(a.href),image:a.querySelector('img')})).filter(x=>records.has(x.url)&&x.image&&!records.get(x.url).thumbnailData);
  }
  async function cacheVisibleThumbnails() {
    if(localCaptureUnavailable||stopped)return;
    const width=innerWidth,height=innerHeight;
    const visible=selectedImages().map(x=>({...x,rect:globalThis.ReelDoCapture.thumbnailRect(x.image,width,height)})).filter(x=>x.rect&&[[2,2],[x.rect.width-2,2],[2,x.rect.height-2],[x.rect.width-2,x.rect.height-2]].every(([dx,dy])=>x.anchor.contains(document.elementFromPoint(x.rect.left+dx,x.rect.top+dy))));
    if(!visible.length)return;
    try {
      panel.style.visibility='hidden';
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const {data}=await send({type:'CAPTURE_VISIBLE'});
      if(!data){localCaptureUnavailable=true;return;}
      const bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=data;});
      // Crop only the reel's visible thumbnail; the full viewport is transient
      // and is never stored, exported, or sent off this device.
      if(innerWidth!==width||innerHeight!==height)return;
      const changed=[];
      for(const item of visible){
        if(stopped)break;
        const now=item.image.getBoundingClientRect(),r=item.rect;
        if(Math.abs(now.top-r.top)>2||Math.abs(now.left-r.left)>2)continue;
        const canvas=document.createElement('canvas');canvas.width=96;canvas.height=Math.min(160,Math.max(48,Math.round(96*r.height/r.width)));
        canvas.getContext('2d').drawImage(bitmap,r.left*bitmap.naturalWidth/width,r.top*bitmap.naturalHeight/height,r.width*bitmap.naturalWidth/width,r.height*bitmap.naturalHeight/height,0,0,canvas.width,canvas.height);
        let thumbnailData=canvas.toDataURL('image/jpeg',.65);
        if(thumbnailData.length>12000)thumbnailData=canvas.toDataURL('image/jpeg',.4);
        thumbnailData=globalThis.ReelDoCapture.safeThumbnailData(thumbnailData);
        if(thumbnailData){const reel=records.get(item.url);Object.assign(reel,{thumbnailData,mediaCaptureVersion:2});changed.push(reel);}
      }
      if(changed.length)await send({type:'CAPTURE_BATCH',reels:changed,autoSort:Boolean(globalThis.__reeldoAutoSort)});
    } catch {localCaptureUnavailable=true;} finally {panel.style.visibility='';}
  }
  function scrollContainer() {
    const candidates = [...document.querySelectorAll('main,main div,[role="main"]')];
    return candidates.find(e => e.scrollHeight > e.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) || document.scrollingElement;
  }
  function metaCaption(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {...globalThis.ReelDoCapture.metadataCaption(doc),...globalThis.ReelDoCapture.metadataThumbnail(doc)};
  }
  async function run() {
    try {
      known = new Set((await send({ type:'GET_KNOWN', autoSort:Boolean(globalThis.__reeldoAutoSort), refreshThumbnails:Boolean(globalThis.__reeldoRefreshThumbnails) }))?.ids || []);
      await progress('Finding reels on this page…');
      if(globalThis.__reeldoRefreshThumbnails&&!canonical(location.href)){
        scrollContainer()?.scrollTo({top:0,behavior:'auto'});
        await sleep(250);
      }
      let quiet = 0, rounds = 0;
      do {
        const before = records.size; collect();
        await cacheVisibleThumbnails();
        if (records.size) await send({ type: 'CAPTURE_BATCH', reels: [...records.values()],autoSort:Boolean(globalThis.__reeldoAutoSort) });
        await progress(`Found ${records.size} of up to ${limit} saved posts…`);
        if (canonical(location.href) || (records.size >= limit && (localCaptureUnavailable||!selectedImages().length)) || stopped) break;
        const scroller = scrollContainer();
        const next=Math.min(scroller.scrollHeight-scroller.clientHeight,scroller.scrollTop+Math.max(160,scroller.clientHeight*.5));
        quiet = records.size === before && next<=scroller.scrollTop ? quiet + 1 : 0;
        scroller?.scrollTo({ top: next, behavior: 'auto' });
        await sleep(1500); rounds++;
      } while (quiet < 4 && rounds < 60 && !stopped);
      let index = 0;
      for (const reel of records.values()) {
        if (stopped) break;
        index++;
        if (reel.caption && (reel.thumbnailData || reel.thumbnail)) continue;
        await progress(`Reading captions · ${index}/${records.size}. Missing captions stay available for review.`);
        try {
          const response = await fetch(new URL(new URL(reel.url).pathname, location.origin).href, { credentials: 'same-origin', signal: AbortSignal.timeout(12000) });
          if (response.status === 429 || response.status === 401 || response.status === 403) { stopped = true; await progress('Instagram limited caption access. Captured links are safe; add captions in the workspace.'); break; }
          if (response.ok) {
            const content = metaCaption(await response.text());
            if (content.caption || content.thumbnail) { Object.assign(reel, content); if (content.caption) reel.title = content.caption.split(/\n|(?<=[.!?])\s/)[0].slice(0,120); await send({ type:'CAPTURE_BATCH', reels: [reel],autoSort:Boolean(globalThis.__reeldoAutoSort) }); }
          }
        } catch { /* A missing caption must never remove a captured link. */ }
        await sleep(1200);
      }
      const captions = [...records.values()].filter(r => r.caption).length;
      const localImages=[...records.values()].filter(r=>r.thumbnailData).length;
      await progress(records.size ? `${stopped ? 'Stopped' : captions ? 'Finished' : 'Caption access incomplete'} · ${records.size} links captured, ${captions} readable captions, ${records.size-captions} missing. ${localImages} local thumbnails saved. ${localCaptureUnavailable?'Keep Instagram selected during the next scan to save local thumbnails. ':''}${captions ? 'Open ReelDo to sort them.' : 'Try another scan with the Saved grid visible; links alone cannot be sorted.'}` : 'No new reels found. Existing saves are kept. Open a Saved collection or an individual reel, then try again.', false);
    } catch (error) {
      label.textContent = `Scan stopped: ${error.message}. Captured results are kept.`;
      try { await send({ type: 'SCAN_PROGRESS', scan: { running: false, count: records.size, message: label.textContent } }); } catch {}
    } finally {
      globalThis.__reeldoRunning = false; stop.disabled = false; stop.textContent = 'Close'; stop.onclick = () => panel.remove();
    }
  }
  run();
})();
