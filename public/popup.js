import {scanPlatform} from './capture.js';
const status=document.querySelector('#status'),button=document.querySelector('#scan');
let busy=false;
async function selectedTab() {return (await chrome.tabs.query({active:true,currentWindow:true}))[0];}
async function refresh() {
  try {
    const tab=await selectedTab(),platform=scanPlatform(tab?.url||'');
    button.textContent=platform==='tiktok'?'Sync TikTok favourites':platform==='instagram'?'Sync Instagram saves':'Sync saved';
    document.querySelector('#refresh-label').textContent=platform==='tiktok'?'Revisit previously captured favourites':'Refresh thumbnails on existing saves';
    status.textContent=platform==='tiktok'?'Open your Favourites tab, then sync. Accessible captions are sorted with local rules; missing captions stay in Needs context. Keep this tab selected to cache thumbnails.':platform==='instagram'?'Open a Saved collection or reel, then sync. Accessible captions are sorted with local rules. Keep Instagram selected to cache thumbnails.':'Open your Instagram Saved collection or TikTok Favourites tab first.';
  }catch(e){status.textContent=e.message;}
}
document.querySelector('#open').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('index.html')});
button.onclick=async()=>{
  if(busy)return;busy=true;button.disabled=true;
  try {
    const tab=await selectedTab(),platform=scanPlatform(tab?.url||'');
    if(!platform)throw new Error('Open your Instagram Saved collection or TikTok Favourites tab first.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:(limit,refresh,autoSort)=>{globalThis.__reeldoLimit=limit;globalThis.__reeldoRefreshThumbnails=refresh;globalThis.__reeldoAutoSort=autoSort;},args:[Number(document.querySelector('#limit').value),document.querySelector('#refresh-thumbnails').checked,document.querySelector('#auto-sort').checked]});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['reader.js',platform==='tiktok'?'tiktok-scanner.js':'scanner.js']});
    status.textContent='Sync started. Use the page progress panel to stop. Open your workspace to see results; captions that need review are kept.';
  }catch(e){status.textContent=e.message;}
  finally{busy=false;button.disabled=false;}
};
await refresh();
