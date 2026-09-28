// Consent at first sign-in. China's Personal Information Protection Law needs a guardian's
// consent to process the personal information of a child under 14, and similar laws
// elsewhere have similar rules. The school stays responsible for consent (it decides what
// is kept); this gives it a dated record of each family agreeing to the terms of use and
// privacy notice. A school that collects consent on paper can turn it off
// (PORTAL_CONSENT=off).
const db = require('../db')

// Bump when the terms or privacy notice change in a way families should agree to again.
const CONSENT_VERSION = '2026-09-28'

const consentRequired = () => process.env.PORTAL_CONSENT !== 'off'

function consentNeeded(accountId) {
  if (!consentRequired()) return false
  const row = db.prepare('SELECT consent_version FROM accounts WHERE id = ?').get(accountId)
  return row?.consent_version !== CONSENT_VERSION
}

/** Records consent. role: 'guardian' (with the guardian's name) or 'student' (a student
 * confirming they're 14 or over). Returns an error message, or null. */
function recordConsent(accountId, role, name) {
  const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
  if (role !== 'guardian' && role !== 'student') return 'Choose who is agreeing.'
  if (role === 'guardian' && !cleanName) return 'Please type the parent or guardian’s name.'
  db.prepare(
    'UPDATE accounts SET consent_at = ?, consent_role = ?, consent_name = ?, consent_version = ? WHERE id = ?'
  ).run(
    new Date().toISOString(),
    role,
    role === 'guardian' ? cleanName : null,
    CONSENT_VERSION,
    accountId
  )
  return null
}

module.exports = { CONSENT_VERSION, consentRequired, consentNeeded, recordConsent }
