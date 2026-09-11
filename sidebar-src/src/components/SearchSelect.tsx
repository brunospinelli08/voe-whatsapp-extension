// SearchSelect.tsx
// Campo de busca-e-selecione genérico (empresa/contato existente) — digita,
// espera um instante (debounce) e busca no servidor via `fetchItems`.

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
      setSearching(false)
      return
    }
    setSearching(true)

    let cancelled = false

    debounceRef.current = setTimeout(() => {
      fetchItems(query.trim())
        .then(items => {
          if (!cancelled) setResults(items)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)

    return () => {
      cancelled = true
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
