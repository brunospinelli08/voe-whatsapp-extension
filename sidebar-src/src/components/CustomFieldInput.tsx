// CustomFieldInput.tsx
// Renderiza o input certo pra um campo personalizado, de acordo com o
// `type` real da tabela custom_fields (text/number/date/option/
// multiple_choice/checkbox — não são os mesmos nomes usados na UI de
// Configurações, que são só labels de exibição).

import type { CustomFieldDef } from '../hooks/useCustomFields'

export type CustomFieldValue = string | string[] | boolean

interface Props {
  field: CustomFieldDef
  value: CustomFieldValue | undefined
  onChange: (value: CustomFieldValue) => void
}

export function CustomFieldInput({ field, value, onChange }: Props) {
  const label = (
    <>
      {field.label}
      {field.required && <span aria-hidden> *</span>}
    </>
  )

  if (field.type === 'checkbox') {
    return (
      <label className="custom-field-checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
        />
        {label}
      </label>
    )
  }

  if (field.type === 'option') {
    return (
      <label>
        {label}
        <select value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">— selecione —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'multiple_choice') {
    const selected = Array.isArray(value) ? value : []
    function toggle(opt: string) {
      onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
    }
    return (
      <fieldset className="custom-field-multiple-choice">
        <legend>{label}</legend>
        {(field.options ?? []).map(opt => (
          <label key={opt} className="custom-field-checkbox">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </fieldset>
    )
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  return (
    <label>
      {label}
      <input
        type={inputType}
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        required={field.required}
      />
    </label>
  )
}
