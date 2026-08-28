// fileBase64.ts
// Conversão File <-> base64 — usada em duas pontes de mensageria entre
// contextos de extensão que só carregam string com segurança:
// (1) sidebar -> background.js, pra upload de arquivo (ver backgroundFetch.ts);
// (2) aba de gravação avulsa -> sidebar, pra entregar o áudio gravado (ver
// StandaloneRecorderPage.tsx / AudioRecorderPanel usage em ScheduleMessagePanel.tsx).

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // readAsDataURL devolve "data:<mime>;base64,<dados>" — só o pedaço
      // depois da vírgula interessa (o mime vai separado, como fileType).
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Erro ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

export function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new File([bytes], fileName, { type: mimeType })
}
