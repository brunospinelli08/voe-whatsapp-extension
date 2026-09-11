// Teste local dos componentes reais + content script + bridge, sem APIs externas.
// Requer puppeteer-core (PUPPETEER_MODULE pode apontar para uma instalação existente).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('../sidebar-src/node_modules/esbuild');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const fixture = `
import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {MessageCenterDock} from './src/components/MessageCenterDock';
import {MessageCenterScreen} from './src/components/MessageCenterPanel';
import {initializeTheme} from './src/lib/theme';
import {resolveLibraryMediaUrl} from './src/lib/libraryMedia';
window.resolveLibraryMediaUrl=resolveLibraryMediaUrl;
function Sidebar() {
  const [context,setContext]=useState(window.parent.testContext);
  const [open,setOpen]=useState(false);
  useEffect(()=>{window.setContext=setContext;},[]);
  useEffect(()=>{
    window.top.activeWorkspace=context.scope.workspaceId;
    const send=()=>window.parent.postMessage({type:'VOE_CENTER_CONTEXT',context},'*');
    const listen=e=>{
      if(e.data.type==='VOE_REQUEST_CENTER_CONTEXT')send();
      if(e.data.type==='WHATSAPP_EVENT')setContext(c=>({...c,chat:e.data.payload,contact:null}));
    };
    send();window.addEventListener('message',listen);
    return()=>window.removeEventListener('message',listen);
  },[context]);
  return <><header className="app-header">Voe · Espaço Jardim</header>{open ?
    <MessageCenterScreen key={context.scope.workspaceId} context={context} onClose={()=>setOpen(false)}/> :
    <div style={{padding:16}}><strong>{context.chat?.name}</strong><p>Informações do contato preservadas</p><button id="open-fallback" onClick={()=>setOpen(true)}>Central de Mensagens</button></div>}</>;
}
const dock=location.search.includes('message-center');
if(dock)document.documentElement.classList.add('message-center-document');
initializeTheme().then(()=>createRoot(document.getElementById('root')).render(dock?<MessageCenterDock/>:<Sidebar/>));
`;

const mockStorage = `
const storageListeners=[];
window.__storageEvent=(changes,area)=>storageListeners.forEach(fn=>fn(changes,area));
window.chrome={runtime:{getURL:p=>location.origin+'/'+p,sendMessage:message=>window.top.mockRuntime(message)},storage:{
  onChanged:{addListener:fn=>storageListeners.push(fn),removeListener:fn=>{const i=storageListeners.indexOf(fn);if(i>=0)storageListeners.splice(i,1)}},
  ...Object.fromEntries(['local','session'].map(area=>[area,{
    get:async key=>{const all=window.top.storageData[area];return key?{[key]:all[key]}:{...all}},
    set:async data=>window.top.storeData(area,data),remove:async()=>{}
  }]))
}};
`;

// PCM válido para exercitar a conversão real antes do envio de áudio.
const sampleRate = 16000, sampleCount = sampleRate;
const wav = Buffer.alloc(44 + sampleCount * 2);
wav.write('RIFF', 0);wav.writeUInt32LE(36 + sampleCount * 2, 4);wav.write('WAVE', 8);wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);wav.writeUInt16LE(1, 20);wav.writeUInt16LE(1, 22);wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);wav.writeUInt16LE(2, 32);wav.writeUInt16LE(16, 34);wav.write('data', 36);wav.writeUInt32LE(sampleCount * 2, 40);
for(let i=0;i<sampleCount;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/sampleRate)*12000),44+i*2);
const wavBase64=wav.toString('base64');

const items = [
  { id: 'welcome', title: 'Recepção e qualificação', content: 'Olá, {{primeiro_nome}}! Vamos conhecer seu evento?', content_type: 'text', category: 'qualificacao', tags: ['casamento'], is_favorite: true, use_count: 12 },
  { id: 'missing', title: 'Confirmar empresa', content: 'Empresa: {{empresa}}. E-mail: {{email}}', content_type: 'text', category: 'geral' },
  { id: 'audio', title: 'Apresentação em áudio', content: '', content_type: 'audio', file_url: '/media/audio.mp3', file_name: 'apresentacao.mp3', category: 'apresentacao' },
  { id: 'image', title: 'Fotos do salão', content: 'Nosso salão para {{primeiro_nome}}', content_type: 'image', file_url: 'https://yjlogamiqdksvceiyfte.supabase.co/storage/v1/object/sign/message-library/workspace-a/image/salao.png?token=expired', file_name: 'salao.png', category: 'apresentacao' },
  { id: 'video', title: 'Tour do espaço', content: 'Conheça nosso espaço', content_type: 'video', file_url: '/media/tour.mp4', file_name: 'tour.mp4', category: 'apresentacao' },
  { id: 'document', title: 'Proposta comercial', content: '', content_type: 'document', file_url: '/media/proposta.pdf', file_name: 'proposta.pdf', category: 'proposta' },
  { id: 'carousel', title: 'Carrossel dos ambientes', content: 'Conheça os espaços', content_type: 'carousel', category: 'apresentacao', carousel_cards: [{ header_type: 'image', header_url: '/media/salao.png' }] },
  ...Array.from({length:30},(_,i)=>({ id:'follow-'+i,title:'Follow-up '+i,content:'Você gostaria de agendar uma visita?',content_type:'text',category:'follow-up' })),
];

(async () => {
  const bundle = await esbuild.build({ stdin: { resolveDir: path.join(root,'sidebar-src'), contents: fixture, loader:'tsx' },
    bundle:true,write:false,jsx:'automatic',plugins:[{name:'mock-api',setup(build){
      build.onResolve({filter:/\/voeToken$/},()=>({path:'voeToken',namespace:'mock'}));
      build.onResolve({filter:/\/workspaceStorage$/},()=>({path:'workspaceStorage',namespace:'mock'}));
      build.onResolve({filter:/\/supabaseClient$/},()=>({path:'supabaseClient',namespace:'mock'}));
      build.onLoad({filter:/.*/,namespace:'mock'},({path:p})=>({contents:p==='voeToken' ?
        `export const getVoeToken=async(_access,_user,workspace)=>'voe_'+workspace+(window.top.refreshedToken?'_new':'');export const clearVoeToken=async()=>{window.top.tokenRefreshCount++;window.top.refreshedToken=true};` : p==='workspaceStorage' ?
        `export const getActiveWorkspace=async()=>({id:window.top.activeWorkspace});` :
        `export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'},access_token:'session-token'}}}),refreshSession:async()=>{window.top.refreshCount++;return {data:{session:{user:{id:'user'},access_token:'refreshed-session-token'}}}}},storage:{from:()=>{throw new Error('A extensão não deve assinar diretamente no Storage')}},from:()=>{
          let workspace;const query={select:()=>query,eq:(key,value)=>{workspace=value;return query},order:()=>query,
          then:(resolve,reject)=>Promise.resolve({data:window.top.mockLabels(workspace),error:null}).then(resolve,reject)};return query;
        }};`,loader:'js'}));
    }}] });
  let origin;
  const server = http.createServer((req,res)=>{
    const url=new URL(req.url,origin);
    let content='',type='text/html';
    if(url.pathname==='/') content=`<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#e9edef;font:14px Arial;color:#243342}#app{height:100vh;display:flex}.app-wrapper-web{width:100%}
      #conversations{width:260px;background:#fff;padding:20px;box-sizing:border-box;border-right:1px solid #ddd}
      #main{display:flex;flex:1;min-width:0;flex-direction:column}#chat-header{padding:20px;background:#fff}
      #messages{order:1;min-height:0;flex:1;overflow:auto;padding:24px;background:#f4f0e9}#messages p{background:#fff;border-radius:7px;padding:12px;max-width:300px}
      footer{order:2;padding:12px;background:#f0f2f5}footer [contenteditable]{background:white;border:1px solid #ddd;min-height:24px;padding:10px;border-radius:8px}
    </style><div id="app" class="app-wrapper-web"><aside id="conversations">Conversas<p>Mariana Oliveira</p><p>João Silva</p></aside>
      <div id="main"><header id="chat-header">Mariana Oliveira</header><div id="messages"><p>Olá! Quero conhecer o espaço para meu casamento.</p><p>Será em outubro, para 120 convidados.</p></div><footer><div contenteditable="true" data-testid="conversation-compose-box-input" data-tab="10"></div></footer></div></div>
      <script>
      window.storageData={local:{},session:{}};
      window.storeData=(area,data)=>{Object.assign(storageData[area],data);const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));
        window.__storageEvent?.(changes,area);for(const frame of document.querySelectorAll('iframe'))frame.contentWindow.__storageEvent?.(changes,area)};
      window.testContext={scope:{userId:'user',workspaceId:'workspace-a'},chat:{phone:'5511999999999',name:'Mariana Oliveira'},contact:null};
      window.fetchCount=0;window.failLibrary=false;window.libraryItems=${JSON.stringify(items)};
      window.mockLabels=workspace=>workspace==='workspace-a'?[
        {slug:'abertura',name:'Abertura',kind:'category',sort_order:0},
        {slug:'qualificacao',name:'Qualificação Dmove',kind:'category',sort_order:1},
        {slug:'apresentacao',name:'Apresentação',kind:'category',sort_order:2},
        {slug:'casamento',name:'Casamento especial',kind:'tag',sort_order:0}
      ]:[{slug:'geral',name:'Tema B',kind:'category',sort_order:0}];
      window.mockLibrary=async scope=>{window.fetchCount++;await new Promise(r=>setTimeout(r,80));if(window.failLibrary)throw new Error('Falha simulada de rede');
        return {data:scope.workspaceId==='workspace-a'?window.libraryItems:[{id:'b',title:'Exclusiva do workspace B',content:'Mensagem B',content_type:'text',category:'geral'}]}};
      window.activeWorkspace='workspace-a';window.signStatuses=[];window.refreshCount=0;window.tokenRefreshCount=0;window.sentMedia=[];window.signedRequests=[];window.filePastes=0;window.blockVerification=false;window.delayDownload=false;
      window.mockRuntime=async message=>{
        if(message.type==='VOE_API_FETCH'){
          if(message.url.endsWith('/api/v1/message-library'))return {ok:true,status:200,body:JSON.stringify(await window.mockLibrary({workspaceId:window.activeWorkspace}))};
          const path=new URL(message.url).pathname;
          if(!path.startsWith('/api/v1/message-library/')||!path.endsWith('/media-url'))throw new Error('Rota inesperada');
          window.signedRequests.push({path,method:message.init.method,body:message.init.body,authorization:message.init.headers.Authorization});
          const status=window.signStatuses.shift()||200;
          return {ok:true,status,body:JSON.stringify(status===200?{signedUrl:window.location.origin+'/media/salao.png'}:{error:status===403?'Arquivo fora do workspace selecionado.':'Arquivo indisponível na biblioteca.'})};
        }
        if(window.delayDownload)await new Promise(r=>window.releaseDownload=r);return {ok:true,base64:message.url.includes('.mp3')?'${wavBase64}':'aGVsbG8=',contentType:message.url.includes('.mp3')?'audio/mpeg':message.url.includes('.mp4')?'video/mp4':'image/png'}};
      document.addEventListener('paste',e=>{if(e.clipboardData?.files.length){window.filePastes++;e.preventDefault()}});
      ${mockStorage}
      </script><script src="/extension/content.js"></script>`;
    else if(url.pathname==='/sidebar/index.html') content=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script>${mockStorage}</script><script src="/fixture.js"></script>`;
    else if(url.pathname==='/media/salao.png'){res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#d4eee8"/><text x="320" y="170" text-anchor="middle" fill="#166758" font-size="32">Imagem de teste local</text></svg>');return}
    else if(url.pathname==='/fixture.js'){content=bundle.outputFiles[0].text;type='text/javascript'}
    else if(url.pathname==='/styles.css'){content=read('sidebar-src/src/styles.css');type='text/css'}
    else if(url.pathname==='/extension/wppconnect-wa.js'){type='text/javascript';content=`
      window.activePhone='5511999999999';window.handlers={};
      window.WPP={isFullReady:true,on:(name,fn)=>window.handlers[name]=fn,
        chat:{sendFileMessage:async(id,content,options)=>{const isFile=content instanceof File;const serialized=isFile?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(content)}):content;window.sentMedia.push({id,content:serialized,isFile,options});if(window.failSend)throw new Error('Falha de envio simulada');return {id:'sent-1',ack:1}},getActiveChat:()=>window.blockVerification?null:({id:{user:window.activePhone,toString:()=>window.activePhone+'@c.us'},name:window.activePhone==='5511999999999'?'Mariana Oliveira':'João Silva'})},
        contact:{get:async()=>({name:window.activePhone==='5511999999999'?'Mariana Oliveira':'João Silva'})}};
      window.changeChat=async phone=>{window.activePhone=phone;await window.handlers['chat.active_chat'](WPP.chat.getActiveChat())};
    `}
    else if(['/extension/content.js','/extension/wa-js-bridge.js','/extension/wa-overrides.css'].includes(url.pathname)){
      content=read(url.pathname.slice(1));type=url.pathname.endsWith('.css')?'text/css':'text/javascript';
    } else {res.writeHead(404);res.end();return}
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(content);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request',request=>request.url().startsWith(origin)?request.continue():request.abort());
    await page.setViewport({width:1440,height:850});
    await page.goto(origin);
    await page.waitForSelector('#voe-message-center-frame:not([hidden])');
    const dock=await (await page.$('#voe-message-center-frame')).contentFrame();
    const sidebar=await (await page.$('#voe-sidebar-frame')).contentFrame();
    // O tamanho/posição do iframe é sincronizado pelo pai em requestAnimationFrame.
    // Aguarda o layout antes/depois dos cliques para não usar coordenadas antigas.
    const settleLayout=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const clickDock=dock.click.bind(dock);
    dock.click=async(...args)=>{await settleLayout();await clickDock(...args);await settleLayout()};
    await dock.waitForSelector('.mc-bar button');
    await dock.click('.mc-bar button');
    await dock.waitForFunction(()=>document.querySelectorAll('.mc-item').length>20);
    await dock.waitForFunction(()=>document.querySelector('.mc-categories').textContent.includes('Qualificação Dmove'));
    assert.deepEqual(await dock.$$eval('.mc-categories button',buttons=>buttons.slice(0,3).map(button=>button.textContent)),['Abertura','Qualificação Dmove','Apresentação']);
    await dock.click('.mc-categories button:nth-child(2)');
    await dock.waitForFunction(()=>document.querySelectorAll('.mc-item').length===1);
    await dock.click('.mc-categories button:nth-child(3)');
    assert.equal(await dock.$$eval('.mc-categories [aria-pressed="true"]',buttons=>buttons.length),2);
    await dock.click('.mc-clear-categories');
    await dock.type('[aria-label="Buscar mensagens"]','recepcao casamento');
    await dock.waitForFunction(()=>document.querySelectorAll('.mc-item').length===1);
    assert.match(await dock.$eval('.mc-item',e=>e.textContent),/Olá, Mariana/);
    await page.$eval('[contenteditable]',e=>e.textContent='Rascunho preservado.');
    await dock.click('.mc-insert');
    await dock.waitForSelector('.mc-feedback-done');
    const draft=await page.$eval('[contenteditable]',e=>e.innerText);
    assert.match(draft,/Rascunho preservado/);assert.match(draft,/Olá, Mariana/);
    assert.equal(await page.evaluate(()=>filePastes),0);
    const calls=await page.evaluate(()=>fetchCount);
    await dock.click('[aria-label="Recolher Central"]');
    await dock.click('.mc-bar button');
    await page.waitForFunction(()=>document.querySelector('#voe-message-center-frame').getBoundingClientRect().height>36);
    assert.equal(await dock.$eval('[aria-label="Buscar mensagens"]',e=>e.value),'recepcao casamento');
    assert.equal(await page.evaluate(()=>fetchCount),calls);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await dock.click('[aria-label="Limpar busca"]');
    await dock.waitForFunction(()=>document.querySelectorAll('.mc-item').length>20);
    await dock.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await dock.$eval('.mc-list',e=>e.scrollTop=450);
    await dock.waitForFunction(()=>document.querySelector('.mc-list').scrollTop>400);
    await dock.click('[aria-label="Recolher Central"]');
    await dock.click('.mc-bar button');
    assert.ok(await dock.$eval('.mc-list',e=>e.scrollTop)>400);
    await dock.$eval('.mc-list',e=>e.scrollTop=0);
    await dock.click('.mc-filters button:nth-child(3)');
    await dock.waitForFunction(()=>document.querySelectorAll('.mc-item').length===1);
    assert.match(await dock.$eval('.mc-item',e=>e.textContent),/Recepção/);
    await dock.click('.mc-filters button:first-child');
    await dock.type('[aria-label="Buscar mensagens"]','empresa');
    await dock.click('.mc-item-summary');
    await dock.waitForSelector('.mc-warning');
    assert.match(await dock.$eval('.mc-warning',e=>e.textContent),/empresa.*email/);
    await dock.click('[aria-label="Limpar busca"]');
    await dock.click('.mc-bar button:nth-of-type(2)');
    assert.equal(await dock.$('audio'),null);
    await dock.click('.mc-item-summary');
    await dock.waitForSelector('audio');
    assert.equal(await dock.$eval('audio',e=>e.preload),'none');
    await dock.click('.mc-insert');
    await dock.waitForSelector('.mc-feedback-done');
    assert.match(await dock.$eval('.mc-feedback',e=>e.textContent),/Mídia enviada/);
    assert.equal(await page.evaluate(()=>sentMedia.length),1);
    assert.deepEqual(await page.evaluate(()=>sentMedia[0].options),{type:'audio',filename:'apresentacao.ogg',mimetype:'audio/ogg; codecs=opus',waitForAck:true,isPtt:true,waveform:true});
    assert.equal(await page.evaluate(()=>sentMedia[0].isFile),true);
    assert.ok(await page.evaluate(()=>sentMedia[0].content.startsWith('data:audio/ogg; codecs=opus;base64,T2dnUw')));
    assert.equal(await page.evaluate(()=>sentMedia[0].id),'5511999999999@c.us');
    assert.equal(await page.evaluate(()=>filePastes),0);
    // Imagem: renovar URL expirada, revisar legenda, cancelar sem enviar e confirmar.
    await dock.click('.mc-bar button:nth-of-type(3)');
    await dock.click('.mc-insert');
    await dock.waitForSelector('.mc-send-review');
    await page.waitForFunction(()=>signedRequests.length>0);
    assert.equal(await page.evaluate(()=>signedRequests[0].path),'/api/v1/message-library/image/media-url');
    assert.equal(await page.evaluate(()=>signedRequests[0].authorization),'Bearer voe_workspace-a');
    assert.equal(await page.evaluate(()=>sentMedia.length),1);
    await dock.click('.mc-send-review .mc-icon-button');
    assert.equal(await page.evaluate(()=>sentMedia.length),1);
    await dock.click('.mc-insert');
    await dock.$eval('[aria-label="Legenda da mídia"]',e=>{e.focus();e.select()});
    await page.keyboard.type('Legenda revisada');
    await dock.waitForFunction(()=>document.querySelector('.mc-preview img')?.naturalWidth>0);
    await dock.$eval('.mc-send-review',e=>e.scrollIntoView({block:'end'}));
    await page.screenshot({path:'/tmp/voe-message-center-review.png'});
    await dock.click('.mc-send-review .mc-insert');
    await dock.waitForSelector('.mc-feedback-done');
    assert.equal(await page.evaluate(()=>sentMedia[1].options.caption),'Legenda revisada');
    assert.equal(await page.evaluate(()=>sentMedia[1].options.type),'image');
    await page.screenshot({path:'/tmp/voe-message-center-media.png'});
    // Vídeo também exige confirmação e conserva o tipo da mídia.
    await dock.click('.mc-bar button:nth-of-type(4)');
    await dock.click('.mc-insert');
    await dock.waitForSelector('.mc-send-review');
    assert.equal(await page.evaluate(()=>sentMedia.length),2);
    await dock.click('.mc-send-review .mc-insert');
    await dock.waitForSelector('.mc-feedback-done');
    assert.equal(await page.evaluate(()=>sentMedia[2].options.type),'video');
    await dock.click('.mc-bar button:nth-of-type(2)');
    await page.evaluate(()=>{window.delayDownload=true});
    await dock.click('.mc-insert');
    await page.waitForFunction(()=>typeof releaseDownload==='function');
    await page.evaluate(async()=>{await changeChat('5511888888888');window.releaseDownload()});
    await page.waitForFunction(()=>document.querySelector('#voe-message-center-frame').style.height==='36px');
    assert.equal(await page.evaluate(()=>sentMedia.length),3);
    await dock.click('.mc-bar button');
    await dock.waitForFunction(()=>document.querySelector('.mc-context').textContent.includes('João'));
    await page.evaluate(()=>{window.blockVerification=true});
    await dock.click('.mc-insert');
    await dock.waitForSelector('.mc-feedback-error');
    assert.equal(await page.$eval('[contenteditable]',e=>e.innerText),draft);
    await page.evaluate(()=>{window.blockVerification=false;window.failLibrary=true});
    await dock.click('.mc-footer button');
    await dock.waitForSelector('.mc-error');
    assert.ok(await dock.$('.mc-item'));
    await page.evaluate(()=>{window.failLibrary=false});
    await dock.click('.mc-error button');
    await dock.waitForFunction(()=>!document.querySelector('.mc-error'));
    // Alterna para uma mensagem sem erro antes das capturas visuais.
    await dock.type('[aria-label="Buscar mensagens"]','follow-up');
    await page.evaluate(()=>storeData('local',{'voe-ext-theme':'dark'}));
    await dock.waitForFunction(()=>document.documentElement.dataset.voeTheme==='dark');
    await dock.waitForFunction(()=>getComputedStyle(document.querySelector('.mc-categories button')).backgroundColor===getComputedStyle(document.querySelector('.mc-panel')).backgroundColor);
    await page.screenshot({path:'/tmp/voe-message-center-dark.png'});
    await page.evaluate(()=>storeData('local',{'voe-ext-theme':'light'}));
    await dock.waitForFunction(()=>document.documentElement.dataset.voeTheme==='light');
    await page.screenshot({path:'/tmp/voe-message-center-light.png'});
    await dock.click('[aria-label="Recolher Central"]');
    await sidebar.click('#open-fallback');
    await sidebar.waitForSelector('.mc-item');
    assert.equal(await sidebar.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.$eval('#voe-sidebar-frame',e=>e.style.width='300px');
    assert.equal(await sidebar.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'/tmp/voe-message-center-sidebar.png'});
    await page.$eval('#voe-sidebar-frame',e=>e.style.width='340px');
    await sidebar.click('[aria-label="Limpar busca"]');
    await sidebar.click('.mc-filters button:nth-child(2)');
    await sidebar.waitForFunction(()=>document.querySelectorAll('.mc-item').length===1);
    await sidebar.click('.mc-filters button:first-child');
    // Escape devolve o foco à barra; recolher a sidebar mantém o acesso ao lado da digitação.
    await page.click('#voe-sidebar-toggle');
    await dock.click('.mc-bar button');
    await dock.focus('[aria-label="Buscar mensagens"]');
    await page.keyboard.press('Escape');
    await dock.waitForFunction(()=>!document.querySelector('.mc-dock').classList.contains('is-open'));
    assert.equal(await dock.evaluate(()=>document.activeElement.closest('.mc-bar')!==null),true);
    // No layout em fluxo, recolocar a barra também preserva a última mensagem.
    await page.evaluate(() => {
      const messages = document.querySelector('#messages');
      messages.replaceChildren(...Array.from({length: 60}, (_, i) => {
        const p = document.createElement('p'); p.textContent = 'Mensagem de teste ' + i;
        if (i === 59) p.id = 'last-message';
        return p;
      }));
      messages.scrollTop = messages.scrollHeight;
    });
    await page.waitForFunction(() => !document.querySelector('#voe-message-center-spacer') && document.querySelector('#last-message').getBoundingClientRect().bottom <= document.querySelector('#voe-message-center-frame').getBoundingClientRect().top);
    assert.equal(await page.evaluate(()=>document.querySelector('#messages').getBoundingClientRect().top-document.querySelector('#chat-header').getBoundingClientRect().bottom),0);
    await page.$eval('#messages',e=>e.scrollTop=0);
    assert.ok(await page.evaluate(()=>document.querySelector('#messages p').getBoundingClientRect().top>=document.querySelector('#chat-header').getBoundingClientRect().bottom));
    // Layout flutuante: o histórico não participa do fluxo do footer, como
    // na captura reportada. A última mensagem precisa ficar acima da barra.
    await page.evaluate(() => {
      const main = document.querySelector('#main');
      const footer = main.querySelector('footer');
      const messages = document.querySelector('#messages');
      main.style.position = 'relative';
      Object.assign(footer.style, { position: 'absolute', bottom: '0', left: '0', right: '0' });
      Object.assign(messages.style, { position: 'absolute', top: '56px', bottom: footer.getBoundingClientRect().height + 'px', left: '0', right: '0' });
      messages.scrollTop = messages.scrollHeight;
    });
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('#messages')).paddingBottom) >= 60);
    assert.ok(await page.evaluate(() => document.querySelector('#last-message').getBoundingClientRect().bottom <= document.querySelector('#voe-message-center-frame').getBoundingClientRect().top));
    await page.$eval('#messages', e => e.scrollTop = 100);
    await page.evaluate(() => {
      document.querySelector('#messages').style.bottom = '40px';
    });
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('#messages')).paddingBottom) > 60);
    assert.equal(await page.$eval('#messages', e => e.scrollTop), 100);
    await page.$eval('#messages', e => e.scrollTop = e.scrollHeight);
    await page.screenshot({path:'/tmp/voe-message-center-last-message.png'});
    await page.evaluate(()=>document.querySelector('#main footer').remove());
    await page.waitForSelector('#voe-message-center-frame[hidden]');
    assert.equal(await page.$eval('#messages', e => e.style.paddingBottom), '');
    assert.ok(await sidebar.$('.mc-item'));
    await sidebar.evaluate(()=>window.setContext({...window.parent.testContext,scope:{userId:'user',workspaceId:'workspace-b'}}));
    await sidebar.waitForFunction(()=>document.querySelector('.mc-list').textContent.includes('Exclusiva do workspace B'));
    assert.doesNotMatch(await sidebar.$eval('.mc-list',e=>e.textContent),/Recepção/);
    // O assinador não acessa arquivos de outro workspace ou outra sessão.
    assert.match(await sidebar.evaluate(async()=>{
      try { await window.resolveLibraryMediaUrl('https://yjlogamiqdksvceiyfte.supabase.co/storage/v1/object/sign/message-library/workspace-other/image/file.png',{userId:'user',workspaceId:'workspace-a'},'image');return 'unexpected' }
      catch(error){return error.message}
    }),/outro workspace/);
    assert.match(await sidebar.evaluate(async()=>{
      try { await window.resolveLibraryMediaUrl('https://yjlogamiqdksvceiyfte.supabase.co/storage/v1/object/sign/message-library/workspace-a/image/file.png',{userId:'another-user',workspaceId:'workspace-a'},'image');return 'unexpected' }
      catch(error){return error.message}
    }),/sessão mudou/);
    // Exercita apiClient real: escopo, Bearer do workspace e retry único em 401.
    // Links válidos dispensam renovação; a URL antiga nunca vira parâmetro da API.
    const signingChecks=await sidebar.evaluate(async()=>{
      const scope={userId:'user',workspaceId:'workspace-a'};
      const makeUrl=exp=>'https://yjlogamiqdksvceiyfte.supabase.co/storage/v1/object/sign/message-library/workspace-a/audio/model.opus?token=header.'+btoa(JSON.stringify({exp})).replace(/=/g,'')+'.signature';
      const valid=makeUrl(Math.floor(Date.now()/1000)+3600);
      const start=window.top.signedRequests.length;
      const same=await window.resolveLibraryMediaUrl(valid,scope,'audio');
      const reused=same===valid&&window.top.signedRequests.length===start;
      const expired=makeUrl(1);
      let changed;
      try{await window.resolveLibraryMediaUrl(expired,scope,'audio')}catch(error){changed=error.message}
      const blocked=window.top.signedRequests.length===start;
      window.top.activeWorkspace='workspace-a';
      window.top.signStatuses=[401,200];
      const refreshed=await window.resolveLibraryMediaUrl(expired,scope,'audio');
      const calls=window.top.signedRequests.slice(start);
      window.top.signStatuses=[403];let denied;
      try{await window.resolveLibraryMediaUrl(expired,scope,'audio')}catch(error){denied=error.message}
      window.top.signStatuses=[500];let missing;
      try{await window.resolveLibraryMediaUrl(expired,scope,'audio')}catch(error){missing=error.message}
      window.top.signStatuses=[401,401];let revoked;
      const retryStart=window.top.signedRequests.length;
      try{await window.resolveLibraryMediaUrl(expired,scope,'audio')}catch(error){revoked=error.message}
      return {reused,refreshed,calls,denied,missing,changed,blocked,revoked,retryCalls:window.top.signedRequests.length-retryStart,refreshCount:window.top.refreshCount,tokenRefreshCount:window.top.tokenRefreshCount};
    });
    assert.equal(signingChecks.reused,true);
    assert.equal(signingChecks.calls.length,2);
    assert.equal(signingChecks.calls[0].path,'/api/v1/message-library/audio/media-url');
    assert.equal(signingChecks.calls[0].method,'GET');
    assert.equal(signingChecks.calls[0].body,undefined);
    assert.equal(signingChecks.calls[0].authorization,'Bearer voe_workspace-a');
    assert.equal(signingChecks.calls[1].authorization,'Bearer voe_workspace-a_new');
    assert.equal(signingChecks.refreshCount,0);
    assert.equal(signingChecks.tokenRefreshCount,2);
    assert.equal(signingChecks.blocked,true);
    assert.match(signingChecks.changed,/workspace mudou/);
    assert.equal(signingChecks.retryCalls,2);
    assert.ok(signingChecks.revoked);
    assert.match(signingChecks.denied,/workspace/);
    assert.match(signingChecks.missing,/indisponível na biblioteca/);
    // Exercita o bridge real com falha, ACK pendente, concorrência e troca de
    // contexto durante a última consulta de identidade. Nenhuma rede real.
    const bridgeChecks=await page.evaluate(async()=>{
      const send=(id)=>new Promise(resolve=>{
        const listener=e=>{if(e.detail.id===id){document.removeEventListener('VOE_MEDIA_SENT',listener);resolve(e.detail)}};
        document.addEventListener('VOE_MEDIA_SENT',listener);
        document.dispatchEvent(new CustomEvent('VOE_SEND_MEDIA',{detail:{id,expectedPhone:window.activePhone,mediaType:'audio',mimeType:'audio/mpeg',fileName:'audio.mp3',base64:'aGVsbG8='}}));
      });
      const originalSend=WPP.chat.sendFileMessage;
      WPP.chat.sendFileMessage=async()=>{throw new Error('Falha simulada')};
      const failed=await send('failure');
      WPP.chat.sendFileMessage=async()=>({id:'pending-id',ack:0});
      const pending=await send('pending');
      let complete;let begin;const began=new Promise(resolve=>begin=resolve);
      WPP.chat.sendFileMessage=()=>{begin();return new Promise(resolve=>complete=resolve)};
      const first=send('first');await began;
      const duplicate=await send('duplicate');
      complete({id:'confirmed-id',ack:1});const completed=await first;
      const originalContact=WPP.contact.get;
      let finishContact;
      WPP.contact.get=()=>new Promise(resolve=>finishContact=resolve);
      WPP.chat.sendFileMessage=originalSend;
      const count=window.sentMedia.length;
      const interrupted=send('context-change');
      document.dispatchEvent(new CustomEvent('VOE_CANCEL_MEDIA_PREPARATION'));
      finishContact({name:'Contato'});
      const changed=await interrupted;
      WPP.contact.get=originalContact;
      return {failed,pending,duplicate,completed,changed,unchanged:count===window.sentMedia.length};
    });
    assert.equal(bridgeChecks.failed.ok,false);
    assert.match(bridgeChecks.failed.error,/Confira a conversa/);
    assert.equal(bridgeChecks.pending.ok,false);
    assert.equal(bridgeChecks.duplicate.ok,false);
    assert.equal(bridgeChecks.completed.ok,true);
    assert.equal(bridgeChecks.changed.ok,false);
    assert.equal(bridgeChecks.unchanged,true);
    assert.deepEqual(errors,[]);
    console.log('PASS: busca por termos/acentos/tags, variáveis, rascunho, recentes, cache, prévias com confirmação/legenda, envio de áudio/imagem/vídeo, links renovados, ACK/falhas/concorrência, topo sem faixa, troca de chat, identidade indisponível, falha/retry, temas, fallback e isolamento de workspace.');
    console.log('Capturas: /tmp/voe-message-center-light.png e /tmp/voe-message-center-dark.png');
  } finally {if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
