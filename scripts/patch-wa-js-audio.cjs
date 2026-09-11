// Correção localizada para o WA-JS 4.6.0 distribuído com a extensão.
// precomputedFields pode não sobreviver à preparação nativa da mídia.
// Reaplica as ondas na mídia preparada e no objeto final de envio.
// Ao atualizar o vendor, esta âncora deve ser revisada — nunca substituir às cegas.
const fs = require('node:fs');
const path = require('node:path');

const original = 'const x=S._mediaData||S.mediaData;';
const patched = original + 'if("audio"===r.type&&r.isPtt&&r.waveform){const voeWaveform=x.waveform?.length?x.waveform:w.precomputedFields?.waveform;if(voeWaveform?.length){x.waveform=voeWaveform;C.waveform=voeWaveform;}}';

function patchSource(source) {
  if (!source.includes('wppconnect-team/wa-js v4.6.0')) throw new Error('Versão do WA-JS diferente. Revise a correção de áudio antes de aplicar.');
  if (source.includes(patched)) return source;
  if (source.split(original).length !== 2) throw new Error('Âncora de áudio diferente. Revise a correção antes de aplicar.');
  return source.replace(original, patched);
}

if (require.main === module) {
  const file = path.resolve(__dirname, '../extension/wppconnect-wa.js');
  const source = fs.readFileSync(file, 'utf8');
  const output = patchSource(source);
  if (output !== source) fs.writeFileSync(file, output);
  console.log(output === source ? 'Correção de ondas já aplicada.' : 'Correção de ondas aplicada ao WA-JS 4.6.0.');
}

module.exports = { patchSource, original, patched };
