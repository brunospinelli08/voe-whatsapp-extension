// Spinner.tsx
interface Props {
  label?: string
}

export function Spinner({ label }: Props) {
  return (
    <div className="loading-row">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  )
}
