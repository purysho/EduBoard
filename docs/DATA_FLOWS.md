# What leaves the teacher's computer

<!-- Generated from src/shared/dataFlows.ts by `npm run data-flows`. Don't edit by hand. -->

For school IT and anyone reviewing EduBoard before a pilot. The same list is in the app,
in English and Chinese, under Settings → What leaves this computer.

EduBoard keeps everything in one database file on the teacher's computer (encrypted when
the teacher sets a password). The connections below are the only ways anything leaves
it. **Local-only pilot mode** (turned on by a pilot school pack, see
[SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot)) turns off every
connection that could carry student data to the internet, to EduBoard or to any outside
company. It is enforced in the app's main process, not only by greying out buttons:
requests for a turned-off connection are refused with EB-7001, and the network code
checks again before sending.

One connection carries student names and stays on in a pilot, inside the school: when a
teacher opens an exit ticket, QR check-in or the classroom screen, the class list (names
in the format chosen in Settings → What leaves this computer → Names on shared screens;
first name and last initial by default in a pilot) is shown to devices on the school's
own Wi-Fi that have that session's link, over plain http (not encrypted), and only while
the tool is open. Each session's link carries a random token, the server refuses
requests without it, and the server stops when the last tool closes.

**Updates from mainland China.** The update check goes to GitHub first, with a short
timeout. If GitHub doesn't answer, EduBoard asks its update mirror instead
(`UPDATE_MIRROR_URL` in `src/shared/updateMirror.ts`, empty until one is set up): a
static `latest.json` manifest naming the version and each installer with its SHA-256
checksum, beside the installer files. Only the version number goes to either source,
and an installer from either one is used only if its SHA-256 checksum matches.

## In English

| Connection | Goes to | Sends | When | By default | In a pilot |
| --- | --- | --- | --- | --- | --- |
| **Checking for updates** | GitHub (api.github.com), or your Portal server if you set one up, which asks GitHub for you. If GitHub doesn’t answer within a few seconds, EduBoard’s update mirror, when one is set up. | An ordinary web request with EduBoard’s version number. Nothing about you, your classes or your students. | Shortly after EduBoard opens, then every 4 hours, and when you press Check for updates. | On. | Stays on, because it sends only the version number. It goes to GitHub first, then the update mirror, never through a Portal. |
| **Downloading an update** | GitHub’s download servers, EduBoard’s update mirror when the version list came from there, or your Portal server if you set one up. | A request for the new installer file. Nothing about you or your classes. The installer is checked against its SHA-256 checksum before it is used. | In the background when automatic updates are on, or when you press Update now. | On (Settings → Help and updates → automatic updates). | Only when you press Update now. Nothing downloads by itself. |
| **The student Portal (publishing and syncing)** | The Portal address in Settings → Portal and families: a server your school runs. | Class names; students’ names, dates of birth and student numbers; enrolments; grades and scores with your comments; attendance rates; class points; homework and attachments; shared resources; report cards, posts and messages; and your Portal AI key and email settings, so the Portal can use them. It reads back handed-in work, messages, profiles and new sign-ups. | When you publish, a moment after changes once a Portal is set up, and when you open Portal screens. | Off until you add a Portal address and sync secret. | Off. Nothing is published and Portal screens are turned off. |
| **AI suggestions in the app** | The AI provider you choose in Settings → AI: DeepSeek, Qwen, Zhipu, Anthropic, or an address you enter. | What the button needs. Lesson and unit drafts: the topic, your class profile and counts about the class, no names. Report comment phrases: the student’s name, grade, attendance and recent notes. Feedback drafts: the student’s handed-in work. Notebook, study guides and practice sets: your resources’ text. Newsletter: the week’s facts. | Only when you press an AI button. | Off until you enter an AI key. | Off. AI buttons are greyed out. |
| **AI for students on the Portal** | Your Portal server, which calls the AI provider chosen in Settings → AI → AI for students. | Students’ Study Helper questions with matching class material and a nameless practice summary; messages and classwork to translate. | When students use the Study Helper or Translate on the Portal. Your key reaches the Portal when you publish. | Off until you enter a key for students and publish. | Off, because nothing is published. |
| **Weekly email to families and to you** | Your Portal server, which sends it through the email account in Settings → Portal and families. | Each family’s digest (their child’s grades, attendance, homework and class news) and your own weekly summary. Your email password goes to the Portal when you publish. | Once a week when the digest is on, or when you press Send now. | Off until you turn the digest on. | Off. |
| **Anonymous weekly usage count** | The EduBoard project (portal.edu-board.com). | A random number made on this computer, the version, the system and language, roughly how many classes and students (as a range), and whether a Portal is set up. Never names, the school, grades or anything a student wrote. | Once a week. | Off unless you turn it on. | Off, and can’t be turned on. |
| **Posting to DingTalk or WeCom groups** | DingTalk (oapi.dingtalk.com) or WeCom (qyapi.weixin.qq.com). | The text of the post or newsletter you send, which may name students. | Only when you press Send to group. | Off until you add a group robot. | Off. |
| **Spelling dictionary** | Google’s download servers (redirector.gvt1.com), used by Electron, the framework EduBoard is built on. | Which language’s dictionary is needed. Nothing you type. | The first time you type in a text box, on Windows and Linux. Macs use their own dictionary. | On. | Off. No dictionary is downloaded, so spelling suggestions may be missing until one is installed on the computer. |
| **Reading a web link you added** | The web page of a link you added to Resources. | An ordinary request for that page. Nothing about your classes. | When the Notebook reads a link resource so you can search it. | Only for links you add. | Stays: it sends nothing about your classes. |
| **Exit tickets, QR check-in and the classroom screen** | Phones and other devices on the school’s own Wi-Fi that have the session link, and the classroom computer. Nothing goes to the internet, to EduBoard or to any outside company. | The question or check-in page, with the class list to choose from, in the names format chosen in Settings → Names on shared screens (in a pilot, first name and last initial unless changed). Students’ answers come back to this computer. It uses plain http (not encrypted), so anyone on that Wi-Fi with the session link can see the list. Each session has its own link, which stops working when the tool closes. | Only while you have an exit ticket, a QR check-in or the classroom screen open. The classroom server stops when the last one closes. | Off until you open one. | Stays on, inside the school’s Wi-Fi only, with names shown as first name and last initial by default. |
| **Links you open** | Your web browser. | Nothing from EduBoard. Your browser opens the page. | When you click a link, such as Help or a resource’s address. | Only when you click. | Stays. |

