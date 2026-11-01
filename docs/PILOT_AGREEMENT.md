# EduBoard local-only pilot: agreement template

A short, plain agreement for a free desktop pilot, in English and Chinese. Fill in the
blanks, delete what doesn't apply, and have the school (and, if you can, a lawyer) read
it before anyone signs. It is a template, not legal advice.

What the school installs and how is in [SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot);
every network connection the app can make is listed in [DATA_FLOWS.md](DATA_FLOWS.md).

---

## English

**EduBoard pilot agreement**

Between **[school name]** ("the School") and **[name], the developer of EduBoard**
("we").

**1. What the pilot is.** The School's teachers use the EduBoard desktop app free of
charge from **[start date]** to **[end date]** (about **[n]** weeks), in local-only pilot
mode. **[n]** teachers take part: **[names or "to be agreed"]**.

**2. Cost.** The pilot is free. Neither side has to buy, pay for or continue anything
afterwards.

**3. Student information stays inside the School.**

- EduBoard keeps everything in a database file on the teacher's computer. In local-only
  pilot mode, nothing about students, classes or teachers goes to the internet, to us or
  to any outside company: the Portal, AI features, family email, group chats and the
  usage count are turned off. Installed by the School's IT with the pilot pack, pilot
  mode is locked on, so teachers cannot turn it off.
- When a teacher opens an exit ticket, QR check-in or the classroom screen, the class
  list (with names in the format chosen in Settings → Names on shared screens; in a
  pilot, first name and last initial unless the School changes it) is shown to devices
  on the School's own Wi-Fi that have that session's link. It is sent over plain http,
  which is not encrypted, and only while the tool is open. Each session has its own
  link, which stops working when the tool is closed.
