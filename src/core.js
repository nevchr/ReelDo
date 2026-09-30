import { cleanCaption, safeThumbnail, safeThumbnailData } from './capture.js';
export const CATEGORIES = ['All', 'Movies', 'Tech', 'Food', 'Fitness', 'Learn', 'Home', 'Travel', 'Money', 'Other'];
export const INITIAL = { version: 1, listVersion: 1, reels: [], tasks: [], settings: { strictness: 'balanced', engine: 'rules', model: '', theme: 'light' }, scan: null };
export function normalizeUrl(input) {
  try {
    const u = new URL(String(input).trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    if (['tiktokv.com','www.tiktokv.com'].includes(u.hostname)) {
      const video=u.pathname.match(/^\/share\/video\/([0-9]{8,25})\/?$/);
      return video ? 'https://www.tiktokv.com/share/video/'+video[1]+'/' : '';
    }
    if (['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)) {
      const video=u.pathname.match(/^\/(?:@[A-Za-z0-9_.]+\/video\/|video\/|share\/video\/|v\/)([0-9]{8,25})(?:\.html)?\/?$/);
      if(!video)return '';
      const author=u.pathname.match(/^\/@([A-Za-z0-9_.]+)\/video\//);
      return 'https://www.tiktok.com/'+(author?'@'+author[1]+'/':'')+'video/'+video[1];
    }
    if (!['instagram.com', 'www.instagram.com'].includes(u.hostname)) return '';
    const match = u.pathname.match(/^\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `https://www.instagram.com/${u.pathname.startsWith('/p/') ? 'p' : 'reel'}/${match[1]}/` : '';
  } catch { return ''; }
}
export function idFor(url) { const normalized=normalizeUrl(url); return normalized.match(/^https:\/\/www\.tiktok(?:v)?\.com\//) ? 'tiktok-'+normalized.split('/').filter(Boolean).at(-1) : normalized.split('/').filter(Boolean).at(-1); }
export function sourceLabel(reel) { return reel?.url?.match(/^https:\/\/www\.tiktok(?:v)?\.com\//) ? 'TikTok favourite' : 'Instagram save'; }
export function textValue(x, max = 12000) { return typeof x === 'string' ? x.trim().slice(0, max) : ''; }
export function normalizeReel(input) {
  const url = normalizeUrl(input?.url || input?.href || input?.link);
  if (!url) throw new Error('Use a complete Instagram reel/post or TikTok video link. TikTok short share links must be opened and replaced with the full video URL.');
  return { id: idFor(url), url, platform: url.match(/^https:\/\/www\.tiktok(?:v)?\.com\//) ? 'tiktok' : 'instagram', savedAt: textValue(input.savedAt || input.Date, 100), title: textValue(input.title, 180) || 'Saved reel', creator: textValue(input.creator, 100) || (url.match(/\/@([^/]+)\/video\//)?.[1] || ''), thumbnail:safeThumbnail(input.thumbnail), thumbnailData:safeThumbnailData(input.thumbnailData), mediaCaptureVersion:[1,2].includes(input.mediaCaptureVersion)?input.mediaCaptureVersion:0, caption: cleanCaption(textValue(input.caption || input.text)), captionSource: ['grid','page','metadata','manual','import'].includes(input.captionSource) ? input.captionSource : 'import', captureVersion: Number(input.captureVersion) === 2 ? 2 : 0, transcript: textValue(input.transcript), capturedAt: input.capturedAt || new Date().toISOString(), demo: Boolean(input.demo), status: 'inbox' };
}
export function mergeReels(existing, incoming) {
  const map = new Map(existing.map(r => [r.id, r]));
  for (const input of incoming) {
    const r = normalizeReel(input), old = map.get(r.id);
    if (!old) map.set(r.id, r);
    else if ((r.caption && r.caption !== old.caption && old.captionSource !== 'manual') || (r.transcript && r.transcript !== old.transcript && old.captionSource !== 'manual') || (r.captureVersion > (old.captureVersion || 0) && old.captionSource !== 'manual')) {
      map.set(r.id, { ...old, caption: old.captionSource === 'manual' ? old.caption : r.caption || old.caption, captionSource: old.captionSource === 'manual' ? 'manual' : r.caption ? r.captionSource : old.captionSource, captureVersion: Math.max(r.captureVersion, old.captureVersion || 0), transcript: old.captionSource === 'manual' ? old.transcript : r.transcript || old.transcript, title: r.title === 'Saved reel' || old.captionSource === 'manual' ? old.title : r.title, creator: r.creator || old.creator, status: 'inbox', analysis: undefined });
    }
    if (old && !old.savedAt && r.savedAt) map.set(r.id,{...map.get(r.id),savedAt:r.savedAt});
    const latest=map.get(r.id);
    if (old && (r.thumbnail || r.thumbnailData || r.mediaCaptureVersion)) map.set(r.id,{...latest,thumbnail:r.thumbnail || latest.thumbnail,thumbnailData:r.thumbnailData || latest.thumbnailData || '',mediaCaptureVersion:Math.max(r.mediaCaptureVersion,latest.mediaCaptureVersion||0)});
  }
  const result=[...map.values()];let budget=0;
  for(let i=result.length-1;i>=0;i--){const r=result[i];if(r.thumbnailData){budget+=r.thumbnailData.length;if(budget>4000000)result[i]={...r,thumbnailData:''};}}
  return result;
}
const categoryPatterns = [
  ['Tech', /\b(ai|artificial intelligence|llm|chatgpt|claude|gemini|openai|software|apps?|coding|code|python|javascript|computer vision|webdevelopment|website|favicon|github|open.source|technology|tech)\b/i],
  ['Food', /\b(recipe|cook|bake|meal|meals|pasta|chicken|tofu|salad|ingredient|overnight oats|breakfast|dinner|lunch|rice|sauce|potato|coffee|espresso|healthyrecipes|mealideas)\b/i],
  ['Fitness', /\b(workout|exercise|stretch|mobility|squat|deadlift|push.?up|fitness|gym|running|yoga)\b/i],
  ['Money', /\b(budget|saving|savings|financial|finance|invest|money|expense|debt)\b/i],
  ['Travel', /\b(visit|hike|trail|travel|trip|itinerary|museum|cafe|café|restaurant|vacation|ottawa|montreal|kyoto)\b/i],
  ['Home', /\b(clean|organize|declutter|shelf|shelves|laundry|plant|garden|desk|repair|room|storage|shower|decor|homedecor|eucalyptus|lamp)\b/i],
  ['Learn', /\b(learn|study|tutorial|course|practice|code|coding|python|javascript|photography|guitar|draw|language|skill|portfolio|internship|internships|career|resume|computerscience|computer vision|webdevelopment|website|favicon|fl studio|flstudio|github|open.source)\b/i],
];
const noise = /\b(meme|memes|brainrot|skibidi|shitpost|shitposting|prank|rage.?bait|lip.?sync|funny|funniest|relatable|pov|lmao|rofl|satire|sitcom|comed[yic]+)\b/i;
const danger = /\b(cure|diagnos\w*|medication|dosage|guaranteed returns|double your money|risk.?free|miracle|medical advice)\b/i;
const imperative = /^(?:(?:step\s*\d+|\d+)\s*[.):—-]?\s*)?(try|make|cook|bake|mix|add|stir|pour|whisk|preheat|season|drain|transfer|knead|grill|chop|boil|simmer|roast|blend|heat|serve|learn|practice|study|build|create|set|turn on|turn off|start|visit|walk|hike|book|plan|save|budget|track|write|read|watch|stretch|hold|rest|breathe|sit|stand|lift|do|repeat|clean|clear|organize|declutter|plant|water|repair|install|use|take|shoot|fold|put|spend|schedule|replace|arrange|sort|choose|open|cut|remove|check|explore|research|apply|download|generate|head to)\b/i;
function sentences(text) {
  return text.replace(/[0-9]\uFE0F?\u20E3/g,match=>'\n'+match[0]+'. ').replace(/https?:\/\/\S+/g, '').replace(/#[\p{L}\p{N}_]+/gu, '').split(/\n+|(?<=[.!?])\s+(?![0-9])/).map(s => s.replace(/^[\s•*\-\p{Extended_Pictographic}\uFE0F]+/gu, '').replace(/^(?:step\s*)?\d+[.):—-]\s*/i,'').trim()).filter(s => s.length > 8 && s.length < 420);
}
function tidyAction(s) {
  const cleaned = s.replace(/^(?:(?:step\s*\d+|\d+)\s*[.):—-]?\s*)/i, '').replace(/[.!]$/, '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
export function conciseTopic(reel, fallback = '') {
  const source = cleanCaption(reel.caption) || reel.transcript || (reel.title !== 'Saved reel' ? reel.title : '') || fallback;
  const line = source.replace(/https?:\/\/\S+/g, '').replace(/#[\p{L}\p{N}_]+/gu, '').split(/\n|(?<=[.!?])\s/).map(s => s.replace(/^[\s•*\-\p{Extended_Pictographic}\uFE0F]+/gu, '').trim()).find(s => s.length > 5) || fallback;
  const clean = line.replace(/\s+/g,' ').replace(/[\s.!:\p{Extended_Pictographic}\uFE0F]+$/gu,'').trim();
  return clean.length <= 76 ? clean : `${clean.slice(0,73).replace(/\s+\S*$/,'')}…`;
}
function movieTopic(reel, text) {
  const named = text.match(/(?:movie|film|title|name)\s*[:=\-]\s*([^\n#]+)/i) || text.match(/(?:watch|recommend(?:ing)?)\s+[“"]([^”"\n]+)[”"]/i);
  if (named) return named[1].replace(/[.!]+$/,'').trim().slice(0,76);
  return conciseTopic(reel).replace(/,?\s+(?:an?\s+)?(?:entertaining\s+)?(?:movie|film)\s+edit\b.*$/i,'').replace(/\s*[|—-]\s*(?:movie|film)\s*(?:edit|clip).*$/i,'').trim() || 'Movie from this reel';
}
export function classify(reel, strictness = 'balanced') {
  const text = [cleanCaption(reel.caption), reel.transcript].filter(Boolean).join('\n').trim();
  const firstLine = text.split(/\n|[.!?]/)[0];
  const scored = categoryPatterns.map(([name,p]) => ({ name, score: (text.match(new RegExp(p.source,'gi')) || []).length + (p.test(firstLine) ? 4 : 0) })).sort((a,b)=>b.score-a.score);
  const category = scored[0].score ? scored[0].name : 'Other';
  const lines = sentences(text), actions = lines.filter(s => imperative.test(s) && !/^(?:save|watch|check|open) (?:this|the reel|my|our|link|bio|part \d)|^(?:take|make) (?:sure|a look)/i.test(s));
  const meme = noise.test(text), hasTopic = category !== 'Other';
  const result = { category, method: 'Local rules', steps: [], title: '', evidence: '', reason: '' };
  const practicalSignal = /\b(tutorial|how to|recipe|workout|internships?|career|resume|study|learn)\b/i.test(text);
  const movieSignal = /\b(movies?|films?|cinema|trailer|watchlist|tv series)\b|#(?:MovieEdit|FilmEdit|MovieReels|FilmClip|CinematicEdits?)\b/iu.test(text);
  if (movieSignal && !/\b(filmmaking|film making|film photography|how to film|camera tutorial|ai (?:video|film)|video model)\b/i.test(text) && !practicalSignal) return { ...result, category:'Movies', status:'useful', title:movieTopic(reel,text), evidence:text.split('\n')[0].slice(0,600), reason:'Saved to your movie watchlist. Unnamed movies keep their caption context.' };
  if ((meme && !actions.length) || (/#[\p{L}\p{N}_]*(?:MovieEdit|FilmEdit|MovieReels|FilmClip|CinematicEdits?|genjutsu|twitchclips|horrorgames|psychologicalhorror)\b/iu.test(text) && !practicalSignal)) return { ...result, status: 'ignored', reason: 'Entertainment signals, with no concrete action to take.' };
  if (text.replace(/#[\p{L}\p{N}_]+/gu, '').trim().length < 20) return { ...result, status: 'context', reason: 'No readable caption or transcript. Add context before deciding.' };
  if (danger.test(text)) return { ...result, status: 'context', reason: 'Contains health or financial claims that need your judgement.' };
  if (meme && !actions.length) return { ...result, status: 'ignored', reason: 'Entertainment signals, with no concrete action to take.' };
  if (meme && actions.length && (strictness === 'strict' || !hasTopic)) return { ...result, status: 'context', reason: 'Mixes entertainment with instructions. Review the context.' };
  if (category === 'Tech' && !meme) return { ...result, status:'useful', title:tidyAction(conciseTopic(reel,'Explore this technology').replace(/^How to\s+/i,'')), steps:[...new Set(actions.map(tidyAction))].slice(0,8), evidence:lines[0] || text.slice(0,600), reason:'A technology topic saved directly to Tech. Only instructions present in the caption become checklist steps.' };
  const howTo = text.match(/\bHow to\s+([^\n]+?)(?:[⤵👇]|$)/im);
  if (!actions.length && hasTopic && !meme) {
    const evidence = lines.find(s => s.length >= 20) || text.split('\n')[0];
    if (howTo || /\btutorial\b/i.test(text)) return { ...result, status:'useful', title:howTo ? tidyAction(howTo[1]).slice(0,150) : `Learn from this tutorial: ${text.split('\n')[0].replace(/#[\p{L}\p{N}_]+/gu,'').replace(/[!⤵👇]/g,'').trim()}`.slice(0,150), evidence, reason:'A named tutorial to learn from. Detailed steps are not in this caption.' };
    if (/\b(internships?|early.career|resume template)\b/i.test(text)) return { ...result,status:'useful',title:'Research the career opportunities in this reel',evidence,reason:'A specific career lead to research. Verify eligibility and availability at the source.' };
    if (/https:\/\/(?:www\.)?github\.com\/[\w-]+\/[\w.-]+/i.test(text)) return { ...result,status:'useful',title:'Explore the development tool linked in this reel',evidence,reason:'A named tool with a project link. No implementation steps were invented.' };
    if (category==='Home' && /\b(eucalyptus|shower|pendant lamp|coffee nook)\b/i.test(text) && evidence.length>=35) return { ...result,status:'useful',title:/eucalyptus/i.test(text)?'Explore a eucalyptus shower setup':`Explore this home idea: ${evidence}`.slice(0,150),evidence,reason:'A concrete home idea to explore. This caption does not provide a complete checklist.' };
  }
  if (!actions.length || (!hasTopic && strictness !== 'open')) return { ...result, status: 'context', reason: 'No clear practical action found. You can add one yourself.' };
  const steps = [...new Set(actions.map(tidyAction))].slice(0, 8);
  let title = steps[0].slice(0, 150);
  if (howTo) title = tidyAction(howTo[1]).slice(0,150);
  // A descriptive first line is retained only when it names the same practical topic.
  const heading = lines[0];
  if (!howTo && !imperative.test(heading) && heading.length < 90 && !noise.test(heading) && categoryPatterns.find(([c]) => c === category)?.[1].test(heading)) {
    const verbs = { Food: 'Make', Fitness: 'Try', Learn: 'Learn', Home: 'Try', Travel: 'Plan', Money: 'Try' };
    title = `${verbs[category] || 'Try'} ${heading.replace(/[.!:]$/, '').charAt(0).toLowerCase()}${heading.replace(/[.!:]$/, '').slice(1)}`;
  }
  return { ...result, status: 'useful', title, steps, evidence: actions[0], reason: meme ? 'Practical instructions found alongside humour.' : 'Contains concrete instructions you can turn into a task.' };
}
export function analyzeReels(reels, settings) { return reels.map(r => { if (r.status !== 'inbox') return r; const analysis = classify(r, settings.strictness); return { ...r, status: analysis.status, analysis }; }); }
export function taskFromReel(reel) {
  if (!reel.analysis?.title) throw new Error('Add a task title first.');
  return { id: `reel-${reel.id}`, reelId: reel.id, title: reel.analysis.category==='Movies' || reel.analysis.method==='Reviewed by you' ? reel.analysis.title : conciseTopic(reel,reel.analysis.title), category: reel.analysis.category, autoGenerated:true, done: false, starred: false, due: '', notes: '', steps: reel.analysis.steps.map((text, i) => ({ id: `step-${i}`, text, done: false })), createdAt: new Date().toISOString(), demo: reel.demo };
}
export function organizeWorkspace(state) {
  const migrate = state.listVersion !== 1;
  const reels = state.reels.map(r => {
    if (!migrate || r.status==='inbox' || r.analysis?.method==='Reviewed by you' || r.listDismissed) return r;
    const analysis=classify(r,state.settings.strictness);
    return {...r,status:analysis.status,analysis};
  });
  const tasks=state.tasks.filter(t => !t.autoGenerated || !reels.some(r=>r.id===t.reelId && (r.status==='ignored'||r.listDismissed))).map(t=>{
    const r=reels.find(r=>r.id===t.reelId);
    if (!t.autoGenerated || r?.status!=='useful' || !r.analysis?.title) return t;
    const generated=taskFromReel(r);
    return {...t,title:generated.title,category:generated.category,steps:generated.steps.map(s=>({...s,done:t.steps.find(old=>old.text===s.text)?.done||false}))};
  });
  for (const r of reels) if (r.status==='useful' && r.analysis?.title && !r.listDismissed && !tasks.some(t=>t.reelId===r.id)) tasks.push(taskFromReel(r));
  return {...state,listVersion:1,reels,tasks};
}
// Limit export parsing to explicitly named favourite-video sections.
const favouriteKeys=new Set(['favorite videos','favourite videos','favoritevideolist','favouritevideolist']);
function favouriteRecords(value) {
  const sections=[];let visited=0;
  function visit(node,depth=0) {
    if(++visited>50000||depth>20)throw new Error('This JSON structure is too complex. Choose the Favorite Videos file instead.');
    if(!node||typeof node!=='object'||Array.isArray(node))return;
    for(const [key,child] of Object.entries(node)) {
      if(favouriteKeys.has(key.toLowerCase())) {
        if(Array.isArray(child))sections.push(child);
        else if(child&&typeof child==='object') {
          const list=child.FavoriteVideoList??child.FavouriteVideoList;
          if(Array.isArray(list))sections.push(list);
          else throw new Error('Unsupported Favorite Videos section. Expected FavoriteVideoList.');
        } else throw new Error('The Favorite Videos section is not a list.');
      } else visit(child,depth+1);
    }
  }
  visit(value);return sections.length?sections.flat():null;
}
export function parseImportDetailed(raw) {
  if(typeof raw!=='string')throw new Error('Choose a JSON or text file.');
  if(raw.length>10000000||new TextEncoder().encode(raw).length>10000000)throw new Error('Choose a text file smaller than 10 MB.');
  const text=raw.replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('Add at least one reel link and caption.');
  if(text.startsWith('PK'))throw new Error('Extract the ZIP first, then choose the JSON export or Favorite Videos.txt.');
  let records=[],format='Links and captions',partial=false;
  if(text.startsWith('{')||text.startsWith('[')) {
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('This JSON file is not valid.');}
    if(parsed?.version===1&&Array.isArray(parsed.tasks))throw new Error('Use Restore a ReelDo workspace backup to keep its tasks and preferences.');
    const favourites=favouriteRecords(parsed);
    if(favourites!==null){records=favourites;format='TikTok favourites export';partial=true;}
    else if(Array.isArray(parsed))records=parsed;
    else if(Array.isArray(parsed?.reels))records=parsed.reels;
    else throw new Error('No Favorite Videos section found. Choose a TikTok JSON export, Favorite Videos.txt, or an array of reels. Liked videos and watch history are not favourites.');
  } else if(/^\s*Link\s*:/im.test(text)&&/^\s*Date\s*:/im.test(text)) {
    format='TikTok favourites text';partial=true;let current;
    for(const line of text.split(/\r?\n/)) {
      const date=line.match(/^\s*Date\s*:\s*(.*)$/i),link=line.match(/^\s*Link\s*:\s*(.*)$/i);
      if(date){current={savedAt:date[1]};records.push(current);}
      else if(link){if(!current||current.url){current={};records.push(current);}current.url=link[1];}
    }
  } else {
    let current;
    for(const line of text.split(/\r?\n/)) {
      const match=line.match(/https:\/\/[^\s<>"']+/);
      if(match&&normalizeUrl(match[0])){current={url:match[0],caption:line.replace(match[0],'').trim()};records.push(current);}
      else if(/https:\/\/(?:[\w.-]+\.)?tiktok\.com\//i.test(line))throw new Error('Use a full TikTok video URL. Open short share links and copy the full video link; ReelDo does not resolve redirects.');
      else if(current)current.caption+='\n'+line;
    }
    if(!records.length)throw new Error('No Instagram reel/post or TikTok video links found.');
  }
  if(records.length>2000)throw new Error('Import up to 2,000 reels at a time. Split the favourites list into smaller files.');
  if(!records.length)throw new Error('There are no favourite videos or reels in this file.');
  const valid=[];let skipped=0;
  for(const record of records) {
    try {
      if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Invalid video record.');
      const input=partial?{url:record.Link??record.link??record.url,savedAt:record.Date??record.savedAt,caption:record.caption??record.Caption??record.text,title:record.title,creator:record.creator,transcript:record.transcript}:record;
      if(partial&&!normalizeUrl(input.url).match(/^https:\/\/www\.tiktok(?:v)?\.com\//))throw new Error('Not a TikTok video link.');
      valid.push(normalizeReel(input));
    }catch(error){if(!partial)throw error;skipped++;}
  }
  if(!valid.length)throw new Error('No valid TikTok video links found. '+skipped+' invalid records; use complete TikTok video URLs, not short share links.');
  const reels=mergeReels([],valid);
  return {reels,format,skipped,duplicates:valid.length-reels.length,withoutContext:reels.filter(r=>!r.caption&&!r.transcript).length};
}
export function parseImport(raw){return parseImportDetailed(raw).reels;}
export function validateBackup(value) {
  if (value?.version !== 1 || !Array.isArray(value.reels) || !Array.isArray(value.tasks)) throw new Error('Not a ReelDo backup.');
  const reels = value.reels.map(r => ({ ...normalizeReel(r), listDismissed:Boolean(r.listDismissed), status: ['inbox','context','useful','ignored'].includes(r.status) ? r.status : 'inbox', analysis: validateAnalysis(r.analysis) }));
  const tasks = value.tasks.map(t => {
    if (!t || typeof t.id !== 'string' || !textValue(t.title, 200)) throw new Error('Invalid task in backup.');
    return { id: t.id.slice(0, 100), reelId: textValue(t.reelId, 100), title: textValue(t.title, 200), category: CATEGORIES.slice(1).includes(t.category) ? t.category : 'Other', autoGenerated:Boolean(t.autoGenerated), done: Boolean(t.done), starred: Boolean(t.starred), due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '', notes: textValue(t.notes), createdAt: textValue(t.createdAt,100), demo: Boolean(t.demo), steps: (Array.isArray(t.steps) ? t.steps : []).slice(0, 20).map((s, i) => ({ id: `step-${i}`, text: textValue(s.text, 400), done: Boolean(s.done) })) };
  });
  return { ...INITIAL, listVersion:value.listVersion===1?1:0, reels, tasks, settings: { strictness: ['strict','balanced','open'].includes(value.settings?.strictness) ? value.settings.strictness : 'balanced', engine: value.settings?.engine === 'ollama' ? 'ollama' : 'rules', model: textValue(value.settings?.model, 100), theme:value.settings?.theme==='dark'?'dark':'light' } };
}
export function validateAnalysis(a) {
  if (!a) return undefined;
  return { status: ['useful','context','ignored'].includes(a.status) ? a.status : 'context', category: CATEGORIES.slice(1).includes(a.category) ? a.category : 'Other', title: textValue(a.title, 150), reason: textValue(a.reason, 600), evidence: textValue(a.evidence, 600), method: textValue(a.method, 100) || 'Local rules', steps: (Array.isArray(a.steps) ? a.steps : []).slice(0,8).filter(s => typeof s === 'string').map(s => textValue(s, 400)) };
}