## 中文

供学校 IT 人员和试点前审核 EduBoard 的人员参考。应用内的“设置 → 哪些数据会离开这台电脑”中有同样的中英文清单。

EduBoard 把所有数据保存在教师电脑上的一个数据库文件中（教师设置密码后会加密）。下表列出的连接是数据离开电脑的唯一途径。**本地试点模式**（由试点学校配置包开启，见 [SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot)）会关闭所有可能把学生数据发送到互联网、EduBoard 或任何外部公司的连接。这一限制在应用的主进程中执行，而不只是把按钮变灰：对已关闭连接的请求会被拒绝（EB-7001），网络代码在发送前也会再次检查。

有一项连接会携带学生姓名，并在试点中保持开启，但不离开学校：当教师打开出门条、扫码签到或课堂大屏时，班级名单（姓名按“设置 → 哪些数据会离开这台电脑 → 共享屏幕上的姓名”中选择的格式显示，试点中默认为名字加姓氏首字母）会通过普通 http（未加密）显示给学校自己的 Wi-Fi 中持有本次链接的设备，且仅在工具打开期间。每次的链接都带有随机令牌，服务器拒绝没有令牌的请求；最后一个工具关闭后，服务器随即停止。

**在中国大陆更新。** 检查更新时先连接 GitHub，等待时间很短。如果 GitHub 没有响应，EduBoard 会改为查询它的更新镜像（`src/shared/updateMirror.ts` 中的 `UPDATE_MIRROR_URL`，设置前为空）：一个静态的 `latest.json` 清单，列出版本号以及每个安装文件和它的 SHA-256 校验值，安装文件放在同一位置。两个来源都只会收到版本号；无论来自哪个来源，安装文件只有在 SHA-256 校验值相符时才会使用。

