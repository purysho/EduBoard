import type { ContactMethod } from '@shared/types'
import { tr } from '@shared/i18n'

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: tr('Phone'),
  email: tr('Email'),
  'in-person': tr('In person'),
  other: tr('Other')
}
