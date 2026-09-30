(() => {
  if(globalThis.__reeldoRunning)return;
  const reader=globalThis.ReelDoCapture;
  if(!reader||reader.scanPlatform(location.href)!=='tiktok')return;
  globalThis.__reeldoRunning=true;
  const limit=Math.min(100,Math.max(1,Number(globalThis.__reeldoLimit)||50));
  const autoSort=Boolean(globalThis.__reeldoAutoSort),startUrl=location.href;
  let stopped=false,confirmed=false,known=new Set(),localCaptureUnavailable=false;
  const records=new Map();
  document.getElementById('reeldo-scan-panel')?.remove();
  const panel=document.createElement('div');panel.id='reeldo-scan-panel';
  Object.assign(panel.style,{position:'fixed',bottom:'24px',right:'24px',width:'300px',maxWidth:'calc(100vw - 48px)',padding:'20px',background:'#faf9f6',color:'#273532',border:'1px solid #d8e9e6',borderRadius:'14px',boxShadow:'0 10px 40px #0002',zIndex:'2147483647',font:'14px/1.5 system-ui'});
  const heading=document.createElement('strong');heading.textContent='ReelDo — syncing TikTok favourites';
  const label=document.createElement('p');label.setAttribute('role','status');label.textContent='Checking your selected view.';
  const stop=document.createElement('button');stop.textContent='Stop sync';
  Object.assign(stop.style,{padding:'8px 14px',background:'#1c7b69',color:'#fff',border:'none',borderRadius:'7px',cursor:'pointer'});
  stop.onclick=()=>{stopped=true;stop.disabled=true;label.textContent='Stopping. Captured results are kept.';};
  panel.append(heading,label,stop);document.body.append(panel);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function send(message){const result=await chrome.runtime.sendMessage(message);if(!result||result.error)throw new Error(result?.error||'ReelDo did not respond. Reload the extension and try again.');return result;}
  async function progress(message,running=true){label.textContent=message;await send({type:'SCAN_PROGRESS',scan:{running,count:records.size,message}});}
  const canonical=input=>reader.tiktokVideoUrl(input,location.origin);
  const key=url=>'tiktok-'+url.match(/\/video\/([0-9]+)/)?.[1];
  function scope(){if(location.href!==startUrl)throw new Error('TikTok changed pages. Start another sync on the view you want.');return reader.tiktokScope(document,location.href,confirmed);}
  function anchors(root){return [...root.querySelectorAll('a[href*="/video/"],a[href*="/v/"]')].filter(a=>!panel.contains(a)&&!a.closest('[hidden],[aria-hidden="true"],[data-e2e="recommend-list"],[data-e2e="related-videos"]')&&canonical(a.href));}
  function add(input,isDetail=false){
    if(!input?.url)return;const id=key(input.url);
    if(!records.has(id)&&records.size>=limit)return;
    if(!isDetail&&known.has(id))return;
    const old=records.get(id);
    records.set(id,{...old,...input,caption:input.caption||old?.caption||'',capturedAt:old?.capturedAt||new Date().toISOString()});
  }
  function collect(view){
    if(view.type==='detail'){
      const anchor=document.createElement('a');anchor.href=view.url;
      const input=reader.tiktokItem(anchor,true,document);if(input)add(input,true);
    }else for(const a of anchors(view.root))add(reader.tiktokItem(a));
  }
  function selectedImages(){
    const view=scope();if(!['detail','favourites'].includes(view.type))return [];
    return anchors(view.root).map(a=>({anchor:a,url:key(canonical(a.href)),image:a.querySelector('img')})).filter(x=>records.has(x.url)&&x.image&&!records.get(x.url).thumbnailData);
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
      if(changed.length)await send({type:'CAPTURE_BATCH',reels:changed,autoSort});
    } catch {localCaptureUnavailable=true;} finally {panel.style.visibility='';}
  }

  function scrollContainer(root){
    const candidates=[root,...root.querySelectorAll('div')];
    return candidates.find(e=>e.scrollHeight>e.clientHeight+200&&/(auto|scroll)/.test(getComputedStyle(e).overflowY))||document.scrollingElement;
  }
  async function confirmView(){
    const check=scope();if(check.type!=='confirm')return check;
    await progress(check.message);
    const button=document.createElement('button');button.textContent='This is my Favourites view — sync';button.style.cssText=stop.style.cssText;button.style.marginTop='10px';
    panel.append(button);
    try {
      await new Promise(resolve=>{button.onclick=()=>{confirmed=true;resolve();};const poll=setInterval(()=>{if(stopped||location.href!==startUrl){clearInterval(poll);resolve();}else if(confirmed)clearInterval(poll);},200);});
    }finally{button.remove();}
    if(stopped)throw new Error('Sync cancelled before collecting any videos.');
    return scope();
  }
  async function run(){
    try {
      let view=await confirmView();
      if(!['favourites','detail'].includes(view.type))throw new Error(view.message);
      known=new Set((await send({type:'GET_KNOWN',platform:'tiktok',autoSort,refreshThumbnails:Boolean(globalThis.__reeldoRefreshThumbnails)})).ids||[]);
      if(globalThis.__reeldoRefreshThumbnails&&view.type==='favourites'){scrollContainer(view.root)?.scrollTo({top:0,behavior:'auto'});await sleep(200);}
      await progress('Reading the visible TikTok '+(view.type==='detail'?'video':'favourites')+'.');
      let quiet=0,rounds=0;
      do{
        view=scope();if(!['detail','favourites'].includes(view.type))throw new Error(view.message||'Your selected TikTok view changed. Start another sync.');
        const before=records.size;collect(view);
        if(stopped)break;
        await cacheVisibleThumbnails();
        if(records.size)await send({type:'CAPTURE_BATCH',reels:[...records.values()],autoSort});
        await progress('Synced '+records.size+' of up to '+limit+' videos.');
        if(view.type==='detail'||records.size>=limit||stopped)break;
        const scroller=scrollContainer(view.root),next=Math.min(scroller.scrollHeight-scroller.clientHeight,scroller.scrollTop+Math.max(160,scroller.clientHeight*.5));
        quiet=records.size===before&&next<=scroller.scrollTop?quiet+1:0;
        scroller.scrollTo({top:next,behavior:'auto'});await sleep(900);rounds++;
      }while(quiet<3&&rounds<60&&!stopped);
      const captions=[...records.values()].filter(r=>r.caption).length,images=[...records.values()].filter(r=>r.thumbnailData).length;
      await progress(records.size?(stopped?'Stopped':'Finished')+' — '+records.size+' videos synced; '+captions+' readable captions; '+(records.size-captions)+' missing captions; '+images+' local thumbnails. '+(autoSort?'Readable captions were sorted with local rules. ':'Open ReelDo and sort when ready. ')+'Missing or ambiguous context stays reviewable. This bounded sync does not prove the full collection was reached.':stopped?'Stopped. Previously captured results are kept.':'No new videos found in the visible view. Existing saves are kept. Revisit existing favourites to repair captions; an empty or unavailable favourites view cannot be confirmed.',false);
    }catch(e){
      label.textContent='Sync stopped: '+e.message+' Captured results are kept.';
      try{await send({type:'SCAN_PROGRESS',scan:{running:false,count:records.size,message:label.textContent}});}catch{}
    }finally{
      globalThis.__reeldoRunning=false;stop.disabled=false;stop.textContent='Close';stop.onclick=()=>panel.remove();
    }
  }
  run();
})();