| 连接 | 发送到 | 发送内容 | 何时发生 | 默认情况 | 试点模式下 |
| --- | --- | --- | --- | --- | --- |
| **检查更新** | GitHub（api.github.com）；如果您设置了学生门户服务器，则由门户代您向 GitHub 查询。如果 GitHub 几秒内没有响应，则使用 EduBoard 的更新镜像（如已设置）。 | 一个普通的网络请求，只带有 EduBoard 的版本号。不包含有关您、您的班级或学生的任何信息。 | EduBoard 打开后不久，之后每 4 小时一次，以及您点击“检查更新”时。 | 开启。 | 保持开启，因为它只发送版本号。先连接 GitHub，再连接更新镜像，从不经过学生门户。 |
| **下载更新** | GitHub 的下载服务器；版本信息来自更新镜像时则从镜像下载；如果您设置了学生门户服务器，则从门户下载。 | 请求新的安装文件，不包含有关您或您班级的任何信息。安装文件在使用前会核对 SHA-256 校验值。 | 开启自动更新时在后台进行，或在您点击“立即更新”时进行。 | 开启（设置 → 帮助与更新 → 自动更新）。 | 仅在您点击“立即更新”时下载，不会自动下载任何内容。 |
| **学生门户（发布与同步）** | “设置 → 学生门户与家长”中的门户地址：由您的学校运行的服务器。 | 班级名称；学生的姓名、出生日期和学号；选课情况；成绩、分数及您的评语；出勤率；课堂积分；作业及附件；共享资源；成绩单、班级动态和消息；以及您的门户 AI 密钥和邮件设置，以便门户使用。它还会取回学生提交的作业、消息、个人资料和新注册信息。 | 您发布时；设置门户后，每次更改后片刻；以及您打开门户相关页面时。 | 在您添加门户地址和同步密钥之前保持关闭。 | 关闭。不会发布任何内容，门户相关页面也会关闭。 |
| **应用内的 AI 建议** | 您在“设置 → AI”中选择的 AI 服务商：DeepSeek、通义千问、智谱、Anthropic，或您输入的地址。 | 只发送该按钮所需的内容。教案和单元草稿：主题、班级概况和班级的统计数字，不含姓名。成绩单评语短语：学生的姓名、成绩、出勤和近期备注。反馈草稿：学生提交的作业。笔记本、学习指南和练习：您的资源文本。班级简报：本周的情况。 | 仅在您点击 AI 按钮时。 | 在您输入 AI 密钥之前保持关闭。 | 关闭。AI 按钮显示为灰色。 |
| **学生门户上的学生 AI** | 您的学生门户服务器，由它调用“设置 → AI → 学生 AI”中选择的 AI 服务商。 | 学生向学习助手提出的问题，以及相关的课堂资料和不含姓名的练习概况；需要翻译的消息和课堂作业。 | 学生在门户上使用学习助手或翻译时。您发布时，密钥会发送到门户。 | 在您输入学生 AI 密钥并发布之前保持关闭。 | 关闭，因为不会发布任何内容。 |
| **发给家长和您的每周邮件** | 您的学生门户服务器，通过“设置 → 学生门户与家长”中的邮箱账户发送。 | 每个家庭的周报（孩子的成绩、考勤、作业和班级动态），以及您自己的每周总结。您发布时，邮箱密码会发送到门户。 | 开启周报后每周一次，或在您点击“立即发送”时。 | 在您开启周报之前保持关闭。 | 关闭。 |
| **匿名每周使用统计** | EduBoard 项目（portal.edu-board.com）。 | 本机生成的随机编号、版本号、操作系统和语言、大致的班级和学生数量（以范围表示），以及是否设置了门户。从不包含姓名、学校、成绩或学生写的任何内容。 | 每周一次。 | 除非您开启，否则保持关闭。 | 关闭，且无法开启。 |
| **发送到钉钉或企业微信群** | 钉钉（oapi.dingtalk.com）或企业微信（qyapi.weixin.qq.com）。 | 您发送的动态或班级简报的文字，其中可能包含学生姓名。 | 仅在您点击“发送到群”时。 | 在您添加群机器人之前保持关闭。 | 关闭。 |
| **拼写词典** | Google 的下载服务器（redirector.gvt1.com），由 EduBoard 所基于的 Electron 框架使用。 | 需要哪种语言的词典。不包含您输入的任何内容。 | 在 Windows 和 Linux 上首次在文本框中输入时。Mac 使用系统自带的词典。 | 开启。 | 关闭。不会下载词典，因此在电脑上安装词典之前可能没有拼写建议。 |
| **读取您添加的网页链接** | 您添加到“资源”中的链接所对应的网页。 | 对该网页的普通请求。不包含有关您班级的任何信息。 | 笔记本读取链接资源以便您搜索时。 | 仅针对您添加的链接。 | 保持：它不会发送有关您班级的任何内容。 |
| **出门条、扫码签到和课堂大屏** | 学校自己的 Wi-Fi 中持有本次链接的手机等设备，以及教室电脑。不会发送到互联网、EduBoard 或任何外部公司。 | 题目或签到页面，其中有供选择的班级名单，姓名按“设置 → 共享屏幕上的姓名”中选择的格式显示（试点模式下默认为名字加姓氏首字母）。学生的回答返回这台电脑。页面使用普通 http（未加密），因此同一 Wi-Fi 下持有本次链接的人都能看到名单。每次使用都有新的链接，工具关闭后链接即失效。 | 仅在您打开出门条、扫码签到或课堂大屏期间。最后一个工具关闭后，课堂服务器随即停止。 | 在您打开之前保持关闭。 | 保持开启，仅限学校 Wi-Fi 内，姓名默认显示为名字加姓氏首字母。 |
| **您打开的链接** | 您的网页浏览器。 | EduBoard 不发送任何内容，由浏览器打开网页。 | 您点击链接时，例如“帮助”或资源的网址。 | 仅在您点击时。 | 保持。 |

