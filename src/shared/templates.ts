// Ready-made starting points for each part of EduBoard a teacher writes in: parent
// letters, Class Story posts, lesson plans and comment-bank sets. Each comes in English
// and Chinese; the interface language picks which. Teachers can save their own letters,
// posts and lesson plans as templates too (settings.savedTemplates).
import type { BankComment } from './commentBank'
import { uiLanguage } from './i18n'

export type TemplateKind = 'letter' | 'story' | 'lesson'

export interface LessonTemplateFields {
  objectives: string
  materials: string
  activities: string
  homework: string
}

/** A template the teacher saved themselves. */
export interface SavedTemplate {
  id: string
  kind: TemplateKind
  name: string
  /** Letters and posts: the text. */
  body?: string
  /** Lesson plans: the four text fields. */
  lesson?: LessonTemplateFields
}

interface Bilingual<T> {
  id: string
  en: { name: string } & T
  zh: { name: string } & T
}

const pick = <T>(t: Bilingual<T>): { id: string; name: string } & T => ({
  id: t.id,
  ...(uiLanguage() === 'zh' ? t.zh : t.en)
})

// --- Parent letters ------------------------------------------------------------------

const LETTERS: Bilingual<{ body: string }>[] = [
  {
    id: 'progress',
    en: {
      name: 'Progress update',
      body: `Dear {guardian},

This is a short update on {name}'s progress in {class}.

{name}'s current grade is {grade} ({percent}), and attendance so far is {attendance}.

Please get in touch if you have any questions.

Kind regards,
{teacher}
{school}`
    },
    zh: {
      name: '学习情况通报',
      body: `{guardian}：

您好！现将{name}在{class}的学习情况简要告知如下。

{name}目前的成绩为{grade}（{percent}），出勤率为{attendance}。

如有任何问题，欢迎随时与我联系。

此致
敬礼

{teacher}
{school}
{date}`
    }
  },
  {
    id: 'attendance',
    en: {
      name: 'Attendance concern',
      body: `Dear {guardian},

I'm writing because {name}'s attendance in {class} is {attendance} so far this term. Regular attendance makes a real difference to how well students keep up.

If there is anything making it hard for {name} to come to class, please let me know so we can help.

Kind regards,
{teacher}
{school}`
    },
    zh: {
      name: '出勤情况提醒',
      body: `{guardian}：

您好！本学期{name}在{class}的出勤率目前为{attendance}。按时上课对跟上学习进度非常重要。

如果孩子到校上课有任何困难，请及时与我联系，我们一起想办法。

此致
敬礼

{teacher}
{school}
{date}`
    }
  },
  {
    id: 'homework',
    en: {
      name: 'Missing homework',
      body: `Dear {guardian},

{name} has some homework in {class} that hasn't been handed in yet. It can be found on the student Portal, and it's not too late to complete it.

Could you check with {name} at home? Thank you for your support.

Kind regards,
{teacher}
{school}`
    },
    zh: {
      name: '作业未交提醒',
      body: `{guardian}：

您好！{name}在{class}还有作业没有提交。作业可以在学生门户上找到，现在补交还来得及。

麻烦您在家提醒一下孩子，感谢您的支持！

此致
敬礼

{teacher}
{school}
{date}`
    }
  },
  {
    id: 'good-news',
    en: {
      name: 'Good news',
      body: `Dear {guardian},

I wanted to share some good news: {name} has been doing really well in {class} this term, with a current grade of {grade} ({percent}).

Please pass on my congratulations. It's been a pleasure to see.

Kind regards,
{teacher}
{school}`
    },
    zh: {
      name: '喜报',
      body: `{guardian}：

您好！很高兴告诉您，{name}本学期在{class}表现非常出色，目前成绩为{grade}（{percent}）。

请代我向孩子表示祝贺，看到孩子的进步我也非常高兴！

此致
敬礼

{teacher}
{school}
{date}`
    }
  },
  {
    id: 'meeting',
    en: {
      name: 'Meeting invitation',
      body: `Dear {guardian},

I'd like to invite you to a short meeting to talk about how {name} is getting on in {class}.

Please reply with a few times that suit you, and I'll confirm one.

Kind regards,
{teacher}
{school}`
    },
    zh: {
      name: '家长面谈邀请',
      body: `{guardian}：

您好！想邀请您来校简短面谈，一起聊聊{name}在{class}的学习情况。

请回复几个您方便的时间，我会尽快确认。

此致
敬礼

{teacher}
{school}
{date}`
    }
  }
]

