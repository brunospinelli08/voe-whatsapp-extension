// TemplatePreview.tsx
// Réplica de components/templates/TemplatePreview.tsx do dashboard: mockup de
// celular com a bolha do template (header texto/imagem, corpo, rodapé,
// botões), variáveis {{n}} preenchidas em azul e as pendentes em âmbar.

import type { WaTemplateComponent } from '../hooks/useWaTemplates'
import { ExternalLinkIcon, PhoneIcon } from './Icons'

function highlightVars(text: string, values: string[]) {
  return text.split(/(\{\{\d+\}\})/g).map((part, i) => {
    const match = part.match(/\{\{(\d+)\}\}/)
    if (!match) return <span key={i}>{part}</span>
    const val = values[parseInt(match[1]) - 1]
    return <span key={i} className={`tpl-var${val ? ' is-filled' : ''}`}>{val || part}</span>
  })
}

export function TemplatePreview({ components, variableValues = [] }: { components: WaTemplateComponent[]; variableValues?: string[] }) {
  const header = components.find(c => c.type === 'HEADER')
  const body = components.find(c => c.type === 'BODY')
  const footer = components.find(c => c.type === 'FOOTER')
  const buttons = components.find(c => c.type === 'BUTTONS')
  // O real substitui antes de destacar, e aí os valores preenchidos perdem o
  // azul que a legenda abaixo promete; aqui destaca direto do {{n}}.
  const render = (text: string) => highlightVars(text, variableValues)

  return (
    <div className="tpl-preview">
      <div className="tpl-phone">
        <div className="tpl-phone-bar">
          <div className="tpl-phone-avatar" />
          <div>
            <p className="tpl-phone-name">Nome do contato</p>
            <p className="tpl-phone-status">online</p>
          </div>
        </div>
        <div className="tpl-phone-chat">
          <div className="tpl-bubble">
            {header?.format === 'IMAGE' && (
              <div className="tpl-bubble-image">
                {header.example?.header_url?.[0] ? <img src={header.example.header_url[0]} alt="" /> : 'Imagem do header'}
              </div>
            )}
            <div className="tpl-bubble-body">
              {header?.format === 'TEXT' && header.text && <p className="tpl-bubble-header">{render(header.text)}</p>}
              {body?.text && <p className="tpl-bubble-text">{render(body.text)}</p>}
              <div className="tpl-bubble-footer">
                {footer?.text && <p>{footer.text}</p>}
                <span>10:30</span>
              </div>
            </div>
            {buttons?.buttons && buttons.buttons.length > 0 && (
              <div className="tpl-bubble-buttons">
                {buttons.buttons.map((btn, i) => (
                  <div key={i}>
                    {btn.type === 'PHONE_NUMBER' && <PhoneIcon size={9} />}
                    {btn.type === 'URL' && <ExternalLinkIcon size={9} />}
                    {btn.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {variableValues.length > 0 && (
        <p className="tpl-preview-hint">Variáveis em <span className="tpl-var is-filled">azul</span> foram preenchidas</p>
      )}
    </div>
  )
}
