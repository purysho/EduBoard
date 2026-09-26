// Portal interface language: English or Simplified Chinese.
//
// Interface text (buttons, headings, hints) is translated here, by hand, once. It never
// goes through AI, so it's instant, free, works offline and can't be wrong in a
// different way on every page load. What the teacher writes (homework, posts, study
// guides, messages) is different: that's translated on request by the teacher's AI key
// (see /api/me/translate), because nobody can write that dictionary in advance.
//
// The English text is the key. t('Log in') returns the Chinese when the interface is in
// Chinese and a translation exists, and the English otherwise, so a missing entry shows
// English rather than a blank or a key name. test/i18n.test.js checks every t('…') in
// index.html has an entry here.

// Globals used by index.html's own script, which loads after this one.
/* exported setUiLang, uiLocale, defaultReadingLanguage, t, tError */

const UI_LANG_KEY = 'eduboard-ui-lang'

function detectUiLang() {
  try {
    const saved = localStorage.getItem(UI_LANG_KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser's language.
  }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en'
}

const UI_LANG = detectUiLang()
document.documentElement.lang = UI_LANG === 'zh' ? 'zh-CN' : 'en'

function setUiLang(lang) {
  try {
    localStorage.setItem(UI_LANG_KEY, lang)
  } catch {
    // Not saved, but this page load still switches.
  }
  location.reload()
}

/** Locale for dates and month names; undefined means "the browser's own". */
function uiLocale() {
  return UI_LANG === 'zh' ? 'zh-CN' : undefined
}

/** The language AI translations go into by default: the interface language. */
function defaultReadingLanguage() {
  return UI_LANG === 'zh' ? 'Chinese' : 'English'
}

const ZH = {
  // Page and navigation
  'EduBoard Portal': 'EduBoard 学生门户',
  Home: '首页',
  Classwork: '课业',
  Study: '学习',
  Grades: '成绩',
  Messages: '消息',
  Account: '账户',
  Sections: '栏目',
  'Loading…': '加载中…',
  'Switch language': '切换语言',

  // Offline
  unknown: '未知',
  'Viewing saved data': '正在查看已保存的数据',
  "You're offline — last synced {when}. Reconnect to see the latest.":
    '你目前处于离线状态，上次同步于 {when}。重新联网后可查看最新内容。',
  "You're offline": '你目前处于离线状态',
  'Nothing saved on this device yet. Connect once to load your dashboard — after that, it stays available offline.':
    '这台设备上还没有保存任何数据。请先联网打开一次，之后离线也能查看。',
  'Try again': '重试',

  // Passwords
  Show: '显示',
  Hide: '隐藏',
  'Show password': '显示密码',
  'Hide password': '隐藏密码',

  // Log in
  'Welcome back': '欢迎回来',
  'Welcome back, {name}': '欢迎回来，{name}',
  'Sign in to see your homework, grades and class materials.': '登录后可查看作业、成绩和课程资料。',
  Username: '用户名',
  Password: '密码',
  'Log in': '登录',
  'Forgot your password?': '忘记密码？',
  "Ask your teacher to reset it. They'll give you a temporary one to log in with, and you can change it under Account.":
    '请老师帮你重置。老师会给你一个临时密码，登录后可在“账户”中修改。',
  'New here?': '第一次使用？',
  'Use the invite link or QR code your teacher gave you.': '请使用老师发给你的邀请链接或二维码。',

  // Joining a class
  "Can't join": '无法加入',
  'Join {className}': '加入 {className}',
  'Pick your name, confirm your date of birth, and choose a username and password.':
    '选择你的名字，确认出生日期，然后设置用户名和密码。',
  Student: '学生',
  'Date of birth': '出生日期',
  Month: '月',
  Day: '日',
  Year: '年',
  "3–40 characters. You'll use it to log in.": '3–40 个字符，登录时使用。',
  'At least 8 characters': '至少 8 个字符',
  'Create account': '创建账户',
  "This confirms it's really you — must match what your teacher has on file.":
    '用于确认是你本人，需要与老师记录的一致。',
  'Your teacher hasn’t recorded this yet — enter it now so it’s on file for next time.':
    '老师还没有记录你的出生日期，现在填写后会保存下来。',

  'Hi {name}!': '你好，{name}！',
  'Create your account for {className}.': '创建你在 {className} 的账户。',
  'Enter your name and date of birth, then choose a username and password.':
    '填写你的姓名和出生日期，然后设置用户名和密码。',
  'First name': '名',
  'Last name': '姓',
  'Use the same name your teacher knows you by.': '请填写老师知道的名字。',
  'This helps your teacher confirm who you are.': '这有助于老师确认你的身份。',
  'Please enter your date of birth': '请填写出生日期',
  'Please enter your first and last name': '请填写你的姓和名',

  // Profile
  'Profile photo': '头像',
  'Not set': '未设置',
  'Set up your profile so your teacher gets to know you.': '完善个人资料，让老师更了解你。',
  'Set up profile': '完善资料',
  'Edit profile': '编辑资料',
  Photo: '照片',
  '(.jpg, .png or .webp, up to 8 MB)': '（.jpg、.png 或 .webp，不超过 8 MB）',
  Remove: '删除',
  "Photos are resized and cleaned (location data removed) before they're saved.":
    '照片保存前会自动缩小尺寸，并删除位置信息。',
  'Preferred name': '希望的称呼',
  Pronouns: '人称代词',
  'e.g. she/her, he/him, they/them': '例如：她、他',
  'About me': '关于我',
  'A few words about you': '简单介绍一下自己',
  'Share my birthday (month and day, not year) with my teacher':
    '让老师看到我的生日（只显示月和日，不显示年份）',
  'My learning goals': '我的学习目标',
  'What do you want to get better at this term?': '这学期你想在哪些方面进步？',
  'Anything my teacher should know': '希望老师了解的事',
  'e.g. how you learn best, accessibility needs': '例如：你最适合的学习方式、无障碍需求',
  'Preferred language': '偏好语言',
  'Translations go into this language.': '翻译会译成这种语言。',
  'Private notes': '私人笔记',
  '(only you can see these)': '（只有你自己能看到）',
  'Reminders, ideas, anything': '提醒、想法，什么都可以',
  'Your teacher sees everything here except your private notes and your date of birth.':
    '除了私人笔记和出生日期，这里的内容老师都能看到。',
  'Save profile': '保存资料',
  'Saving…': '保存中…',
  'Set up your profile': '完善个人资料',
  'Add a photo and a few words so your teacher gets to know you. Everything is optional.':
    '上传一张照片、写几句话，让老师更了解你。所有内容都是选填。',
  'Not now': '以后再说',

  // Homework
  Other: '其他',
  'Quick check': '随堂小测',
  'Quick check — {correct}/{total} correct': '随堂小测：答对 {correct}/{total}',
  'Submit answers': '提交答案',
  Late: '迟交',
  Missing: '未交',
  'Not started': '未开始',
  Submitted: '已提交',
  Done: '已完成',
  'Due {when}': '截止：{when}',
  '(from your teacher)': '（老师提供）',
  'Your submission': '你的提交',
  'Grade: {grade}': '成绩：{grade}',
  'Grade:': '成绩：',
  'Feedback:': '评语：',
  'Already turned in. Submitting again replaces it.': '已经提交过了，再次提交会替换原来的内容。',
  'Already turned in with {file}. Submitting again replaces it.':
    '已经提交过了（附件：{file}），再次提交会替换原来的内容。',
  'Your answer': '你的回答',
  'Attach a file': '上传文件',
  'Documents, images, audio or video, up to 20 MB. Programs and files with macros are refused.':
    '可上传文档、图片、音频或视频，不超过 20 MB。程序文件和带宏的文件会被拒绝。',
  'Update submission': '更新提交',
  'Turn in': '提交',

  // Translation of teacher content
  Translate: '翻译',
  'Translating…': '翻译中…',
  'Hide translation': '隐藏翻译',
  'Show original': '显示原文',
  '{language} translation by AI. It may contain mistakes.': 'AI 翻译（{language}），可能有误。',
  'Only the first part was translated because it is very long.': '内容太长，只翻译了前面一部分。',
  'Translate into {language}': '翻译成{language}',
  'Translate messages into': '消息翻译成',
  'Listen to translation': '朗读译文',
  English: '英文',
  'Chinese (中文)': '中文',
  'Spanish (Español)': '西班牙语 (Español)',
  'French (Français)': '法语 (Français)',
  'German (Deutsch)': '德语 (Deutsch)',
  'Japanese (日本語)': '日语 (日本語)',
  'Korean (한국어)': '韩语 (한국어)',
  'Russian (Русский)': '俄语 (Русский)',
  'Arabic (العربية)': '阿拉伯语 (العربية)',
  'Portuguese (Português)': '葡萄牙语 (Português)',
  'Vietnamese (Tiếng Việt)': '越南语 (Tiếng Việt)',
  'Hindi (हिन्दी)': '印地语 (हिन्दी)',

  // Messages
  'No messages yet — say hello below.': '还没有消息，在下面打个招呼吧。',
  'Your teacher': '你的老师',
  'Message the teacher…': '给老师留言…',
  Send: '发送',
  '1 new message from your teacher': '老师发来 1 条新消息',
  '{n} new messages from your teacher': '老师发来 {n} 条新消息',

  // Study
  'Audio isn’t supported in this browser.': '这个浏览器不支持朗读。',
  Stop: '停止',
  'Study guide': '学习指南',
  Listen: '朗读',
  'Flashcards ({n})': '闪卡（{n}）',
  'Practice quiz ({n})': '练习题（{n}）',
  'No study aids for this one yet.': '这份资料暂时还没有学习辅助内容。',
  Answer: '答案',
  Question: '问题',
  'card {n} of {total}': '第 {n}/{total} 张',
  'tap to flip': '点击翻面',
  '← Prev': '← 上一张',
  'Next →': '下一张 →',
  Shuffle: '打乱顺序',
  Close: '关闭',
  'Check answers': '核对答案',
  '✅ Correct.': '✅ 正确。',
  '❌ Answer: {answer}.': '❌ 正确答案：{answer}。',
  'You got {right} of {total}.': '答对 {right}/{total} 题。',
  Materials: '课程资料',
  'Study Helper': '学习助手',
  "Ask about your homework or class materials. Answers cite your teacher's materials where they can.":
    '可以就作业或课程资料提问。回答会尽量引用老师提供的资料。',
  "Ask about your homework or a topic you're stuck on…": '问问作业，或你卡住的知识点…',
  Ask: '提问',
  'Thinking…': '思考中…',
  'Sources:': '来源：',

  // AI help and "Used AI"
  'Used AI': '使用了 AI',
  'Get AI help': 'AI 辅导',
  'The AI helps you understand the task and plan your answer. It won’t write it for you. Your teacher can see what you ask, and this assignment will show as “Used AI”.':
    'AI 会帮你理解题目、规划答案，但不会替你写。老师可以看到你问了什么，这项作业也会显示为“使用了 AI”。',
  'I used AI (the Study Helper, ChatGPT or any other AI tool) for this work':
    '我在这项作业中使用了 AI（学习助手、ChatGPT 或其他 AI 工具）',
  'You asked the AI about this assignment, so it will show as “Used AI” to your teacher.':
    '你就这项作业询问过 AI，所以老师会看到它显示为“使用了 AI”。',
  'Your teacher can see what you ask the Study Helper and its answers. Copying its answers into your homework shows as “Used AI”.':
    '老师可以看到你向学习助手提的问题和它的回答。把它的回答抄进作业会显示为“使用了 AI”。',
  'Quiz me on what we covered this week': '就本周学的内容考考我',
  'Explain the main idea simply': '用简单的话解释主要内容',
  'Check my understanding: I’ll explain it and you tell me what I missed':
    '检查我的理解：我来解释，你告诉我漏了什么',

  // Home and dates
  'No updates yet.': '暂无动态。',
  today: '今天',
  tomorrow: '明天',
  yesterday: '昨天',
  'in {n} days': '{n} 天后',
  '{n} days ago': '{n} 天前',
  '{n} missing': '{n} 项未交',
  '{n} due this week': '本周 {n} 项到期',
  "You're all caught up.": '所有作业都已完成。',
  'Nothing due in the next 7 days, and nothing missing.':
    '未来 7 天没有到期的作业，也没有未交的作业。',
  'To do': '待完成',
  'Due soon': '即将到期',
  'Class Story': '班级动态',
  'No homework yet.': '暂无作业。',
  Finished: '已结课',
  'Finished classes': '已结课的课程',
  "This class has finished, so work can't be handed in any more.": '这门课已结课，不能再提交作业。',

  // Grades
  'Letter grade {letter}': '等级 {letter}',
  'No grade yet': '暂无成绩',
  'Attendance {rate}': '出勤率 {rate}',
  Portfolio: '作品集',

  // Tour
  'Welcome!': '欢迎！',
  'Welcome, {name}!': '欢迎，{name}！',
  "This is your class Portal. Here's a quick look around. It takes about 30 seconds.":
    '这是你的课程门户。花 30 秒左右快速了解一下吧。',
  'Prefer Chinese? Tap 中文 at the top right.': '想用英文界面？点右上角的 English。',
  'Due soon lists anything missing first, then what’s due this week. Tap one to open it. Your teacher’s class updates appear below.':
    '“即将到期”会先列出未交的作业，再列出本周到期的作业，点击即可打开。老师发布的班级动态在下方。',
  'Every assignment, grouped by unit. Open one to read the instructions, attach your work and turn it in. Quick checks are marked straight away.':
    '所有作业按单元分组。打开一项即可查看要求、上传作业并提交。随堂小测会立即批改。',
  'Materials your teacher shared, with study guides you can read or listen to, flashcards and practice quizzes. Stuck? Ask the Study Helper.':
    '老师分享的课程资料，包括可阅读或朗读的学习指南、闪卡和练习题。遇到困难？问问学习助手。',
  'Grades and messages': '成绩和消息',
  'Grades shows your marks and attendance for each class. Messages is a private chat with your teacher, with a translate button if you need it.':
    '“成绩”显示每门课的分数和出勤率。“消息”是你和老师的私聊，需要时可以点“翻译”。',
  'Make it yours': '个性化设置',
  'Add a photo and a few words to your profile, get weekly email updates, or change your password. You can replay this tour from here any time.':
    '可以上传照片、完善个人资料、订阅每周邮件或修改密码。随时可以在这里重新查看本导览。',
  'Anything your teacher wrote has a Translate button.': '老师写的内容都有“翻译”按钮。',
  'Skip tour': '跳过导览',
  Back: '上一步',
  Next: '下一步',
  'Show me around': '带我看看',
  '{step} of {total}': '{step}/{total}',

  // Dashboard
  'Every assignment, grouped by unit.': '所有作业，按单元分组。',
  'Your teacher’s materials, flashcards and practice quizzes, and an AI Study Helper.':
    '老师的课程资料、闪卡和练习题，还有 AI 学习助手。',
  'Your marks and attendance in each class.': '你在每门课的成绩和出勤。',
  'A private chat with your teacher.': '和老师的私聊。',
  'Your profile, language and sign-in.': '个人资料、语言和登录设置。',
  'Install the Portal to open it from your home screen like any other app.':
    '安装后可以像其他应用一样从主屏幕打开。',
  'Install the app': '安装应用',
  'To add the Portal to your home screen: tap the Share button, then “Add to Home Screen”.':
    '添加到主屏幕：点“分享”按钮，然后选“添加到主屏幕”。',
  Welcome: '欢迎',
  'No student linked to this account yet.': '这个账户还没有关联学生。',
  Profile: '个人资料',
  Language: '语言',
  'Choose the language for buttons and menus. Anything your teacher writes can also be translated with its Translate button.':
    '选择按钮和菜单使用的语言。老师写的内容也可以用“翻译”按钮翻译。',
  'Email updates': '邮件通知',
  "Get a weekly summary emailed to you — grades, attendance, what's due, and any class updates.":
    '每周通过邮件接收摘要：成绩、出勤、即将到期的作业和班级动态。',
  Save: '保存',
  'Saved.': '已保存。',
  'Change your password. This signs you out on every other device and cancels any quick-login QR codes.':
    '修改密码。修改后其他设备会自动退出，快速登录二维码也会失效。',
  'Current password': '当前密码',
  'New password (at least 8 characters)': '新密码（至少 8 个字符）',
  'Change password': '修改密码',
  'Password changed. Other devices have been signed out.': '密码已修改，其他设备已退出登录。',
  'This device': '本设备',
  'Get quick-login QR': '获取快速登录二维码',
  'Show the tour again': '重新查看导览',
  'Log out': '退出登录',
  'Save this image — opening it logs you in with one tap, no typing.':
    '保存这张图片，打开它即可一键登录，无需输入。',
  Download: '下载',

  // Messages from the server (see tError)
  'Something went wrong': '出了点问题',
  'Wrong username or password': '用户名或密码错误',
  'Too many attempts. Please wait a few minutes and try again.': '尝试次数过多，请等几分钟再试。',
  'Too many failed attempts for this account. Wait a few minutes, or ask your teacher to reset your password.':
    '这个账户登录失败次数过多。请等几分钟，或请老师帮你重置密码。',
  'Not logged in': '尚未登录',
  'All fields are required': '请填写所有必填项',
  'Invalid or already-used code': '邀请码无效或已被使用',
  'Date of birth does not match our records': '出生日期与记录不符',
  'That username is taken': '这个用户名已被使用',
  'Username must be 3–40 characters': '用户名需要 3–40 个字符',
  'Password must be at least 8 characters': '密码至少需要 8 个字符',
  'Password is too long (72 bytes max)': '密码太长（最多 72 字节）',
  'Your current password is incorrect': '当前密码不正确',
  "That doesn't look like an email address": '这看起来不像是邮箱地址',
  'Add some text or a file before submitting': '请先填写答案或上传文件再提交',
  'That file is too large (20 MB max).': '文件太大（最大 20 MB）。',
  'That upload is too large.': '上传的内容太大。',
  'Assignment not found': '找不到这项作业',
  'Not enrolled in this class': '你没有加入这门课',
  'Not your student': '无权访问这名学生',
  'Message is empty': '消息内容为空',
  'Not found': '找不到内容',
  'Nothing to translate': '没有可翻译的内容',
  'Pick a language from the list': '请从列表中选择语言',
  'Translation failed. Try again in a moment.': '翻译失败，请稍后再试。',
  'AI request failed. Try again in a moment.': 'AI 请求失败，请稍后再试。',
  'The teacher hasn’t set up AI for students yet — ask them to add a key in Settings.':
    '老师还没有为学生开通 AI 功能，请联系老师在设置中添加密钥。',
  "You're sending AI requests too quickly. Wait a minute and try again.":
    'AI 请求太频繁了，请等一分钟再试。',
  "You've reached today's AI limit for this account. It resets within 24 hours.":
    '这个账户今天的 AI 使用次数已用完，24 小时内会重置。',
  'Too many photo uploads. Try again in an hour.': '上传照片次数过多，请一小时后再试。',
  'Choose a photo first': '请先选择照片',
  'Photos must be .jpg, .png or .webp': '照片必须是 .jpg、.png 或 .webp 格式',
  'That photo is too large (8 MB max)': '照片太大（最大 8 MB）',
  "That isn't a JPEG, PNG or WebP image": '这不是 JPEG、PNG 或 WebP 图片',
  "That date of birth isn't a real past date": '这个出生日期无效',
  'Something went wrong on the server. Please try again.': '服务器出了点问题，请重试。',
  'Failed to fetch': '无法连接服务器，请检查网络。',
  'Load failed': '无法连接服务器，请检查网络。',
  'the document contains macros': '文档中包含宏',
  'the document contains embedded objects': '文档中包含嵌入对象',
  'the file is empty': '文件是空的'
}

/** Interface text in the current language, with {placeholders} filled in. */
function t(text, vars) {
  let out = (UI_LANG === 'zh' && Object.hasOwn(ZH, text) && ZH[text]) || text
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m))
  }
  return out
}