## What the Portal server itself connects to

Only relevant when a school runs a Portal (never in a local-only pilot, where the app
doesn't talk to one):

- **AI provider** (`portal/services/ai.js`): Anthropic or an OpenAI-compatible address,
  for the student Study Helper and Translate, with the key the teacher published.
- **Email** (`portal/services/mailer.js`): the SMTP server the teacher set, for the
  weekly digest and password-reset emails.
- **GitHub** (`portal/routes/appRelease.js`): asks for the newest EduBoard release and
  passes the installer through, for teachers whose app checks for updates via the Portal.

## For developers: where each connection is in the code

| Flow | In a pilot | Code | IPC channels refused in a pilot (when blocked) |
| --- | --- | --- | --- |
| updateCheck | allowed | `src/main/services/selfUpdateCore.ts`, `src/main/services/selfUpdate.ts`, `src/shared/updateMirror.ts` | `settings:appUpdateInfo`, `settings:appUpdateStatus` |
| updateDownload | askFirst | `src/main/services/selfUpdate.ts`, `src/main/services/selfUpdateCore.ts` | `settings:installAppUpdate` |
| portal | blocked | `src/main/services/portalSyncService.ts`, `src/main/services/reportCardDelivery.ts` | `portalSync:publish`, `portalSync:pullSubmissions`, `portalSync:aiActivity`, `portalSync:reviewStats`, `portalProfiles:get`, `portalMessages:listThreads`, `portalMessages:send`, `portalMessages:markRead`, `reportCards:send`, `reportCards:list`, `reportCards:withdraw`, `classPosts:list`, `classPosts:create`, `classPosts:remove`, `classPosts:remind`, `portalAccounts:resetPassword`, `portalAccounts:listResetRequests`, `portalAccounts:answerResetRequest`, `homeworkAssignments:setSubmissionGrade`, `homeworkAssignments:setSubmissionPortfolio`, `homeworkAssignments:openSubmissionFile`, `homeworkRubricScores:save` |
| desktopAi | blocked | `src/main/services/aiService.ts` | `ai:draftLessonPlan`, `ai:draftUnitPlan`, `ai:suggestCommentPhrases`, `ai:testConnection`, `notebook:ask`, `notebook:draftStudyGuide`, `notebook:draftPracticeSet`, `homeworkAssignments:draftFeedback`, `newsletter:draft` |
| portalAi | blocked | `src/main/services/portalSyncService.ts`, `portal/services/ai.js` | `portalMessages:translate` |
| digest | blocked | `src/main/services/portalSyncService.ts`, `portal/services/digest.js` | `digest:sendNow`, `digest:preview`, `digest:setNewsletter`, `weeklySummary:email` |
| usagePing | blocked | `src/main/services/usagePing.ts` | — |
| groupChats | blocked | `src/main/services/groupChat.ts` | `groupChats:send`, `groupChats:route`, `groupChats:test` |
| spellcheck | blocked | `src/main/services/pilotMode.ts` | — |
| linkPages | allowed | `src/main/services/notebookService.ts` | `notebook:indexResource`, `notebook:indexAll` |
| classroomNetwork | localNetwork | `src/main/services/exitTicketServer.ts` | `exitTickets:setOpen`, `attendanceCheckIn:open`, `classroomHub:open`, `classroomHub:project` |
| browserLinks | allowed | `src/main/windows.ts` | `lessonResources:openExternal` |

When you add a network call, add it to `src/shared/dataFlows.ts` and run
`npm run data-flows`. `src/main/services/__tests__/pilotMode.test.ts` fails if an IPC
handler that calls a network service is neither blocked in a pilot nor listed as allowed.
