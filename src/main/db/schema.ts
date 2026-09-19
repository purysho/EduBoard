import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import type { ExitTicketQuestion } from '@shared/types'

// NOTE: this file defines the Drizzle ORM shape of the database for typed queries.
// The actual DDL used to create/evolve the tables lives in ./migrations.ts — the two
// must be kept in sync by hand (see migrations.ts header comment for why).

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const terms = sqliteTable('terms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  schoolYear: text('school_year').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  preferredName: text('preferred_name'),
  studentNumber: text('student_number'),
  dateOfBirth: text('date_of_birth'),
  gradeLevel: text('grade_level'),
  guardianName: text('guardian_name'),
  guardianContact: text('guardian_contact'),
  email: text('email'),
  notes: text('notes'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject'),
  levelType: text('level_type').notNull().default('k12'),
  gradeLevel: text('grade_level'),
  termId: text('term_id').references(() => terms.id, { onDelete: 'set null' }),
  schedule: text('schedule'),
  room: text('room'),
  color: text('color'),
  passMark: real('pass_mark').notNull().default(60),
  maxScore: real('max_score').notNull().default(100),
  gradeThresholds: text('grade_thresholds', { mode: 'json' }).notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const gradeCategories = sqliteTable('grade_categories', {
  id: text('id').primaryKey(),
  classId: text('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  weightPercent: real('weight_percent').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull()
})

export const enrollments = sqliteTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    enrolledOn: text('enrolled_on').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull()
  },
  (t) => ({
    studentClassUnique: uniqueIndex('enrollments_student_class_unique').on(t.studentId, t.classId)
  })
)

export const assessments = sqliteTable(
  'assessments',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => gradeCategories.id, { onDelete: 'set null' }),
    rubricId: text('rubric_id').references(() => rubrics.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    assessmentDate: text('assessment_date'),
    maxScore: real('max_score').notNull().default(100),
    isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({ classIdx: index('assessments_class_idx').on(t.classId) })
)

export const scores = sqliteTable(
  'scores',
  {
    id: text('id').primaryKey(),
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    pointsEarned: real('points_earned'),
    excused: integer('excused', { mode: 'boolean' }).notNull().default(false),
    late: integer('late', { mode: 'boolean' }).notNull().default(false),
    comment: text('comment'),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    assessmentStudentUnique: uniqueIndex('scores_assessment_student_unique').on(
      t.assessmentId,
      t.studentId
    )
  })
)

export const scoreHistory = sqliteTable(
  'score_history',
  {
    id: text('id').primaryKey(),
    scoreId: text('score_id').notNull(),
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    previousPoints: real('previous_points'),
    newPoints: real('new_points'),
    previousExcused: integer('previous_excused', { mode: 'boolean' }).notNull(),
    newExcused: integer('new_excused', { mode: 'boolean' }).notNull(),
    changedAt: text('changed_at').notNull()
  },
  (t) => ({
    assessmentStudentIdx: index('score_history_assessment_student_idx').on(
      t.assessmentId,
      t.studentId
    )
  })
)

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status').notNull().default('present'),
    note: text('note'),
    createdAt: text('created_at').notNull()
  },
  (t) => ({
    classStudentDateUnique: uniqueIndex('attendance_class_student_date_unique').on(
      t.classId,
      t.studentId,
      t.date
    )
  })
)

export const lessonPlans = sqliteTable(
  'lesson_plans',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    weekLabel: text('week_label'),
    title: text('title').notNull(),
    objectives: text('objectives'),
    framework: text('framework'),
    materials: text('materials'),
    activities: text('activities'),
    homework: text('homework'),
    linkedAssessmentId: text('linked_assessment_id').references(() => assessments.id, {
      onDelete: 'set null'
    }),
    standards: text('standards'),
    status: text('status').notNull().default('planned'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({ classDateIdx: index('lesson_plans_class_date_idx').on(t.classId, t.date) })
)

export const standards = sqliteTable('standards', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  description: text('description').notNull(),
  subject: text('subject'),
  createdAt: text('created_at').notNull()
})

export const rubrics = sqliteTable('rubrics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const rubricCriteria = sqliteTable(
  'rubric_criteria',
  {
    id: text('id').primaryKey(),
    rubricId: text('rubric_id')
      .notNull()
      .references(() => rubrics.id, { onDelete: 'cascade' }),
    standardId: text('standard_id').references(() => standards.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull()
  },
  (t) => ({ rubricIdx: index('rubric_criteria_rubric_idx').on(t.rubricId) })
)

export const rubricLevels = sqliteTable(
  'rubric_levels',
  {
    id: text('id').primaryKey(),
    criterionId: text('criterion_id')
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    points: real('points').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => ({ criterionIdx: index('rubric_levels_criterion_idx').on(t.criterionId) })
)

export const rubricScores = sqliteTable(
  'rubric_scores',
  {
    id: text('id').primaryKey(),
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    criterionId: text('criterion_id')
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => rubricLevels.id, { onDelete: 'cascade' }),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    assessmentStudentCriterionUnique: uniqueIndex(
      'rubric_scores_assessment_student_criterion_unique'
    ).on(t.assessmentId, t.studentId, t.criterionId)
  })
)

export const studentLogEntries = sqliteTable(
  'student_log_entries',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('note'),
    text: text('text').notNull(),
    contactMethod: text('contact_method'),
    followUpNeeded: integer('follow_up_needed', { mode: 'boolean' }).notNull().default(false),
    followUpDone: integer('follow_up_done', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull()
  },
  (t) => ({
    studentIdx: index('student_log_entries_student_idx').on(t.studentId, t.createdAt)
  })
)

export const lessonResources = sqliteTable(
  'lesson_resources',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    url: text('url'),
    filePath: text('file_path'),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).notNull().$type<string[]>(),
    standardId: text('standard_id').references(() => standards.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    standardIdx: index('lesson_resources_standard_idx').on(t.standardId)
  })
)

export const exitTickets = sqliteTable('exit_tickets', {
  id: text('id').primaryKey(),
  classId: text('class_id')
    .notNull()
    .unique()
    .references(() => classes.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  questions: text('questions', { mode: 'json' }).notNull().$type<ExitTicketQuestion[]>(),
  isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const exitTicketResponses = sqliteTable(
  'exit_ticket_responses',
  {
    id: text('id').primaryKey(),
    exitTicketId: text('exit_ticket_id')
      .notNull()
      .references(() => exitTickets.id, { onDelete: 'cascade' }),
    studentName: text('student_name').notNull(),
    answers: text('answers', { mode: 'json' }).notNull().$type<Record<string, string>>(),
    submittedAt: text('submitted_at').notNull()
  },
  (t) => ({
    ticketIdx: index('exit_ticket_responses_ticket_idx').on(t.exitTicketId, t.submittedAt)
  })
)
