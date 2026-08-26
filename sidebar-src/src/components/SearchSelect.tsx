// SearchSelect.tsx
// Campo de busca-e-selecione genérico (empresa/contato existente) — digita,
// espera um instante (debounce) e busca no servidor via `fetchItems`.
// Mais simples que o equivalente do dashboard (sem dropdown flutuante
// posicionado por coordenadas — não faz sentido numa sidebar estreita),
// mas o comportamento é o mesmo: busca, lista, seleciona.

import { useEffect, useRef, useState } from 'react'

export interface SearchableItem {
  id: string
  name: string
}

interface Props {
  fetchItems: (query: string) => Promise<SearchableItem[]>
  onSelect: (item: SearchableItem) => void
  placeholder: string
  selected: SearchableItem | null
}

export function SearchSelect({ fetchItems, onSelect, placeholder, selected }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchableItem[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      fetchItems(query.trim())
        .then(setResults)
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchItems])

  if (selected) {
    return (
      <div className="search-select-selected">
        <span>{selected.name}</span>
        <button type="button" className="link-button" onClick={() => onSelect({ id: '', name: '' })}>
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="search-select">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {searching && <p className="muted">Buscando…</p>}
      {!searching && query.trim() && results.length === 0 && (
        <p className="muted">Nenhum resultado.</p>
      )}
      {results.length > 0 && (
        <ul className="search-select-results">
          {results.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => { onSelect(item); setQuery('') }}>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
