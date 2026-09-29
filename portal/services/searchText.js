// Keyword search that works for Chinese as well as English (class materials, Study Helper).
//
// SQLite's full-text search splits words at spaces and punctuation. Chinese (and Japanese)
// has no spaces, so a whole sentence became one "word" and a question like 什么是光合作用
// never matched a text containing 光合作用. So each Chinese character is indexed on its own,
// and a question is searched by its pairs of neighbouring characters (光合, 合作, 作用),
// the usual way to search Chinese without a dictionary. Chunks sharing more of the pairs
// rank higher. English words are searched as before.
//
// Kept identical to src/shared/searchText.ts (the teacher's Notebook uses the same rules).

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}'
const CJK_CHAR = new RegExp(`([${CJK}])`, 'gu')
const CJK_RUN = new RegExp(`[${CJK}]+`, 'gu')

/** The text as the search index stores it: every Chinese character a word of its own. */
function indexTerms(text) {
  return String(text ?? '').replace(CJK_CHAR, ' $1 ')
}

/** A safe search query for any question: English words and Chinese character pairs,
 * each quoted (so punctuation can't break the query), any of them matching. '' when the
 * question has nothing to search for. */
function ftsQuery(question) {
  const text = String(question ?? '')
  const terms = new Set()
  for (const word of text.replace(CJK_RUN, ' ').split(/[^\p{L}\p{N}]+/u)) {
    if (word) terms.add(`"${word}"`)
  }
  for (const run of text.match(CJK_RUN) || []) {
    const chars = [...run]
    if (chars.length === 1) terms.add(`"${chars[0]}"`)
    for (let i = 0; i + 1 < chars.length; i++) terms.add(`"${chars[i]} ${chars[i + 1]}"`)
  }
  return [...terms].join(' OR ')
}

module.exports = { indexTerms, ftsQuery }