- What else connects: the app checks for a new version (it sends only its version
  number, to GitHub or, if GitHub can't be reached, to our update mirror) and downloads
  one when a teacher presses Update now. Every installer is checked against its SHA-256
  checksum.
- We receive **no personal information** from the pilot. We never have access to the
  teachers' computers or databases.
- The School decides what information goes into EduBoard and is responsible for it under
  the laws that apply to it (in mainland China, the Personal Information Protection Law,
  as the 个人信息处理者). Because no personal information is sent to us, we are not the
  School's processor (受托人) during this pilot.
- We recommend that each teacher turns on password protection, which encrypts the
  database on their computer.

**4. Feedback and the pilot summary.** At the end, teachers may save a *pilot summary*
from the app and send it to us if they choose. It contains only rough counts (number of
classes and students as ranges, which features were used, roughly how many days, the app
version and operating system) and never names, grades or comments. Teachers see the
whole file before saving it. We may also ask teachers for their views, in a short
conversation or survey.

**5. Quotes and the School's name.** We will only name the School, or quote a teacher,
in our materials (for example a website, a proposal or an investor presentation) with
**written permission** for that use. ☐ The School allows us to say it took part in a
pilot. ☐ It does not.

**6. Support.** We help with installation and questions by **[email / WeChat / phone]**,
and aim to reply within **[two school days]**. Updates are free during the pilot.

**7. At the end of the pilot.** The teachers keep their data, on their own computers.
They can keep using EduBoard, export their data (Excel, Word, PDF) or uninstall it. To
end pilot mode, the School removes the pilot pack ([SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot)).
Nothing needs to be returned or deleted on our side, because we hold nothing.

**8. Backups.** EduBoard makes automatic backups on the teacher's computer. The School
remains responsible for its computers and for keeping important records elsewhere as
it normally would.

**9. The software.** EduBoard is provided as it is, for a trial. We fix problems the
School reports as quickly as we reasonably can, but we cannot promise it is free of
errors. Neither side is liable to the other for indirect losses arising from the pilot.

**10. Ending early.** Either side can end the pilot at any time by telling the other in
writing.

Signed for the School: ______________________ Name / role: ______________ Date: ________

Signed for EduBoard: ________________________ Name: _____________________ Date: ________

---

## 中文

**EduBoard 试用协议**

甲方：**【学校名称】**（“学校”）
乙方：**【姓名】，EduBoard 开发者**（“我们”）

**一、试用内容。** 学校教师自 **【开始日期】** 至 **【结束日期】**（约 **【n】** 周）免费使用 EduBoard 桌面应用，并开启“本地试点模式”。参与教师 **【n】** 名：**【姓名，或“另行商定”】**。

**二、费用。** 试用免费。试用结束后，双方均无购买、付费或继续使用的义务。

**三、学生信息不离开学校。**

- EduBoard 将所有数据保存在教师电脑上的数据库文件中。在本地试点模式下，有关学生、班级或教师的任何内容都不会发送到互联网、我们或任何外部公司：学生门户、AI 功能、家长邮件、群聊和使用统计均已关闭。由学校 IT 人员用试点配置包安装后，试点模式被锁定开启，教师无法关闭。
- 当教师打开出门条、扫码签到或课堂大屏时，班级名单（姓名按“设置 → 共享屏幕上的姓名”中选择的格式显示；试点中默认为名字加姓氏首字母，除非学校另行更改）会显示给学校自己的 Wi-Fi 中持有本次链接的设备。名单通过普通 http 发送，未经加密，且仅在工具打开期间发送。每次使用都有新的链接，工具关闭后链接即失效。
- 其他连接：应用会检查新版本（只发送版本号，发往 GitHub；如果无法连接 GitHub，则发往我们的更新镜像），并在教师点击“立即更新”时下载更新。每个安装文件都会核对 SHA-256 校验值。
- 我们在试用中**不接收任何个人信息**，也从不接触教师的电脑或数据库。
- 学校决定哪些信息录入 EduBoard，并依照适用法律对其负责（在中国大陆，依《个人信息保护法》作为个人信息处理者）。由于没有任何个人信息发送给我们，试用期间我们不是学校的受托人。
- 我们建议每位教师开启密码保护，使其电脑上的数据库加密保存。

**四、反馈与试点总结。** 试用结束时，教师可以从应用中保存一份“试点总结”，并自行决定是否发送给我们。其中只有大致数字（班级和学生数量以范围表示、使用过哪些功能、大致使用天数、应用版本和操作系统），从不包含姓名、成绩或评语。教师保存前可以看到文件的完整内容。我们也可能通过简短的交流或问卷了解教师的意见。

**五、引用与学校名称。** 只有在获得学校就该用途的**书面许可**后，我们才会在资料中（例如网站、方案书或投资人演示）提及学校名称或引用教师的话。☐ 学校同意我们说明其参加过试用。☐ 不同意。

**六、支持。** 我们通过 **【邮箱／微信／电话】** 协助安装和解答问题，争取在 **【两个工作日】** 内回复。试用期间更新免费。

**七、试用结束后。** 教师的数据保留在其自己的电脑上。教师可以继续使用 EduBoard、导出数据（Excel、Word、PDF）或卸载。要结束试点模式，由学校删除试点配置包（见 [SCHOOL_DEPLOYMENT.md](SCHOOL_DEPLOYMENT.md#a-local-only-pilot)）。由于我们不持有任何数据，我们这边无需归还或删除任何内容。

**八、备份。** EduBoard 会在教师电脑上自动备份。学校仍按惯常做法负责其电脑，并在其他地方保存重要记录。

**九、软件。** EduBoard 按现状提供，供试用之用。对学校报告的问题，我们会尽快修复，但无法保证软件没有错误。任何一方均不对另一方因试用产生的间接损失承担责任。

**十、提前结束。** 任何一方均可随时以书面方式通知对方，结束试用。

学校签字：______________________ 姓名／职务：______________ 日期：________

EduBoard 签字：__________________ 姓名：_____________________ 日期：________