// Server messages that carry a detail after a fixed start. The detail is translated too
// when it's one of the known phrases above.
const ZH_PATTERNS = [
  [/^This file can't be submitted: (.+?)\.?$/, (d) => `这个文件无法提交：${d}。`],
  [/^That isn't a usable photo: (.+)$/, (d) => `这张照片无法使用：${d}`],
  [/^"\.(\w+)" files can't be submitted$/, (_, ext) => `不能提交 .${ext} 文件`],
  [
    /^this is a (Windows|Linux|macOS) program, not a \.(\w+) file$/,
    (_, os, ext) => `这是 ${os} 程序，不是 .${ext} 文件`
  ],
  [/^this is a script, not a \.(\w+) file$/, (_, ext) => `这是脚本文件，不是 .${ext} 文件`],
  [
    /^this is a Windows shortcut, not a \.(\w+) file$/,
    (_, ext) => `这是 Windows 快捷方式，不是 .${ext} 文件`
  ],
  [/^the file's contents don't match "\.(\w+)"$/, (_, ext) => `文件内容与 .${ext} 格式不符`]
]

/** A message from the server (or the network), in the interface language. */
function tError(message) {
  const text = String(message || 'Something went wrong')
  if (UI_LANG !== 'zh') return text
  if (Object.hasOwn(ZH, text)) return ZH[text]
  for (const [pattern, render] of ZH_PATTERNS) {
    const m = pattern.exec(text)
    if (m) return render(tError(m[1]), ...m.slice(1))
  }
  return text
}

document.title = t('EduBoard Portal')