export function letterTemplates(): { id: string; name: string; body: string }[] {
  return LETTERS.map(pick)
}

// --- Class Story posts ---------------------------------------------------------------

const STORIES: Bilingual<{ body: string }>[] = [
  {
    id: 'learned',
    en: {
      name: 'This week we learned',
      body: 'This week in class we learned about … Ask your child to tell you one thing they found interesting!'
    },
    zh: { name: '本周学习内容', body: '本周我们在课上学习了……请让孩子跟您分享一件他觉得有趣的事！' }
  },
  {
    id: 'reminder',
    en: {
      name: 'Reminder',
      body: 'A quick reminder: please remember to … by … Thank you!'
    },
    zh: { name: '温馨提醒', body: '温馨提醒：请在……之前……谢谢配合！' }
  },
  {
    id: 'celebration',
    en: {
      name: 'Celebration',
      body: 'A big well done to the whole class for … We are so proud of everyone!'
    },
    zh: { name: '表扬', body: '为全班同学点赞！大家在……方面表现非常棒，我们为每一位同学感到骄傲！' }
  },
  {
    id: 'event',
    en: {
      name: 'Upcoming event',
      body: 'Coming up on …: … Students will need to bring … Please let me know if you have any questions.'
    },
    zh: { name: '活动预告', body: '……（日期）将举行……，请同学们带好……。如有疑问，欢迎随时联系我。' }
  },
  {
    id: 'homework',
    en: {
      name: 'Homework heads-up',
      body: 'This week’s homework is on the Portal: … It is due on … Please check it has been handed in.'
    },
    zh: {
      name: '作业通知',
      body: '本周作业已发布在学生门户上：……，截止时间为……。请家长帮忙确认孩子已按时提交。'
    }
  }
]

export function storyTemplates(): { id: string; name: string; body: string }[] {
  return STORIES.map(pick)
}

// --- Lesson plans --------------------------------------------------------------------

