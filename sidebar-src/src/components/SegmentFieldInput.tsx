// SegmentFieldInput.tsx
// Renderiza o input certo pra um campo nativo do segmento, de acordo com o
// `type` real (text/textarea/number/currency/date/select/multiselect/boolean
// — nomes diferentes dos tipos de custom_fields, por isso um componente à
// parte em vez de reaproveitar CustomFieldInput).

import type { SegmentFieldDef } from '../hooks/useSegmentFields'

export type SegmentFieldValue = string | string[] | boolean

interface Props {
  field: SegmentFieldDef
  value: SegmentFieldValue | undefined
  onChange: (value: SegmentFieldValue) => void
}

export function SegmentFieldInput({ field, value, onChange }: Props) {
  const label = (
    <>
      {field.label}
      {field.required && <span aria-hidden> *</span>}
    </>
  )

  if (field.type === 'boolean') {
    return (
      <label className="custom-field-checkbox">
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
        {label}
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label>
        {label}
        <select value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">— selecione —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'multiselect') {
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

  if (field.type === 'textarea') {
    return (
      <label>
        {label}
        <textarea
          rows={2}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        />
      </label>
    )
  }

  const inputType = field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'date' : 'text'
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
