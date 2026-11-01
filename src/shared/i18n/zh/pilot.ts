// Local-only pilot mode, Settings → What leaves this computer (from shared/dataFlows.ts),
// the pilot summary and the password prompt. docs/DATA_FLOWS.md reads this file too.
export const PILOT: Record<string, string> = {
  'Turned off in this local-only pilot: {what}. Nothing was sent.':
    '本地试点模式下已关闭：{what}。没有发送任何内容。',
  'Turned off in this local-only pilot': '本地试点模式下已关闭',
  '{what} This goes through the Portal, which is turned off here so that no student data leaves this computer. Everything else in EduBoard works as usual.':
    '{what}这项功能需要通过学生门户，而本机已关闭门户，以确保学生数据不离开这台电脑。EduBoard 的其他功能照常使用。',
  'What leaves this computer': '哪些数据会离开这台电脑',
  'Nothing about your classes leaves this computer. See what is turned off.':
    '您的班级数据不会离开这台电脑。点击查看哪些功能已关闭。',
  'Local-only pilot': '本地试点',
  'Protect your class data with a password?': '要用密码保护您的班级数据吗？',
  'With a password, your classes are encrypted on this computer and EduBoard asks for it when it opens, so someone else using this computer can’t see your students. You get a recovery key in case you forget it.':
    '设置密码后，您的班级数据会在这台电脑上加密，打开 EduBoard 时需要输入密码，其他使用这台电脑的人就看不到您的学生信息。您还会得到一个恢复密钥，以防忘记密码。',
  'Strongly recommended in this pilot, especially on a shared or school computer.':
    '在本次试点中强烈建议开启，尤其是在共用电脑或学校电脑上。',
  'You can turn it on any time in Settings → Data and security.':
    '您随时可以在“设置 → 数据与安全”中开启。',
  'Turned off: this computer is in a local-only pilot, so nothing leaves it.':
    '已关闭：这台电脑处于本地试点模式，任何数据都不会离开本机。',
  'Your classes are ready, and everything stays on this computer. The extras below are there when you want them.':
    '您的班级已准备就绪，所有数据都保存在这台电脑上。下面的额外功能可以在需要时再使用。',
  recommended: '建议',
  On: '已开启',
  'In a local-only pilot, nothing about your classes or students leaves this computer. The Portal, AI, the weekly email to families, group chats and the usage count are turned off, and EduBoard refuses them even if asked. EduBoard still checks for updates (that sends only its version number) and the classroom tools on the school Wi-Fi still work.':
    '在本地试点模式下，有关您的班级和学生的任何数据都不会离开这台电脑。学生门户、AI、每周家长邮件、群聊和使用统计都会关闭，即使有请求 EduBoard 也会拒绝。EduBoard 仍会检查更新（只发送版本号），在学校 Wi-Fi 上使用的课堂工具也照常可用。',
  'Your school turned this on for everyone on this computer, so it can’t be changed here (the file is {file}).':
    '您的学校已为这台电脑上的所有用户开启此项，因此无法在这里更改（文件位置：{file}）。',
  'Your school set this for everyone on this computer, so it can’t be changed here (the file is {file}).':
    '您的学校已为这台电脑上的所有用户设定此项，因此无法在这里更改（文件位置：{file}）。',
  'Keep everything on this computer (local-only pilot)': '所有数据只保存在这台电脑上（本地试点）',
  'Your Portal address and AI key stay saved but aren’t used while this is on.':
    '开启期间，您的门户地址和 AI 密钥仍会保存，但不会被使用。',
  'Every connection EduBoard can make': 'EduBoard 可能建立的所有网络连接',
  'Everything else stays in the database on this computer. Your school’s IT can read the same list in docs/DATA_FLOWS.md.':
    '其他所有数据都保存在这台电脑的数据库中。学校的 IT 人员可以在 docs/DATA_FLOWS.md 中查看同样的清单。',
  'In a pilot:': '试点模式下：',
  'Goes to': '发送到',
  Sends: '发送内容',
  When: '何时发生',
  'By default': '默认情况',
  'In a pilot': '试点模式下',
  'Pilot summary': '试点总结',
  'At the end of a pilot, save this file and send it yourself to whoever runs the pilot, if you’re happy to. It holds rough counts only: no names, grades, comments or anything anyone wrote. EduBoard never sends it.':
    '试点结束时，如果您愿意，可以保存这个文件并亲自发给试点负责人。文件只包含大致的数量范围：没有姓名、成绩、评语或任何人写的内容。EduBoard 从不自动发送它。',
  'Exactly what the file contains': '文件的完整内容',
  'not used': '未使用',
  'The pilot summary couldn’t be saved.': '无法保存试点总结。',
  'Save pilot summary…': '保存试点总结…',
  '{what}: turned off, because this computer is in a local-only pilot, so nothing leaves it. See What leaves this computer.':
    '{what}：已关闭，因为这台电脑处于本地试点模式，任何数据都不会离开本机。详见“哪些数据会离开这台电脑”。',
  'For a pilot, export the pilot pack: it also sets the interface language and turns on local-only pilot mode, so no student data leaves the computers it’s installed on.':
    '用于试点时，请导出试点配置包：它还会设置界面语言并开启本地试点模式，使安装了它的电脑上的学生数据都不会离开本机。',
  'The same pack, set to turn on local-only pilot mode on every computer it’s installed on: no Portal, AI, email or group chats.':
    '内容相同的配置包，但会在安装它的每台电脑上开启本地试点模式：不使用学生门户、AI、邮件或群聊。',
  'Export pilot pack': '导出试点配置包',
  'Every connection, local-only pilot, pilot summary': '所有网络连接、本地试点、试点总结',
  'privacy network internet data flows connections pilot local only offline summary export it':
    '隐私 网络 互联网 数据流向 连接 试点 本地 离线 总结 导出 IT privacy network pilot offline',
  'Interface language: {language}': '界面语言：{language}',
  'Local-only pilot mode: no student data leaves the computer':
    '本地试点模式：学生数据不会离开电脑',
  'Local-only pilot mode turned on: the Portal, AI, email and group chats are turned off':
    '开启本地试点模式：学生门户、AI、邮件和群聊将被关闭',
  'Local-only pilot mode turned off': '关闭本地试点模式',
  'Protect your class data with a password': '用密码保护您的班级数据',
  'Strongly recommended in a pilot: your classes are then encrypted on this computer, and EduBoard asks for the password when it opens. You get a recovery key in case you forget it.':
    '试点中强烈建议设置：设置后，您的班级数据会在这台电脑上加密，打开 EduBoard 时需要输入密码。您还会得到一个恢复密钥，以防忘记密码。',
  'Your classes are then encrypted on this computer, and EduBoard asks for the password when it opens. You get a recovery key in case you forget it.':
    '设置后，您的班级数据会在这台电脑上加密，打开 EduBoard 时需要输入密码。您还会得到一个恢复密钥，以防忘记密码。',
  'Set a password': '设置密码',

  // How each connection is treated in a pilot.
  Off: '关闭',
  'Stays on': '保持开启',
  'Only when you ask': '仅在您操作时',
  'Stays on (school Wi-Fi only)': '保持开启（仅限学校 Wi-Fi）',

  // shared/dataFlows.ts
  'Checking for updates': '检查更新',
  'GitHub (api.github.com), or your Portal server if you set one up, which asks GitHub for you.':
    'GitHub（api.github.com）；如果您设置了学生门户服务器，则由门户代您向 GitHub 查询。',
  'An ordinary web request with EduBoard’s version number. Nothing about you, your classes or your students.':
    '一个普通的网络请求，只带有 EduBoard 的版本号。不包含有关您、您的班级或学生的任何信息。',
  'Shortly after EduBoard opens, then every 4 hours, and when you press Check for updates.':
    'EduBoard 打开后不久，之后每 4 小时一次，以及您点击“检查更新”时。',
  'On.': '开启。',
  'Stays on, because it sends only the version number. It goes straight to GitHub, not through a Portal.':
    '保持开启，因为它只发送版本号。直接连接 GitHub，不经过学生门户。',
  'Downloading an update': '下载更新',
  'GitHub’s download servers, or your Portal server if you set one up.':
    'GitHub 的下载服务器；如果您设置了学生门户服务器，则从门户下载。',
  'A request for the new installer file. Nothing about you or your classes.':
    '请求新的安装文件。不包含有关您或您的班级的任何信息。',
  'In the background when automatic updates are on, or when you press Update now.':
    '开启自动更新时在后台进行，或在您点击“立即更新”时进行。',
  'On (Settings → Help and updates → automatic updates).': '开启（设置 → 帮助与更新 → 自动更新）。',
  'Only when you press Update now. Nothing downloads by itself.':
    '仅在您点击“立即更新”时下载，不会自动下载任何内容。',
  'The student Portal (publishing and syncing)': '学生门户（发布与同步）',
  'The Portal address in Settings → Portal and families: a server your school runs.':
    '“设置 → 学生门户与家长”中的门户地址：由您的学校运行的服务器。',
  'Class names; students’ names, dates of birth and student numbers; enrolments; grades and scores with your comments; attendance rates; class points; homework and attachments; shared resources; report cards, posts and messages; and your Portal AI key and email settings, so the Portal can use them. It reads back handed-in work, messages, profiles and new sign-ups.':
    '班级名称；学生的姓名、出生日期和学号；选课情况；成绩、分数及您的评语；出勤率；课堂积分；作业及附件；共享资源；成绩单、班级动态和消息；以及您的门户 AI 密钥和邮件设置，以便门户使用。它还会取回学生提交的作业、消息、个人资料和新注册信息。',
  'When you publish, a moment after changes once a Portal is set up, and when you open Portal screens.':
    '您发布时；设置门户后，每次更改后片刻；以及您打开门户相关页面时。',
  'Off until you add a Portal address and sync secret.': '在您添加门户地址和同步密钥之前保持关闭。',
  'Off. Nothing is published and Portal screens are turned off.':
    '关闭。不会发布任何内容，门户相关页面也会关闭。',
  'AI suggestions in the app': '应用内的 AI 建议',
  'The AI provider you choose in Settings → AI: DeepSeek, Qwen, Zhipu, Anthropic, or an address you enter.':
    '您在“设置 → AI”中选择的 AI 服务商：DeepSeek、通义千问、智谱、Anthropic，或您输入的地址。',
  'What the button needs. Lesson and unit drafts: the topic, your class profile and counts about the class, no names. Report comment phrases: the student’s name, grade, attendance and recent notes. Feedback drafts: the student’s handed-in work. Notebook, study guides and practice sets: your resources’ text. Newsletter: the week’s facts.':
    '只发送该按钮所需的内容。教案和单元草稿：主题、班级概况和班级的统计数字，不含姓名。成绩单评语短语：学生的姓名、成绩、出勤和近期备注。反馈草稿：学生提交的作业。笔记本、学习指南和练习：您的资源文本。班级简报：本周的情况。',
  'Only when you press an AI button.': '仅在您点击 AI 按钮时。',
  'Off until you enter an AI key.': '在您输入 AI 密钥之前保持关闭。',
  'Off. AI buttons are greyed out.': '关闭。AI 按钮显示为灰色。',
  'AI for students on the Portal': '学生门户上的学生 AI',
  'Your Portal server, which calls the AI provider chosen in Settings → AI → AI for students.':
    '您的学生门户服务器，由它调用“设置 → AI → 学生 AI”中选择的 AI 服务商。',
  'Students’ Study Helper questions with matching class material and a nameless practice summary; messages and classwork to translate.':
    '学生向学习助手提出的问题，以及相关的课堂资料和不含姓名的练习概况；需要翻译的消息和课堂作业。',
  'When students use the Study Helper or Translate on the Portal. Your key reaches the Portal when you publish.':
    '学生在门户上使用学习助手或翻译时。您发布时，密钥会发送到门户。',
  'Off until you enter a key for students and publish.': '在您输入学生 AI 密钥并发布之前保持关闭。',
  'Off, because nothing is published.': '关闭，因为不会发布任何内容。',
  'Weekly email to families and to you': '发给家长和您的每周邮件',
  'Your Portal server, which sends it through the email account in Settings → Portal and families.':
    '您的学生门户服务器，通过“设置 → 学生门户与家长”中的邮箱账户发送。',
  'Each family’s digest (their child’s grades, attendance, homework and class news) and your own weekly summary. Your email password goes to the Portal when you publish.':
    '每个家庭的周报（孩子的成绩、考勤、作业和班级动态），以及您自己的每周总结。您发布时，邮箱密码会发送到门户。',
  'Once a week when the digest is on, or when you press Send now.':
    '开启周报后每周一次，或在您点击“立即发送”时。',
  'Off until you turn the digest on.': '在您开启周报之前保持关闭。',
  'Off.': '关闭。',
  'Anonymous weekly usage count': '匿名每周使用统计',
  'The EduBoard project (portal.edu-board.com).': 'EduBoard 项目（portal.edu-board.com）。',
  'A random number made on this computer, the version, the system and language, roughly how many classes and students (as a range), and whether a Portal is set up. Never names, the school, grades or anything a student wrote.':
    '本机生成的随机编号、版本号、操作系统和语言、大致的班级和学生数量（以范围表示），以及是否设置了门户。从不包含姓名、学校、成绩或学生写的任何内容。',
  'Once a week.': '每周一次。',
  'Off unless you turn it on.': '除非您开启，否则保持关闭。',
  'Off, and can’t be turned on.': '关闭，且无法开启。',
  'Posting to DingTalk or WeCom groups': '发送到钉钉或企业微信群',
  'DingTalk (oapi.dingtalk.com) or WeCom (qyapi.weixin.qq.com).':
    '钉钉（oapi.dingtalk.com）或企业微信（qyapi.weixin.qq.com）。',
  'The text of the post or newsletter you send, which may name students.':
    '您发送的动态或班级简报的文字，其中可能包含学生姓名。',
  'Only when you press Send to group.': '仅在您点击“发送到群”时。',
  'Off until you add a group robot.': '在您添加群机器人之前保持关闭。',
  'Spelling dictionary': '拼写词典',
  'Google’s download servers (redirector.gvt1.com), used by Electron, the framework EduBoard is built on.':
    'Google 的下载服务器（redirector.gvt1.com），由 EduBoard 所基于的 Electron 框架使用。',
  'Which language’s dictionary is needed. Nothing you type.':
    '需要哪种语言的词典。不包含您输入的任何内容。',
  'The first time you type in a text box, on Windows and Linux. Macs use their own dictionary.':
    '在 Windows 和 Linux 上首次在文本框中输入时。Mac 使用系统自带的词典。',
  'Off. No dictionary is downloaded, so spelling suggestions may be missing until one is installed on the computer.':
    '关闭。不会下载词典，因此在电脑上安装词典之前可能没有拼写建议。',
  'Reading a web link you added': '读取您添加的网页链接',
  'The web page of a link you added to Resources.': '您添加到“资源”中的链接所对应的网页。',
  'An ordinary request for that page. Nothing about your classes.':
    '对该网页的普通请求。不包含有关您班级的任何信息。',
  'When the Notebook reads a link resource so you can search it.':
    '笔记本读取链接资源以便您搜索时。',
  'Only for links you add.': '仅针对您添加的链接。',
  'Stays: it sends nothing about your classes.': '保持：它不会发送有关您班级的任何内容。',
  'Exit tickets, QR check-in and the classroom screen': '出门条、扫码签到和课堂大屏',
  'Phones and the classroom computer on the same Wi-Fi. Nothing goes to the internet.':
    '同一 Wi-Fi 下的手机和教室电脑。不会连接到互联网。',
  'The question or check-in page, with the class list (full names) to choose from. Students’ answers come back to this computer. The page uses plain http on the school network, so anyone on that Wi-Fi with the link can see the class list.':
    '题目或签到页面，其中包含供选择的班级名单（全名）。学生的回答会返回这台电脑。该页面在学校网络上使用普通 http，因此同一 Wi-Fi 下任何拿到链接的人都能看到班级名单。',
  'Only while you have an exit ticket, a QR check-in or the classroom screen open.':
    '仅在您打开出门条、扫码签到或课堂大屏期间。',
  'Off until you open one.': '在您打开之前保持关闭。',
  'Stays: it never leaves the school’s network.': '保持：它从不离开学校网络。',
  'Links you open': '您打开的链接',
  'Your web browser.': '您的网页浏览器。',
  'Nothing from EduBoard. Your browser opens the page.':
    'EduBoard 不发送任何内容，由浏览器打开网页。',
  'When you click a link, such as Help or a resource’s address.':
    '您点击链接时，例如“帮助”或资源的网址。',
  'Only when you click.': '仅在您点击时。',
  'Stays.': '保持。',

  // shared/pilotSummary.ts
  'Gradebook scores': '成绩册分数',
  'Seating plans': '座位表',
  'Exit tickets': '出门条',
  'Student log': '学生记录',
  'Rubric marking': '量规评分',
  'Lesson resources': '课程资源'
}
