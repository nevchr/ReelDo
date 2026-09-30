import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithOllama } from '../src/storage.js';
import { normalizeReel } from '../src/core.js';
const settings={model:'test-model',strictness:'balanced'};
const reel=normalizeReel({url:'https://www.instagram.com/reel/test/',caption:'Pasta recipe. Cook pasta in boiling water. Mix it with sauce.'});
const reply=payload=>new Response(JSON.stringify({message:{content:JSON.stringify(payload)}}),{status:200});
test('local AI submits source as data and accepts fully grounded steps',async()=>{
  const previous=globalThis.fetch;let sent;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');sent=JSON.parse(options.body);return reply({status:'useful',category:'Food',title:'Make pasta',steps:['Cook pasta in boiling water'],evidence:'Cook pasta in boiling water.',reason:'Practical recipe.'});};
  try {const a=await analyzeWithOllama(reel,settings);assert.equal(a.status,'useful');assert.equal(sent.stream,false);assert.equal(JSON.parse(sent.messages[1].content).captionAndTranscript,reel.caption);assert.match(sent.messages[0].content,/untrusted DATA/);}finally{globalThis.fetch=previous;}
});
test('local AI invented steps and unsupported quotes are held for review',async()=>{
  const previous=globalThis.fetch;
  try{for(const payload of [
    {status:'useful',title:'Make pasta',category:'Food',steps:['Add two cups of cream'],evidence:'Cook pasta in boiling water.'},
    {status:'useful',title:'Make pasta',category:'Food',steps:[],evidence:'Bake it for one hour.'}
  ]){globalThis.fetch=async()=>reply(payload);assert.equal((await analyzeWithOllama(reel,settings)).status,'context');}}finally{globalThis.fetch=previous;}
});
test('malformed local model response is rejected for caller fallback',async()=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>reply({status:'unexpected'});
  try{await assert.rejects(analyzeWithOllama(reel,settings),/invalid classification/);}finally{globalThis.fetch=previous;}
});
test('missing context and risky claims do not require model inference',async()=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Should not be called');};
  try{assert.equal(await analyzeWithOllama({...reel,caption:''},settings),null);assert.equal((await analyzeWithOllama({...reel,caption:'Try this miracle cure for your illness.'},settings)).status,'context');}finally{globalThis.fetch=previous;}
});