const LESSONS: Bilingual<LessonTemplateFields>[] = [
  {
    id: '5e',
    en: {
      name: '5E (Engage, Explore, Explain, Elaborate, Evaluate)',
      objectives: '- Students will be able to …',
      materials: '- ',
      activities:
        '- Engage: a question or demo to spark curiosity\n- Explore: hands-on task in pairs or groups\n- Explain: students share; teacher introduces the key ideas and words\n- Elaborate: apply the idea to a new problem\n- Evaluate: quick check (exit ticket or questions)',
      homework: ''
    },
    zh: {
      name: '5E 教学模式（引入、探究、解释、拓展、评价）',
      objectives: '- 学生能够……',
      materials: '- ',
      activities:
        '- 引入：用一个问题或演示激发兴趣\n- 探究：两人或小组动手探究\n- 解释：学生分享，教师讲解核心概念和词汇\n- 拓展：把所学用于新的问题\n- 评价：快速检测（出门条或提问）',
      homework: ''
    }
  },
  {
    id: 'gradual',
    en: {
      name: 'I do, We do, You do',
      objectives: '- Students will be able to …',
      materials: '- ',
      activities:
        '- Warm-up (5 min): review of last lesson\n- I do (10 min): teacher models the skill, thinking aloud\n- We do (10 min): guided practice together\n- You do (15 min): independent practice\n- Wrap-up (5 min): share and check understanding',
      homework: ''
    },
    zh: {
      name: '我做、我们做、你们做',
      objectives: '- 学生能够……',
      materials: '- ',
      activities:
        '- 热身（5 分钟）：复习上节课内容\n- 我做（10 分钟）：教师示范，边做边讲思路\n- 我们做（10 分钟）：师生共同练习\n- 你们做（15 分钟）：学生独立练习\n- 总结（5 分钟）：分享并检查理解情况',
      homework: ''
    }
  },
  {
    id: 'ppp',
    en: {
      name: 'PPP (Present, Practise, Produce)',
      objectives: '- Students will be able to use … to …',
      materials: '- Flashcards / slides\n- ',
      activities:
        '- Present: introduce the new language in context\n- Practise: controlled drills and pair practice\n- Produce: freer speaking or writing task using the new language\n- Feedback: correct common mistakes together',
      homework: ''
    },
    zh: {
      name: 'PPP 模式（呈现、操练、运用）',
      objectives: '- 学生能够运用……来……',
      materials: '- 单词卡 / 课件\n- ',
      activities:
        '- 呈现：在情境中引入新语言\n- 操练：机械操练和同伴练习\n- 运用：用新语言进行较自由的口语或写作任务\n- 反馈：集体纠正常见错误',
      homework: ''
    }
  },
  {
    id: 'success',
    en: {
      name: 'SUCCESS (oral English)',
      objectives: '- Students will be able to say … using the sentence frame “…”',
      materials: '- Slides\n- Sentence frames\n- ',
      activities:
        '- See It: meet the new words and sentence frame in context\n- Use It: controlled practice with the frame\n- Correct It: spot the mistake together\n- Connect It: link to what students already know\n- Extend It: add a new word or detail to the frame\n- Speak It: pair or group speaking task\n- Show It: a few students perform; quick check',
      homework: ''
    },
    zh: {
      name: 'SUCCESS 口语课',
      objectives: '- 学生能够用句型“……”说出……',
      materials: '- 课件\n- 句型卡\n- ',
      activities:
        '- See It 看：在情境中认识新词和句型\n- Use It 用：用句型进行控制性练习\n- Correct It 改：一起找错\n- Connect It 联：联系已学知识\n- Extend It 拓：在句型中加入新词或细节\n- Speak It 说：同伴或小组口语任务\n- Show It 展：学生展示，快速检测',
      homework: ''
    }
  },
  {
    id: 'workshop',
    en: {
      name: 'Workshop (mini-lesson, work time, share)',
      objectives: '- Students will be able to …',
      materials: '- ',
      activities:
        '- Mini-lesson (10 min): one teaching point, modelled\n- Work time (25 min): students work; teacher confers with small groups\n- Share (10 min): two or three students share their work',
      homework: ''
    },
    zh: {
      name: '工作坊（微讲解、练习、分享）',
      objectives: '- 学生能够……',
      materials: '- ',
      activities:
        '- 微讲解（10 分钟）：讲一个要点并示范\n- 练习（25 分钟）：学生自主练习，教师与小组交流\n- 分享（10 分钟）：两三名学生分享成果',
      homework: ''
    }
  }
]

export function lessonTemplates(): ({ id: string; name: string } & LessonTemplateFields)[] {
  return LESSONS.map(pick)
}

// --- Comment-bank sets ---------------------------------------------------------------

