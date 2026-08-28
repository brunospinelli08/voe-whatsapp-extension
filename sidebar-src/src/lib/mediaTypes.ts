// mediaTypes.ts
// Subconjunto client-safe de mediaTypes.ts (app.voeops.com) — só o
// necessário pra validar/rotular um arquivo ANTES de subir (evita gastar o
// upload de 15MB só pra descobrir depois que passou do limite). A validação
// de verdade continua no servidor (POST /api/v1/media já reaplica os
// mesmos limites) — isso aqui é só uma checagem antecipada, cosmética.

export type MediaType = 'image' | 'video' | 'audio' | 'document'

export function mimeToMediaType(mime: string): MediaType {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

export const MEDIA_SIZE_LIMITS: Record<MediaType, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
}

export function validateMediaSize(type: MediaType, size: number): { ok: boolean; limitMb: number } {
  const limit = MEDIA_SIZE_LIMITS[type]
  return { ok: size <= limit, limitMb: Math.round(limit / (1024 * 1024)) }
}
