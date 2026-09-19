import type { ContactMethod } from '@shared/types'

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: 'Phone',
  email: 'Email',
  'in-person': 'In person',
  other: 'Other'
}
