// supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import { chromeStorageAdapter } from './chromeStorageAdapter'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: chromeStorageAdapter,
    storageKey: 'voe-ext-auth',
    // Não há URL de redirect a processar aqui (a sidebar roda num iframe,
    // não numa página de navegação própria).
    detectSessionInUrl: false,
  },
})
