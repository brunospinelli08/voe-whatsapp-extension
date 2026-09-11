// Executa as funções REAIS do vendor com áudio PCM válido e Web Audio do Chrome.
// Simula apenas o preparo/registro/envio nativo: não abre nem envia ao WhatsApp.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('../sidebar-src/node_modules/typescript');
const esbuild = require('../sidebar-src/node_modules/esbuild');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { patchSource, original, patched } = require('./patch-wa-js-audio.cjs');

function extract(source) {
  const ast = ts.createSourceFile('vendor.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = {};
  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isFunctionExpression(node.right)) {
      const name = node.left.getText(ast);
      if (['t.sendFileMessage', 't.prepareAudioWaveform', 't.convertToFile'].includes(name)) functions[name] = node.right.getText(ast);
    }
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral && node.getText(ast).startsWith('/^data:')) functions.dataUrlPattern = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(Object.keys(functions).length, 4, 'Funções de áudio do vendor não encontradas.');
  return functions;
}

(async () => {
  const converted = await esbuild.build({ stdin: { contents: `import {prepareVoiceAudio} from './src/lib/voiceAudio'; window.prepareVoiceAudio=prepareVoiceAudio;`, resolveDir: path.resolve(__dirname, '../sidebar-src'), loader: 'ts' }, bundle: true, write: false });
  const source = fs.readFileSync(path.resolve(__dirname, '../extension/wppconnect-wa.js'), 'utf8');
  assert.ok(source.includes(patched), 'O vendor distribuído precisa conter a correção.');
  assert.equal(patchSource(source), source, 'A correção precisa ser idempotente.');
  assert.throws(() => patchSource('vendor desconhecido'));
  const current = extract(source);
  const baseline = extract(source.replace(patched, original));
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Teste local de ondas de áudio</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true, args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith(origin + '/') ? request.continue() : request.abort());
    await page.goto(origin);
    await page.addScriptTag({ content: converted.outputFiles[0].text });
    const results = await page.evaluate(async ({ current, baseline }) => {
      const contexts = [];
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(...args) { super(...args); contexts.push(this); }
      };
      try {
        // Dois segundos, amplitude crescente: as ondas devem refletir o sinal.
        const sampleRate = 16000, count = sampleRate * 2;
        const buffer = new ArrayBuffer(44 + count * 2);
        const view = new DataView(buffer);
        const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
        text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, count * 2, true);
        for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / sampleRate) * (0.1 + 0.8 * i / count) * 30000, true);
        const originalFile = new File([buffer], 'teste.wav', { type: 'audio/wav' });
        const voice = await window.prepareVoiceAudio(originalFile);
        const voiceBytes = new Uint8Array(await voice.arrayBuffer());
        const decodedContext = new AudioContext();
        const decoded = await decodedContext.decodeAudioData(voiceBytes.slice().buffer);
        const encoding = { mime: voice.type, magic: String.fromCharCode(...voiceBytes.subarray(0, 4)), channels: decoded.numberOfChannels, duration: decoded.duration, size: voice.size };
        const controller = new AbortController();controller.abort();
        let aborted = false, corrupt = false, interrupted = false;
        try { await window.prepareVoiceAudio(originalFile, controller.signal); } catch (error) { aborted = error.name === 'AbortError'; }
        try { await window.prepareVoiceAudio(new Blob(['invalid'], { type: 'audio/mpeg' })); } catch { corrupt = true; }
        const duringPreparation = new AbortController();
        const timer = setTimeout(() => duringPreparation.abort(), 0);
        try { await window.prepareVoiceAudio(originalFile, duringPreparation.signal); } catch (error) { interrupted = error.name === 'AbortError'; }
        finally { clearTimeout(timer); }
        const file = new File([voice], 'teste.ogg', { type: voice.type });
        const dataUrlPattern = new Function(`return (${current.dataUrlPattern})`)();
        const spacedMimeRejected = !dataUrlPattern.test('data:audio/ogg; codecs=opus;base64,aGVsbG8=');
        // O parser é inalcançável para File; usa o conversor REAL do vendor.
        const convertToFile = new Function('i', `return (${current['t.convertToFile']})`)({default:()=>{throw new Error('Parser não deve receber um File')}});
        const fileAccepted = await convertToFile(file, file.type, file.name) === file;
        const prepareAudioWaveform = new Function('o', `return (${current['t.prepareAudioWaveform']})`)(() => {});
        const generated = await prepareAudioWaveform({ isPtt: true, waveform: true }, file);

        async function run(functionSource, { isPtt = true, waveform = true, nativeWave = false, type = 'audio' } = {}) {
          let handler, captured;
          const id = { toString: () => 'local-message' };
          const chat = { id: 'local-chat', msgs: { on: (_event, listener) => { handler = listener; }, off: () => {} } };
          const mediaData = { type: isPtt ? 'ptt' : type, ...(nativeWave ? { waveform: new Uint8Array(64).fill(25) } : {}) };
          const modules = {
            h: { defaultSendMessageOptions: { waitForAck: true, markIsRead: false } },
            c: { assertFindChat: async () => chat },
            d: { convertToFile: async () => file, WPPError: Error },
            f: { getMediaTypeForValidation: () => 'audio' },
            p: { MediaGatingUtils: { getUploadLimit: () => 1e8 } },
            P: () => {}, _: { prepareAudioWaveform },
            b: { prepareRawMessage: async (_chat, value) => ({ ...value, id }), prepareMessageButtons: value => value },
            g: {
              OpaqueData: { createFromData: async () => ({}) },
              MediaPrep: { prepRawMedia: (_opaque, options) => ({
                // Reproduz o caso em que o preparo nativo ignora precomputedFields.
                _mediaData: mediaData, waitForPrep: async () => mediaData,
                sendToChat: async ({ options: sendOptions }) => {
                  captured = {
                    supplied: Array.from(options.precomputedFields?.waveform || []),
                    media: Array.from(mediaData.waveform || []),
                    message: Array.from(sendOptions.productMsgOptions.waveform || []),
                  };
                  await new Promise(resolve => setTimeout(resolve, 0));
                  handler({ id, ack: 1, on() {}, off() {} });
                  return { messageSendResult: 'OK' };
                },
              }) },
            },
          };
          const send = new Function(...Object.keys(modules), `return (${functionSource})`)(...Object.values(modules));
          await send('local-chat', file, { type, isPtt, waveform });
          return captured;
        }
        return {
          encoding, aborted, corrupt, interrupted, spacedMimeRejected, fileAccepted, duration: generated.duration, generated: [...generated.waveform],
          before: await run(baseline['t.sendFileMessage']), after: await run(current['t.sendFileMessage']),
          native: await run(current['t.sendFileMessage'], { nativeWave: true }),
          common: await run(current['t.sendFileMessage'], { isPtt: false }),
          disabled: await run(current['t.sendFileMessage'], { waveform: false }),
          image: await run(current['t.sendFileMessage'], { type: 'image', isPtt: false }),
        };
      } finally { await Promise.all(contexts.filter(context => context.state !== 'closed').map(context => context.close())); window.AudioContext = NativeAudioContext; }
    }, { current, baseline });
    assert.equal(results.spacedMimeRejected,true);
    assert.equal(results.fileAccepted,true);
    assert.equal(results.duration, Math.floor(results.encoding.duration));
    assert.equal(results.encoding.mime, 'audio/ogg; codecs=opus');
    assert.equal(results.encoding.magic, 'OggS');
    assert.equal(results.encoding.channels, 1);
    assert.ok(Math.abs(results.encoding.duration - 2) < 0.03, JSON.stringify(results.encoding));
    assert.equal(results.aborted, true);
    assert.equal(results.corrupt, true);
    assert.equal(results.interrupted, true);
    assert.equal(results.generated.length, 64);
    assert.ok(results.generated.every(value => value >= 0 && value <= 100));
    assert.ok(results.generated[50] > results.generated[5], 'Ondas precisam refletir a amplitude real.');
    assert.equal(results.before.supplied.length, 64);
    assert.equal(results.before.media.length, 0);
    assert.equal(results.before.message.length, 0);
    assert.deepEqual(results.after.media, results.generated);
    assert.deepEqual(results.after.message, results.generated);
    assert.deepEqual(results.native.media, new Array(64).fill(25));
    assert.deepEqual(results.native.message, results.native.media);
    for (const name of ['common', 'disabled', 'image']) {
      assert.equal(results[name].media.length, 0);
      assert.equal(results[name].message.length, 0);
    }
    console.log('PASS: WAV real → OGG/Opus mono reproduzível → 64 ondas reais; regressão reproduzida antes da correção; ondas preservadas na mídia e mensagem final; ondas nativas preservadas; áudio comum/imagem sem alteração.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
