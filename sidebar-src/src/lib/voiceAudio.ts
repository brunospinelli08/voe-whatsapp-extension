// Muxer OGG adaptado de app.voeops.com/src/lib/audioConvert.ts.
// Prepara áudio local como Evolution Go: Opus, mono, 48 kHz, MIME explícito.
// Sem conversor externo; falha antes do envio se não puder preparar a voz.

// ── CRC32 para OGG (polinômio 0x04c11db7) ────────────────────────────────────
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i << 24;
        for (let j = 0; j < 8; j++) c = (c & 0x80000000) ? ((c << 1) ^ 0x04c11db7) : (c << 1);
        t[i] = c >>> 0;
    }
    return t;
})();

function oggCrc32(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc = ((CRC_TABLE[(crc >>> 24) ^ data[i]] ^ (crc << 8)) >>> 0);
    }
    return crc;
}

// Escreve int64 LE como dois uint32 (evita BigInt para compatibilidade com TS target < ES2020)
function writeInt64LE(view: DataView, offset: number, lo: number, hi: number) {
    view.setUint32(offset,     lo, true);
    view.setUint32(offset + 4, hi, true);
}

// ── OGG page builder ──────────────────────────────────────────────────────────
function buildOggPage(
    headerType: number,
    granuleLo: number,   // low 32 bits
    granuleHi: number,   // high 32 bits (-1/-1 = 0xFFFFFFFF for header pages)
    serial: number,
    seqNum: number,
    packets: Uint8Array[],
): Uint8Array {
    const segments: number[] = [];
    for (let p = 0; p < packets.length; p++) {
        let rem = packets[p].length;
        while (rem >= 255) { segments.push(255); rem -= 255; }
        segments.push(rem);
    }
    const headerSize = 27 + segments.length;
    let dataSize = 0;
    for (let p = 0; p < packets.length; p++) dataSize += packets[p].length;

    const page = new Uint8Array(headerSize + dataSize);
    const view = new DataView(page.buffer);

    page[0] = 0x4f; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53; // OggS
    page[4] = 0x00;
    page[5] = headerType;
    writeInt64LE(view, 6, granuleLo, granuleHi);
    view.setUint32(14, serial,  true);
    view.setUint32(18, seqNum,  true);
    view.setUint32(22, 0,       true); // checksum placeholder
    page[26] = segments.length;
    for (let i = 0; i < segments.length; i++) page[27 + i] = segments[i];

    let off = headerSize;
    for (let p = 0; p < packets.length; p++) {
        page.set(packets[p], off);
        off += packets[p].length;
    }

    view.setUint32(22, oggCrc32(page), true);
    return page;
}

// ── Opus identification header (RFC 7845) ─────────────────────────────────────
function buildOpusHead(channels: number, inputSampleRate: number, preSkip = 312): Uint8Array {
    const h    = new Uint8Array(19);
    const view = new DataView(h.buffer);
    const magic = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]; // "OpusHead"
    for (let i = 0; i < 8; i++) h[i] = magic[i];
    h[8]  = 1;
    h[9]  = channels;
    view.setUint16(10, preSkip,         true);
    view.setUint32(12, inputSampleRate, true);
    view.setInt16 (16, 0,               true);
    h[18] = 0;
    return h;
}

// ── Opus comment header ───────────────────────────────────────────────────────
function buildOpusTags(): Uint8Array {
    const magic   = [0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]; // "OpusTags"
    const vendor  = [0x76, 0x6f, 0x65, 0x63, 0x72]; // "voecr"
    const h       = new Uint8Array(8 + 4 + vendor.length + 4);
    const view    = new DataView(h.buffer);
    for (let i = 0; i < 8; i++) h[i] = magic[i];
    view.setUint32(8,  vendor.length, true);
    for (let i = 0; i < vendor.length; i++) h[12 + i] = vendor[i];
    view.setUint32(12 + vendor.length, 0, true);
    return h;
}

