/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Builds docs/DATA_FLOWS.md from src/shared/dataFlows.ts, the same list Settings → What
// leaves this computer shows, with the Chinese from src/shared/i18n/zh/pilot.ts. Run:
// npm run data-flows. A test checks the file matches, so the list and the doc can't drift.
import { DATA_FLOWS } from '../../src/shared/dataFlows.ts'
import { PILOT } from '../../src/shared/i18n/zh/pilot.ts'

const cell = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const zh = (s) => {
  const t = PILOT[s]
  if (!t) throw new Error(`No Chinese for: ${s} (add it to src/shared/i18n/zh/pilot.ts)`)
  return t
}

function table(lang) {
  const t = lang === 'zh' ? zh : (s) => s
  const head =
    lang === 'zh'
      ? ['连接', '发送到', '发送内容', '何时发生', '默认情况', '试点模式下']
      : ['Connection', 'Goes to', 'Sends', 'When', 'By default', 'In a pilot']
  const out = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`]
  for (const f of DATA_FLOWS) {
    const pilot = t(f.pilotNote)
    out.push(
      `| **${cell(t(f.name))}** | ${cell(t(f.destination))} | ${cell(t(f.sends))} | ${cell(t(f.when))} | ${cell(t(f.defaultNote))} | ${cell(pilot)} |`
    )
  }
  return out.join('\n')
}

function codeList() {
  return DATA_FLOWS.map((f) => {
    const channels = f.channels.length ? f.channels.map((c) => `\`${c}\``).join(', ') : '—'
    return `| ${f.id} | ${f.pilot} | ${f.code.map((c) => `\`${c}\``).join(', ')} | ${channels} |`
  }).join('\n')
}

export function buildDataFlowsDoc() {
  return `# What leaves the teacher's computer

<!-- Generated from src/shared/dataFlows.ts by \`npm run data-flows\`. Don't edit by hand. -->

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
(\`UPDATE_MIRROR_URL\` in \`src/shared/updateMirror.ts\`, empty until one is set up): a
static \`latest.json\` manifest naming the version and each installer with its SHA-256
checksum, beside the installer files. Only the version number goes to either source,
and an installer from either one is used only if its SHA-256 checksum matches.

## In English

${table('en')}

## 中文

供学校 IT 人员和试点前审核 EduBoard 的人员参考。应用内的“设置 → 哪些数据会离开这台电脑”中有同样的中英文清单。

EduBoard 把所有数据保存在教师电脑上的一个数据库文件中（教师设置密码后会加密）。下表列出的连接是数据离开电脑的唯一途径。**本地试点模式**（由试点学校配置包开启，见 [SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot)）会关闭所有可能把学生数据发送到互联网、EduBoard 或任何外部公司的连接。这一限制在应用的主进程中执行，而不只是把按钮变灰：对已关闭连接的请求会被拒绝（EB-7001），网络代码在发送前也会再次检查。

有一项连接会携带学生姓名，并在试点中保持开启，但不离开学校：当教师打开出门条、扫码签到或课堂大屏时，班级名单（姓名按“设置 → 哪些数据会离开这台电脑 → 共享屏幕上的姓名”中选择的格式显示，试点中默认为名字加姓氏首字母）会通过普通 http（未加密）显示给学校自己的 Wi-Fi 中持有本次链接的设备，且仅在工具打开期间。每次的链接都带有随机令牌，服务器拒绝没有令牌的请求；最后一个工具关闭后，服务器随即停止。

**在中国大陆更新。** 检查更新时先连接 GitHub，等待时间很短。如果 GitHub 没有响应，EduBoard 会改为查询它的更新镜像（\`src/shared/updateMirror.ts\` 中的 \`UPDATE_MIRROR_URL\`，设置前为空）：一个静态的 \`latest.json\` 清单，列出版本号以及每个安装文件和它的 SHA-256 校验值，安装文件放在同一位置。两个来源都只会收到版本号；无论来自哪个来源，安装文件只有在 SHA-256 校验值相符时才会使用。

${table('zh')}

## What the Portal server itself connects to

Only relevant when a school runs a Portal (never in a local-only pilot, where the app
doesn't talk to one):

- **AI provider** (\`portal/services/ai.js\`): Anthropic or an OpenAI-compatible address,
  for the student Study Helper and Translate, with the key the teacher published.
- **Email** (\`portal/services/mailer.js\`): the SMTP server the teacher set, for the
  weekly digest and password-reset emails.
- **GitHub** (\`portal/routes/appRelease.js\`): asks for the newest EduBoard release and
  passes the installer through, for teachers whose app checks for updates via the Portal.

## For developers: where each connection is in the code

| Flow | In a pilot | Code | IPC channels refused in a pilot (when blocked) |
| --- | --- | --- | --- |
${codeList()}

When you add a network call, add it to \`src/shared/dataFlows.ts\` and run
\`npm run data-flows\`. \`src/main/services/__tests__/pilotMode.test.ts\` fails if an IPC
handler that calls a network service is neither blocked in a pilot nor listed as allowed.
`
}
