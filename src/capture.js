// Caption extraction shared by the content script and its regression tests.
export function safeThumbnail(value) {
  if (typeof value !== 'string' || value.length > 20000) return '';
  try {
    const url=new URL(value);
    const allowed=['cdninstagram.com','fbcdn.net'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host));
    return url.protocol==='https:' && allowed && !url.username && !url.password && !url.port ? url.href : '';
  } catch { return ''; }
}
export function safeThumbnailData(value) {
  return typeof value==='string' && value.length<=12000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
}
export function thumbnailRect(image, width, height) {
  if (!image?.complete || !image.naturalWidth) return null;
  const r=image.getBoundingClientRect();
  if (r.width<16 || r.height<16 || r.left<0 || r.top<0 || r.right>width || r.bottom>height) return null;
  return {left:r.left,top:r.top,width:r.width,height:r.height};
}
export function gridThumbnail(anchor) {
  const image=anchor?.querySelector('img');
  return {thumbnail:safeThumbnail(image?.currentSrc || image?.getAttribute('src') || ''),mediaCaptureVersion:1};
}
export function metadataThumbnail(doc) {
  return {thumbnail:safeThumbnail(doc?.querySelector('meta[property="og:image"]')?.content || doc?.querySelector('meta[name="twitter:image"]')?.content || ''),mediaCaptureVersion:1};
}
export function detailThumbnail(container, doc) {
  const poster=safeThumbnail(container?.querySelector('video[poster]')?.getAttribute('poster') || '');
  return poster ? {thumbnail:poster,mediaCaptureVersion:1} : metadataThumbnail(doc);
}
export function cleanCaption(value) {
  let text = typeof value === 'string' ? value.replace(/[\u200B-\u200D\uFEFF]/g,'').trim() : '';
  const wrapper = text.match(/^(?:[\d,.KMB\s]+likes?,[\s\S]*?-\s*)?([A-Za-z0-9_.]+)\s+on\s+(?:Instagram|[A-Za-z]+\s+\d{1,2},\s*\d{4}):\s*["“]([\s\S]+)$/i);
  if (wrapper) text = wrapper[2].replace(/["”]\.?\s*$/,'').trim();
  if (/^(?:Instagram|Log in|Sign up|Create an account|Watch.*reels|See photos|Join Instagram)\b/i.test(text)) return '';
  if (/^(?:(?:Photo|Image|Video) (?:by|of|shared)|May be (?:an? )?(?:image|photo))/i.test(text)) return '';
  if (/^[\d,.KMB\s]+likes?,/i.test(text)) return '';
  return text.slice(0,12000);
}
export function gridCaption(anchor) {
  // Instagram Saved places creator captions in thumbnail alt text. Generated
  // "Photo by ... May be ..." descriptions are not creator captions.
  const image = [...anchor.querySelectorAll('img[alt]')].map(img=>cleanCaption(img.getAttribute('alt'))).find(Boolean);
  if (image) return { caption: image, captionSource: 'grid', captureVersion: 2 };
  const accessible = cleanCaption(anchor.getAttribute('aria-label') || '');
  if (accessible && !/^(?:Clip|Reel|View|Open|Play)\b/i.test(accessible)) return { caption: accessible, captionSource: 'grid', captureVersion: 2 };
  return null;
}
export function detailCaption(container) {
  const element = container?.querySelector('h1,[data-reeldo-caption]');
  const caption = cleanCaption(element?.textContent || '');
  return caption ? { caption, captionSource: 'page', captureVersion: 2 } : null;
}
export function metadataCaption(doc) {
  const value = doc.querySelector('meta[property="og:description"]')?.content || doc.querySelector('meta[name="description"]')?.content || '';
  const caption = cleanCaption(value);
  const creator = value.match(/(?:^|\s-\s)([A-Za-z0-9_.]+)\s+on\s+(?:Instagram|[A-Za-z]+\s+\d{1,2},\s*\d{4}):/i)?.[1] || '';
  return caption ? { caption, creator, captionSource:'metadata', captureVersion:2 } : null;
}


export function scanPlatform(input) {
  try {
    const u=new URL(input);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
    if(['instagram.com','www.instagram.com'].includes(u.hostname))return 'instagram';
    if(['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname))return 'tiktok';
  }catch{}
  return '';
}
export function tiktokVideoUrl(input,origin='https://www.tiktok.com') {
  try {
    const u=new URL(input,origin);if(scanPlatform(u.href)!=='tiktok')return '';
    const m=u.pathname.match(/^\/(?:@[A-Za-z0-9_.]+\/video\/|video\/|share\/video\/|v\/)([0-9]{8,25})(?:\.html)?\/?$/);
    if(!m)return '';
    const author=u.pathname.match(/^\/@([A-Za-z0-9_.]+)\/video\//);
    return 'https://www.tiktok.com/'+(author?'@'+author[1]+'/':'')+'video/'+m[1];
  }catch{return '';}
}
export function tiktokCaptionText(value) {
  let text=typeof value==='string'?value.trim():'';
  if(/^(?:[\d,.KMB]+\s+likes?,?\s*[\d,.KMB]+\s+comments?\.?\s*)?TikTok video from /i.test(text))text=text.replace(/^[\s\S]{0,250}?TikTok video from [\s\S]{1,150}?:\s*/i,'').replace(/^["“]|["”]\.?$/g,'');
  if(/^(?:TikTok\b|Log in\b|Sign up\b|Make your day\b|Watch (?:this |the )?video\b|Play\b|Video (?:cover|thumbnail|by|from)\b|(?:View|Open) (?:video|post)\b|[\d,.KMB]+\s*(?:views?|likes?)$)/i.test(text))return '';
  return cleanCaption(text);
}
function shown(element) {return Boolean(element&&!element.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(element).display!=='none');}
export function tiktokScope(doc,input,confirmed=false) {
  if(scanPlatform(input)!=='tiktok')return {type:'blocked',message:'Open TikTok in this tab first.'};
  const challenge=[...doc.querySelectorAll('[id*="captcha"],[class*="captcha"],[data-e2e*="captcha"]')].find(shown);
  if(challenge)return {type:'blocked',message:'TikTok is showing a verification challenge. Complete it yourself, then start another sync.'};
  const login=[...doc.querySelectorAll('[data-e2e="login-modal"],[data-e2e="login-container"],[role="dialog"]')].find(e=>shown(e)&&/log in|sign in|sign up/i.test(e.textContent||''));
  if(login)return {type:'blocked',message:'TikTok requires sign-in. Sign in yourself and open Favourites, then start another sync.'};
  const current=tiktokVideoUrl(input);
  if(current)return {type:'detail',root:doc.querySelector('[data-e2e="browse-video"],[data-e2e="video-detail"]')||doc.querySelector('main')||doc.body,url:current};
  const u=new URL(input);
  const selected=[...doc.querySelectorAll('[role="tab"][aria-selected="true"],[data-e2e][aria-selected="true"],[data-e2e][data-state="active"],[data-e2e][aria-current="page"]')].filter(shown);
  const favourite=selected.find(e=>/favou?rites?/i.test((e.getAttribute('data-e2e')||'')+' '+(e.getAttribute('aria-label')||'')+' '+e.textContent));
  const other=selected.find(e=>/^(?:videos?|posts?|liked|likes|reposts?)$/i.test((e.textContent||'').trim())||/^(?:videos?|posts?|liked|likes|reposts?)-tab$/i.test(e.getAttribute('data-e2e')||''));
  if(other&&!favourite)return {type:'blocked',message:'Open the Favourites tab first. Posted, liked and reposted videos are not your favourites.'};
  const route=/^\/(?:favou?rites?)(?:\/|$)/i.test(u.pathname)||/^favou?rites?$/i.test(u.searchParams.get('tab')||'');
  const profile=/^\/@[A-Za-z0-9_.]+\/?$/.test(u.pathname);
  if(!favourite&&!route&&!(confirmed&&profile))return profile?{type:'confirm',message:'ReelDo cannot confirm the selected tab in this TikTok layout. Open Favourites, then confirm this view below.'}:{type:'blocked',message:'Open your TikTok profile and its Favourites tab, or open an individual video. The For You feed is not scanned.'};
  const controlled=favourite?.getAttribute('aria-controls');
  const panels=[...doc.querySelectorAll('[role="tabpanel"],[data-e2e="favorite-video-list"],[data-e2e="user-post-item-list"]')].filter(shown);
  const root=(controlled&&doc.getElementById(controlled))||panels[0]||doc.querySelector('main')||doc.body;
  return {type:'favourites',root};
}
export function tiktokItem(anchor,detail=false,doc=null) {
  const url=tiktokVideoUrl(anchor?.href||anchor?.getAttribute?.('href'));
  if(!url)return null;
  const container=anchor.closest('[data-e2e="user-post-item"],[data-e2e="favorite-video-item"],article')||anchor;
  const source=container.querySelector('[data-e2e="user-post-item-desc"],[data-e2e="video-desc"],[data-e2e="browse-video-desc"],[data-e2e="search-card-video-caption"]');
  const candidates=[source?.textContent,anchor.getAttribute('aria-label'),anchor.getAttribute('title'),anchor.querySelector('img[alt]')?.getAttribute('alt')];
  if(detail&&doc)candidates.unshift(doc.querySelector('[data-e2e="browse-video-desc"],[data-e2e="video-desc"]')?.textContent,doc.querySelector('meta[property="og:description"]')?.content);
  const caption=candidates.map(tiktokCaptionText).find(Boolean)||'';
  return {url,creator:url.match(/\/@([^/]+)\/video\//)?.[1]||'',caption,captionSource:detail?'page':'grid',captureVersion:2,title:caption?caption.split(/\n|(?<=[.!?])\s/)[0].slice(0,120):'Saved reel'};
}