export async function prepareVoiceAudio(blob: Blob, signal?: AbortSignal): Promise<Blob> {
    signal?.throwIfAborted();
    if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") {
        throw new Error("Este navegador não permite preparar o áudio de voz. Atualize o Chrome.");
    }
    const sampleRate = 48000;
    const frameSize = 960;
    const config = { codec: "opus", sampleRate, numberOfChannels: 1, bitrate: 128000 };
    if (!(await AudioEncoder.isConfigSupported(config)).supported) {
        throw new Error("A conversão para mensagem de voz não está disponível neste navegador.");
    }
    signal?.throwIfAborted();
    const audioContext = new AudioContext({ sampleRate });
    let audio: AudioBuffer;
    try {
        audio = await audioContext.decodeAudioData(await blob.arrayBuffer());
    } catch {
        throw new Error("Não foi possível ler este áudio para preparar a mensagem de voz. Nenhuma mensagem foi enviada.");
    } finally { await audioContext.close(); }
    signal?.throwIfAborted();
    if (!audio.length) throw new Error("O arquivo de áudio está vazio.");
    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    const packets: Uint8Array[] = [];
    let encodeError: DOMException | null = null;
    // Pre-skip padrão do encoder Opus; usa o cabeçalho real quando disponível.
    let preSkip = 312;
    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            const bytes = new Uint8Array(chunk.byteLength);
            chunk.copyTo(bytes);
            packets.push(bytes);
            const description = metadata?.decoderConfig?.description;
            if (description) {
                const bytes = ArrayBuffer.isView(description)
                    ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
                    : new Uint8Array(description);
                if (bytes.length >= 19 && String.fromCharCode(...bytes.subarray(0, 8)) === "OpusHead") {
                    preSkip = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(10, true);
                }
            }
        },
        error: error => { encodeError = error; },
    });
    try {
        encoder.configure(config);
        for (let offset = 0; offset < audio.length; offset += frameSize) {
            signal?.throwIfAborted();
            if (encodeError) throw encodeError;
            const length = Math.min(frameSize, audio.length - offset);
            const mono = new Float32Array(length);
            for (const channel of channels) {
                for (let i = 0; i < length; i++) mono[i] += channel[offset + i] / channels.length;
            }
            const data = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: length,
                numberOfChannels: 1, timestamp: Math.round(offset / sampleRate * 1e6), data: mono.buffer });
            try { encoder.encode(data); } finally { data.close(); }
            // Libera a UI para trocar de conversa e cancelar a preparação.
            // Não usa flush entre blocos: preserva o estado contínuo do Opus.
            while (encoder.encodeQueueSize > 50) {
                signal?.throwIfAborted();
                await new Promise<void>(resolve => setTimeout(resolve, 0));
            }
        }
        await encoder.flush();
        if (encodeError) throw encodeError;
    } finally { if (encoder.state !== "closed") encoder.close(); }
    signal?.throwIfAborted();
    if (!packets.length) throw new Error("Não foi possível converter o áudio para mensagem de voz.");
    const serial = crypto.getRandomValues(new Uint32Array(1))[0];
    const pages = [
        buildOggPage(0x02, 0, 0, serial, 0, [buildOpusHead(1, sampleRate, preSkip)]),
        buildOggPage(0, 0, 0, serial, 1, [buildOpusTags()]),
    ];
    packets.forEach((packet, index) => {
        const last = index === packets.length - 1;
        // O granule final corta o padding do encoder e conserva a duração original.
        const granule = last ? audio.length + preSkip : (index + 1) * frameSize;
        pages.push(buildOggPage(last ? 0x04 : 0, granule >>> 0, Math.floor(granule / 0x100000000), serial, index + 2, [packet]));
    });
    return new Blob(pages.map(page => new Uint8Array(page).buffer), { type: "audio/ogg; codecs=opus" });
}
