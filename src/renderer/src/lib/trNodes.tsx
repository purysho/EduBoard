import { Fragment, type ReactNode } from 'react'
import { tr, type TrVars } from '@shared/i18n'

/**
 * A sentence with something inside it that isn't plain text (bold, a link, a badge),
 * translated as one sentence so the words can go in Chinese order:
 *   trNodes('This key is the {only} way in.', { only: <strong>{tr('only')}</strong> })
 * Placeholders whose value is a string or number are filled like tr's.
 */
export function trNodes(english: string, parts: Record<string, ReactNode>): ReactNode {
  const text: string = tr(english, stringParts(parts))
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1]
    return <Fragment key={i}>{name && name in parts ? parts[name] : piece}</Fragment>
  })
}

function stringParts(parts: Record<string, ReactNode>): TrVars {
  const vars: TrVars = {}
  for (const [k, v] of Object.entries(parts)) {
    if (typeof v === 'string' || typeof v === 'number') vars[k] = v
  }
  return vars
}
