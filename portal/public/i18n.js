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
  // Week plan
  Today: '今天',
  Tomorrow: '明天',
  'Due: {title}': '截止：{title}',
  'Start: {title}': '开始做：{title}',
  'Review {n}': '复习 {n} 张',
  Free: '空闲',
  'Last week you aimed to: {goal}': '上周你的目标是：{goal}',
  'How did it go?': '完成得怎么样？',
  'My goal this week, e.g. review every day, finish the essay plan by Thursday':
    '我本周的目标，例如：每天复习、周四前写完作文提纲',
  'My goal this week:': '我本周的目标：',
  'This week': '本周',
  'Did it': '做到了',
  Partly: '部分做到',
  // Study Helper modes
  'How should the Study Helper work?': '学习助手应该怎样帮你？',
  'Examples from: {field}': '举例来自：{field}',
  Change: '修改',
  'Add your subject or major': '填写你的学科或专业',
  'so examples come from what you study.': '这样举例就会来自你学的内容。',
  'e.g. EV Engineering, Fine Art, International Relations': '例如：新能源汽车工程、美术、国际关系',
  'Help me understand': '帮我理解',
  'Explains simply, with examples from your subject, and checks you followed.':
    '用简单的话解释，举你专业的例子，并确认你听懂了。',
  'Explain the main idea of this week’s topic simply': '用简单的话解释本周主题的核心概念',
  'Teach it back': '讲给它听',
  'The Feynman technique: you explain a topic in plain words, it finds the gaps.':
    '费曼学习法：你用简单的话讲解一个主题，它帮你找出没弄懂的地方。',
  'I want to explain a topic in my own words': '我想用自己的话讲解一个主题',
  'Quiz me': '考考我',
  'Questions to answer from memory, one at a time, mixing topics.':
    '凭记忆回答问题，一次一题，混合不同主题。',
  Tutorial: '导师辅导',
  'Like an Oxford tutorial: bring a claim or essay plan and defend it.':
    '像牛津导师课一样：带来一个观点或论文提纲，为它辩护。',
  'I want to test an argument': '我想检验一个论点',
  'Solve step by step': '一步步解题',
  'Pólya’s four steps for a problem: hints, never the answer.':
    '波利亚解题四步法：给提示，不给答案。',
  'Help me work through a problem': '帮我一步步解决一道题',
  // Spaced review
  'Today’s review': '今日复习',
  '{n} cards to review today': '今天有 {n} 张卡片要复习',
  'A few minutes of recall now saves hours of rereading later.':
    '现在花几分钟回忆，能省下以后几个小时的重读。',
  'Start review': '开始复习',
  'When your teacher shares flashcards or practice questions, they come back here for review, a little and often.':
    '老师分享的抽认卡和练习题会出现在这里，少量多次地复习。',
  '{learned} learned · {learning} still learning · {fresh} not started':
    '已掌握 {learned} · 学习中 {learning} · 未开始 {fresh}',
  'Box {box}': '第 {box} 盒',
  'All done for today.': '今天的复习完成了。',
  'Next review: {date}': '下次复习：{date}',
  '{due} due today, {fresh} new': '今天到期 {due} 张，新卡 {fresh} 张',
  'Start review ({n})': '开始复习（{n}）',
  'Review done: {right} of {total} right.': '复习完成：{total} 题答对 {right} 题。',
  'Some answers couldn’t be saved without internet; those cards will come back.':
    '部分答案因没有网络未能保存，这些卡片会再次出现。',
  'The ones you knew come back later; the ones you missed come back tomorrow.':
    '答对的会过一段时间再出现，答错的明天再出现。',
  'one more try': '再试一次',
  '{n} left': '还剩 {n} 张',
  'Say or write your answer first, then check.': '先说出或写下你的答案，再查看。',
  'Show answer': '显示答案',
  'Not yet': '还没记住',
  'I knew it': '我记得',
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

  'No active classes right now.': '目前没有正在进行的课程。',
  'Now: {topic}': '当前：{topic}',
  'Latest mark': '最近成绩',
  'Next:': '接下来：',
  'Nothing waiting to be handed in.': '目前没有待提交的作业。',
  'Open classwork': '打开课业',
  'See progress': '查看进度',
  'My courses': '我的课程',
  'No standards evidence yet.': '还没有学习成果证据。',
  'Learning progress': '学习进展',
  'Based on rubric evidence your teacher has recorded — not a separate grade.': '依据老师记录的评分量规证据，不是另一个成绩。',
  'Mixed: {levels}': '多项表现：{levels}',
  'Evidence recorded': '已有证据',
  'Latest evidence: {source} · {count} pieces total': '最近证据：{source} · 共 {count} 条',
  '{count} pieces of evidence': '{count} 条证据',
  'Open submitted work': '打开已提交作品',
  'Teacher feedback:': '教师反馈：',
  'Student work': '学生作品',
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
  'Source code': '源代码',
  Calendar: '日历',
  'Add homework due dates to your phone or computer calendar. It keeps itself up to date, and ticks off work once it’s handed in.':
    '把作业截止日期添加到手机或电脑的日历中。日历会自动更新，作业提交后会打勾。',
  'Your calendar link': '你的日历链接',
  'Copy link': '复制链接',
  'Open in calendar app': '在日历应用中打开',
  'In Google Calendar: Other calendars → + → From URL, and paste the link. On iPhone it opens the Calendar app. Anyone with this link can see the homework list, so only share it with family.':
    '在 Google 日历中：其他日历 → + → 通过网址添加，然后粘贴链接。在 iPhone 上会打开“日历”应用。任何拿到此链接的人都能看到作业列表，请只分享给家人。',
  'Your calendar link is on.': '你的日历链接已开启。',
  'Make a new link': '生成新链接',
  'Turn off': '关闭',
  'A new link stops the old one working, e.g. if it was shared by mistake.':
    '生成新链接后，旧链接将失效（例如不小心分享出去时）。',
  'Get calendar link': '获取日历链接',
  Copied: '已复制',
  Excused: '免评',
  'Class average': '班级平均',
  'Class average {percent}': '班级平均 {percent}',
  'Your scores': '你的成绩',
  'Show all {count}': '显示全部 {count} 项',
  'Scores over time: from {first} to {last}': '成绩变化：从 {first} 到 {last}',
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
  'Open original': '打开原始资源',
  'Download original': '下载原始资源',
  'Original note': '原始笔记',
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
  'Report cards': '成绩单',
  Replied: '已回复',
  'I’ve read this': '我已阅读',
  Yes: '是',
  No: '否',
  'Please confirm you’ve read this.': '请确认你已阅读。',
  'Please reply.': '请回复。',
  'Reply needed': '需要回复',
  New: '新',
  'New report card': '新的成绩单',
  '{n} new report cards': '{n} 份新的成绩单',
  'Open (PDF)': '打开（PDF）',
  'See all under Grades': '在“成绩”中查看全部',
  'No homework yet.': '暂无作业。',
  'Ask your teacher for a reset': '请老师帮你重置',
  'Teacher?': '老师？',
  'Download EduBoard': '下载 EduBoard',
  Privacy: '隐私说明',
  'Terms of use': '使用条款',
  'Before you start': '开始之前',
  'This Portal shows {names}’s classwork, grades, attendance and messages from their teacher. The school decides what is shared here, and only you and the teacher can see it.':
    '学生门户会显示{names}的作业、成绩、考勤以及老师发来的消息。学校决定在这里分享哪些内容，只有你和老师能看到。',
  'your child': '你的孩子',
  'Please read the terms of use and the privacy notice, then agree below.':
    '请阅读使用条款和隐私说明，然后在下方同意。',
  'I am a parent or guardian, and I agree for my child': '我是家长或监护人，我代表孩子同意',
  'Your name': '你的姓名',
  'I am the student, I am 14 or older, and I agree': '我是学生，已满十四周岁，我同意',
  'If the student is under 14, a parent or guardian needs to agree.':
    '学生不满十四周岁的，需要由家长或监护人同意。',
  'Agree and continue': '同意并继续',
  'Your data': '你的数据',
  'Download a copy of everything this Portal holds about you and your children: profile, classes and grades, handed-in work, answers, messages and Study Helper questions.':
    '下载学生门户保存的关于你和你孩子的全部信息：个人资料、班级和成绩、提交的作业、答案、消息以及向学习助手提出的问题。',
  'Download my data': '下载我的数据',
  'Choose who is agreeing.': '请选择由谁同意。',
  'Please type the parent or guardian’s name.': '请填写家长或监护人的姓名。',
  'The demo account can’t be changed.': '演示账号不能修改。',
  'Ask your teacher for a reset. Once they approve it, you choose a new password here, on this device.':
    '向老师申请重置密码。老师批准后，你就可以在这台设备上设置新密码。',
  'Ask my teacher': '向老师申请',
  'Back to log in': '返回登录',
  'Password reset': '重置密码',
  'Your teacher didn’t approve this reset. Talk to them, then try again.':
    '老师没有批准这次重置。请先和老师沟通，然后再试一次。',
  'This reset request has run out. Ask again if you still need one.':
    '这个重置申请已过期。如果仍需要，请重新申请。',
  'Waiting for your teacher': '等待老师批准',
  'Your request to reset the password for {user} has been sent. Tell your teacher you asked. When they approve it, you can choose a new password here. You can close this page and come back on this device.':
    '已发送 {user} 的密码重置申请。请告诉老师你申请了。老师批准后，你可以在这里设置新密码。你可以先关闭这个页面，之后在这台设备上回来继续。',
  'Check again': '再次查看',
  'Cancel and go back to log in': '取消并返回登录',
  'Choose a new password': '设置新密码',
  'Your teacher approved the reset for {user}.': '老师已批准 {user} 的密码重置。',
  'New password': '新密码',
  'Save and log in': '保存并登录',
  'Enter your username': '请输入用户名',
  'This reset hasn’t been approved by your teacher.': '老师还没有批准这次重置。',
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
  'Choose a file': '选择文件',
  'No file chosen': '未选择文件',
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
