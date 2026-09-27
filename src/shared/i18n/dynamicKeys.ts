// Interface text that reaches tr() through a variable rather than as a literal (a
// category stored in English, an action name passed along), so the coverage test can't
// see it at the call. Listed here so the test checks these have translations too.
import { COMMENT_CATEGORIES } from '../commentBank'

export const DYNAMIC_KEYS: readonly string[] = [
  ...COMMENT_CATEGORIES,
  // Month and weekday abbreviations mapped through tr() in lists.
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  // Attendance and enrollment statuses, stored in English and shown translated.
  'present',
  'late',
  'absent',
  'excused',
  'active',
  'dropped',
  'completed',
  // Lesson plan statuses.
  'planned',
  'taught',
  'skipped',
  // Classroom points reasons.
  'Helping others',
  'On task',
  'Great answer',
  'Kindness',
  'Teamwork'
]
