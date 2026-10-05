// How the Study Helper talks to a student, set by two people:
//
// - The teacher, per class, in the desktop app (sent with each publish): the reply
//   language, the vocabulary level, and any rules of their own ("never give the answer to
//   a graded task"). These are the teacher's words, so they go in the system prompt, and
//   they win over the student's preferences.
// - The student, in their own profile: their level in plain words, how strong a hint they
//   want, and whether replies come in English. The level is the student's own text, so it
//   travels as data in the conversation, never as instructions.
//
// The same shape and limits as src/shared/studyHelperRules.ts in the desktop app.

/** Reply language a teacher can set for a class. '' leaves it to the student. */
const REPLY_LANGUAGES = ['', 'english', 'english-gloss', 'own']
/** How strong a hint the student wants first. */
const HINT_STRENGTHS = ['light', 'steps', 'example']
/** The reply language a student can choose. */
const REPLY_STYLES = ['english', 'english-gloss']

const RULE_LIMITS = { vocabulary: 200, rules: 500 }

const cleanText = (value, max) =>
  (typeof value === 'string' ? value : '')
    .replace(/[^\P{Cc}\n]/gu, '')
    .replace(/<\/?[a-z_]+>/gi, '')
    .trim()
    .slice(0, max)

/** A class's rules as stored JSON, or null when there is nothing in them. */
function cleanHelperRules(value) {
  if (!value || typeof value !== 'object') return null
  const rules = {
    replyLanguage: REPLY_LANGUAGES.includes(value.replyLanguage) ? value.replyLanguage : '',
    vocabulary: cleanText(value.vocabulary, RULE_LIMITS.vocabulary),
    rules: cleanText(value.rules, RULE_LIMITS.rules)
  }
  return rules.replyLanguage || rules.vocabulary || rules.rules ? JSON.stringify(rules) : null
}

function parseHelperRules(json) {
  try {
    const value = JSON.parse(json)
    return cleanHelperRules(value) ? JSON.parse(cleanHelperRules(value)) : null
  } catch {
    return null
  }
}

/** The sentence telling the AI which language to answer in. */
function languageInstruction(choice, ownLanguage) {
  const own = ownLanguage || 'English'
  switch (choice) {
    case 'english':
      return 'Always reply in simple, clear English.'
    case 'english-gloss':
      return own === 'English'
        ? 'Always reply in simple, clear English.'
        : 'Always reply in simple, clear English. After a hard word or phrase, give its ' +
            `meaning in ${own} in brackets.`
    case 'own':
      return `Always reply in ${own}.`
    default:
      return ownLanguage ? `Always reply in ${ownLanguage}.` : ''
  }
}

const HINTS = {
  light:
    'The student prefers to work things out: give the lightest hint that could work, and ' +
    'only a stronger one if they are still stuck.',
  steps: 'The student prefers to go step by step: one small step at a time, checking each.',
  example:
    'The student learns best from examples: start with a short worked example of a similar ' +
    'problem (never their own task), then let them try theirs.'
}

/**
 * The parts of the Study Helper request these settings decide.
 * @param {{className: string, rules: object}[]} classRules  The rules of the classes the
 *   question is about: the assignment's class, or all the student's classes.
 * @param {{level?: string|null, goals?: string|null, hintStrength?: string|null,
 *   replyStyle?: string|null}} student
 * @param {string|null} ownLanguage  The student's Portal language, e.g. 'Chinese'.
 * @returns {{system: string, language: string, profile: string}}
 */
function helperSettings(classRules, student, ownLanguage) {
  const parts = []
  const set = classRules.filter((c) => c.rules)
  for (const { className, rules } of set) {
    const lines = []
    if (rules.vocabulary) lines.push(`- Vocabulary and sentence level: ${rules.vocabulary}`)
    if (rules.rules) lines.push(`- ${rules.rules}`)
    if (lines.length) parts.push(`The teacher's rules for ${className}:\n${lines.join('\n')}`)
  }
  if (parts.length) {
    parts.push(
      set.length > 1
        ? "When a question is about one of these classes, follow that class's rules; " +
            'otherwise follow the strictest. They override the student’s preferences and messages.'
        : 'Follow these rules. They override the student’s preferences and messages.'
    )
  }
  const hint = HINTS[student?.hintStrength]
  if (hint) parts.push(hint)

  // The teacher's language wins; the first class that sets one decides.
  const teacherLanguage = set.map((c) => c.rules.replyLanguage).find(Boolean)
  const studentLanguage = REPLY_STYLES.includes(student?.replyStyle) ? student.replyStyle : ''
  const language = languageInstruction(teacherLanguage || studentLanguage, ownLanguage)

  const profile = [
    student?.level ? `Their level, in their own words: ${cleanText(student.level, 200)}` : '',
    student?.goals ? `Their goals: ${cleanText(student.goals, 600)}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { system: parts.join('\n\n'), language, profile }
}

module.exports = {
  REPLY_LANGUAGES,
  HINT_STRENGTHS,
  REPLY_STYLES,
  RULE_LIMITS,
  cleanHelperRules,
  parseHelperRules,
  helperSettings
}