const COMMENT_SETS: Bilingual<{ comments: BankComment[] }>[] = [
  {
    id: 'primary',
    en: {
      name: 'Primary',
      comments: [
        {
          category: 'Strength',
          text: '{name} reads with growing fluency and enjoys sharing stories.'
        },
        {
          category: 'Strength',
          text: '{name} works carefully and takes pride in neat, finished work.'
        },
        {
          category: 'Next step',
          text: '{name} should practise times tables at home a little each day.'
        },
        { category: 'Effort', text: '{name} tries hard with every task, even the tricky ones.' },
        {
          category: 'Behaviour',
          text: '{name} is a kind friend and a helpful member of our class.'
        }
      ]
    },
    zh: {
      name: '小学',
      comments: [
        { category: 'Strength', text: '{name}朗读越来越流利，乐于和大家分享故事。' },
        { category: 'Strength', text: '{name}做事认真，作业整洁完整。' },
        { category: 'Next step', text: '建议{name}每天在家练习一会儿乘法口诀。' },
        { category: 'Effort', text: '{name}对待每项任务都很努力，遇到难题也不退缩。' },
        { category: 'Behaviour', text: '{name}待人友善，是班级里的好帮手。' }
      ]
    }
  },
  {
    id: 'secondary',
    en: {
      name: 'Secondary',
      comments: [
        {
          category: 'Strength',
          text: '{name} explains their reasoning clearly and supports it with evidence.'
        },
        { category: 'Strength', text: '{name} contributes thoughtfully to class discussions.' },
        {
          category: 'Next step',
          text: '{name} should plan revision earlier so that tests are less of a rush.'
        },
        {
          category: 'Next step',
          text: '{name} would benefit from acting on written feedback before the next task.'
        },
        { category: 'Effort', text: '{name} is organised and meets deadlines consistently.' }
      ]
    },
    zh: {
      name: '中学',
      comments: [
        { category: 'Strength', text: '{name}能清楚地阐述自己的思路，并用事实加以论证。' },
        { category: 'Strength', text: '{name}在课堂讨论中发言积极、有见解。' },
        { category: 'Next step', text: '{name}应更早制订复习计划，考试前就不会手忙脚乱。' },
        { category: 'Next step', text: '建议{name}在完成下一项任务前，认真根据书面反馈改进。' },
        { category: 'Effort', text: '{name}做事有条理，总能按时完成任务。' }
      ]
    }
  },
  {
    id: 'eal',
    en: {
      name: 'English as an additional language',
      comments: [
        {
          category: 'Strength',
          text: '{name} is growing in confidence when speaking English in class.'
        },
        { category: 'Strength', text: '{name} uses new vocabulary well in speaking and writing.' },
        {
          category: 'Next step',
          text: '{name} should keep reading English books at home to build vocabulary.'
        },
        {
          category: 'Next step',
          text: 'A next step for {name} is to speak in full sentences using the frames we practise.'
        },
        { category: 'Effort', text: '{name} listens carefully and is not afraid to have a go.' }
      ]
    },
    zh: {
      name: '英语作为第二语言',
      comments: [
        { category: 'Strength', text: '{name}在课堂上说英语越来越自信了。' },
        { category: 'Strength', text: '{name}能在口语和写作中恰当地运用新词汇。' },
        { category: 'Next step', text: '建议{name}在家坚持阅读英文书，积累词汇。' },
        { category: 'Next step', text: '{name}下一步要用课上练习的句型说完整的句子。' },
        { category: 'Effort', text: '{name}听讲认真，敢于开口尝试。' }
      ]
    }
  }
]

export function commentSets(): { id: string; name: string; comments: BankComment[] }[] {
  return COMMENT_SETS.map(pick)
}

// --- Report card layouts -------------------------------------------------------------

export type ReportLayoutPreset = 'standard' | 'compact' | 'detailed'

export interface ReportCardLayout {
  preset: ReportLayoutPreset
  showCategories: boolean
  showAssessments: boolean
  showComment: boolean
  showAttendance: boolean
  showSignatures: boolean
  /** Replaces "Student report" at the top when set (e.g. "End of term report"). */
  title: string
  /** A line printed at the bottom of every card. */
  footer: string
}

const PRESETS: Record<ReportLayoutPreset, Omit<ReportCardLayout, 'preset' | 'title' | 'footer'>> = {
  standard: {
    showCategories: true,
    showAssessments: true,
    showComment: true,
    showAttendance: true,
    showSignatures: false
  },
  compact: {
    showCategories: false,
    showAssessments: false,
    showComment: true,
    showAttendance: false,
    showSignatures: false
  },
  detailed: {
    showCategories: true,
    showAssessments: true,
    showComment: true,
    showAttendance: true,
    showSignatures: true
  }
}

/** The layout a preset starts from. */
export function reportLayoutFromPreset(preset: ReportLayoutPreset): ReportCardLayout {
  return { preset, ...PRESETS[preset], title: '', footer: '' }
}

/** A saved layout with anything missing filled from its preset. */
export function resolveReportLayout(
  saved: Partial<ReportCardLayout> | undefined
): ReportCardLayout {
  const preset = saved?.preset && saved.preset in PRESETS ? saved.preset : 'standard'
  return { ...reportLayoutFromPreset(preset), ...saved, preset }
}
