# Setting up EduBoard for a whole school

For the person who looks after a school's computers. Everything here is optional: a
teacher can also just download EduBoard and use it on their own.

## What a school can make its own

| | How | Who can change it |
| --- | --- | --- |
| **The app's name** (e.g. "Riverside Teacher Hub"), shown in the sidebar, the window title, the lock screen, on Windows the desktop and Start menu shortcuts, and on the Portal families use (below) | Settings → Appearance → App name | The teacher, unless the school locks it (below) |
| **Logo**: sidebar, window and taskbar icon, the desktop, Start menu and pinned taskbar shortcuts (Windows), the Dock while EduBoard is open (Mac), report cards and printouts | Settings → Appearance → School logo | Same |
| **Colour** and a **stylesheet** (fonts, background, colours) | Settings → Appearance | Same |
| **School name** | Settings → You and your school | Same |
| Grading scale, pass mark, terms, attendance codes, class points, report card layout, comment bank, letter template, templates, the school's own words | Set them up once, then Settings → Data and security → School pack → Export | Each teacher, after it's applied |

**On the Portal.** When a teacher publishes, the app sends its name and logo (Settings →
Portal and families → "Show this app's name and logo on the Portal", on unless turned off).
The Portal then shows them to families: the page title and header, the icon when it's added
to a phone's home screen, the weekly email's subject and the homework calendar's name. A
Portal with one teacher follows that teacher's app. With several teachers it follows the
name all their apps share (a school pack gives them the same one); if they differ it says
EduBoard Portal until the Portal's admin page (`/admin.html` → Portal name and logo) picks
one teacher's, so no single teacher can rename the Portal for everyone.

The branding is decorative. The program itself, its installer, its updates, Windows' list of
installed apps, Settings → Help and edu-board.com still say EduBoard, so teachers can always
find help and updates. On Windows, EduBoard renames its own shortcuts when the name or logo
changes (an update's new "EduBoard" shortcut is folded back in at the next start, and
uninstalling removes the renamed ones). A pinned taskbar icon keeps its pin and may show the
new logo only after the computer restarts. The Mac Dock shows the logo only while the app is
open; the Mac program's name can't change. The
Portal families use stays at the address the school chooses.

## Options for a whole school

1. **Share a school pack file (no IT needed).** Export the pack from one set-up computer and
   give the `.eduboard-school.json` file to teachers. Each opens Settings → Data and
   security → School pack → Import. Good for a few teachers. Nothing is locked.
2. **Install the school pack for everyone on a computer (recommended for schools).** IT
   copies the pack to one folder per computer. Every teacher who uses EduBoard on that
   computer gets the school's name, logo, colour and stylesheet at every start, and can't
   change them. Everything else in the pack is applied once for each new version of the
   file, so teachers can still adjust their own grading details afterwards.
3. **A separately built, renamed program** (its own installer name, program icon and
   update channel). Possible, but every EduBoard update would have to be rebuilt for each
   school. Only worth it for a large contract; ask about it.

## A local-only pilot

A free pilot where **nothing about students goes to the internet, to EduBoard or to any
outside company**. EduBoard runs as a desktop app only: no Portal, no AI, no email to families, no group chats, no usage count.
Everything in the app that works on one computer (classes, rosters, attendance,
gradebook, lesson plans, report cards, backups, the classroom tools on the school Wi-Fi)
works as usual. The full list of connections, and what pilot mode does with each, is in
[DATA_FLOWS.md](DATA_FLOWS.md) and in the app under Settings → What leaves this computer.

A plain pilot agreement for the school to sign, in English and Chinese, is in
[PILOT_AGREEMENT.md](PILOT_AGREEMENT.md).

**Set it up (about 15 minutes per school)**

1. On one computer, install EduBoard and set it up the way the school wants: Settings →
   You and your school (school name and **language**), Appearance (logo, colour), and
   Grading and reports (scale, terms).
2. Settings → Data and security → School pack → **Export pilot pack**. It's the usual
   school pack plus two things: it turns on local-only pilot mode, and it sets the
   interface language (中文 or English) that teachers start in.
3. Install the pack on each teacher's computer with **Install-School-Pack.cmd** (Option 2
   below). Installed this way, pilot mode is locked on: teachers can't turn it off, and the
   school's name and logo are locked too. (Imported by a teacher instead, through
   Settings → School pack → Import, pilot mode is turned on but the teacher can turn it
   off.)
4. Install EduBoard for each teacher (`EduBoard-Setup.exe /S`). At first start the
   sidebar shows **Local-only pilot**; clicking it opens the list of what's turned off.
5. Each teacher's Getting started checklist skips the Portal steps, and after their first
   class EduBoard offers to protect it with a password. Recommend that they say yes,
   especially on shared computers. It isn't forced.

**What still connects.** EduBoard checks for new versions (only its version number goes
to GitHub or, if GitHub can't be reached, to EduBoard's update mirror) and downloads one
only when the teacher presses Update now; every installer is checked against its SHA-256
checksum. When a teacher opens an exit ticket, QR check-in or the classroom screen, the
class list is shown to devices on the school's own Wi-Fi that have that session's link,
over plain http (not encrypted), and only while the tool is open. Names appear as chosen
in Settings → What leaves this computer → Names on shared screens: in a pilot, first name
and last initial by default. Each session has its own link, which stops working when the
tool closes, and the classroom server stops when the last tool closes.

**Before using real student data.** Teachers can try everything with the sample school
first (the Getting started card offers it before their first class). Before anyone
enters real students:

- [ ] **The school has approved it in writing**, for these teachers and these classes
  (the [pilot agreement](PILOT_AGREEMENT.md) can be that record).
- [ ] **Which computer:** each teacher uses one named computer, ideally the school's
  rather than a personal or shared one, with its own Windows or Mac sign-in.
- [ ] **Password protection is on** (Settings → Data and security → Password
  protection), so the classes are encrypted on that computer; the teacher keeps the
  recovery key somewhere safe and separate.
- [ ] **Backups:** agree who keeps them and where. EduBoard backs up on the teacher's
  computer every day; a second copy (Settings → Data and security → Backups → a USB stick
  or school drive) stays inside the school and is protected by the same password. Not
  a cloud-synced folder such as OneDrive or Baidu Netdisk: that would copy the backups
  off the school's computers, which pilot mode can't stop.
- [ ] **Names on shared screens** is set the way the school wants (first name and last
  initial by default in a pilot) before the first exit ticket or QR check-in.

**At the end of the pilot.** Each teacher can open Settings → What leaves this computer →
**Save pilot summary…** and send the file by hand, if they agree. It holds rough counts
only (classes and students as ranges, which features were used, how many days, the app
version and the operating system), never names, grades or comments, and the teacher sees
the whole file before saving it.

**To end the pilot,** delete the installed pack (or replace it with an ordinary one); each
teacher can then turn pilot mode off in Settings → What leaves this computer. To turn it
off on every computer at once, edit the installed file to say `"pilotMode": false`.

### 本地试点（中文）

免费试点期间，**有关学生的任何内容都不会发送到互联网、EduBoard 或任何外部公司**。EduBoard 只作为桌面应用运行：不使用学生门户、AI、家长邮件、群聊和使用统计。所有在单台电脑上就能完成的功能（班级、名单、考勤、成绩册、教案、成绩单、备份，以及在学校 Wi-Fi 上使用的课堂工具）照常可用。所有网络连接及试点模式对每项连接的处理，见 [DATA_FLOWS.md](DATA_FLOWS.md)，或应用内的“设置 → 哪些数据会离开这台电脑”。

供学校签署的中英文试用协议见 [PILOT_AGREEMENT.md](PILOT_AGREEMENT.md)。

**设置步骤（每所学校约 15 分钟）**

1. 在一台电脑上安装 EduBoard，并按学校的要求设置：“设置 → 您与您的学校”（学校名称和**语言**）、“外观”（校徽、颜色）、“成绩与报告”（评分等级、学期）。
2. “设置 → 数据与安全 → 学校配置包 → **导出试点配置包**”。它在普通学校配置包的基础上多了两项：开启本地试点模式，并设定教师初次使用的界面语言（中文或 English）。
3. 用 **Install-School-Pack.cmd** 把配置包安装到每位教师的电脑上（见下文“方案 2”）。以这种方式安装后，试点模式会被锁定开启，教师无法关闭，学校名称和校徽也会被锁定。（如果由教师通过“设置 → 学校配置包 → 导入”自行导入，试点模式会开启，但教师可以关闭。）
4. 为每位教师安装 EduBoard（`EduBoard-Setup.exe /S`）。首次启动时，侧边栏会显示**本地试点**，点击即可查看哪些功能已关闭。
5. 教师的“入门指南”清单会跳过学生门户相关步骤；创建第一个班级后，EduBoard 会建议设置密码保护。建议教师开启，尤其是在共用电脑上，但这不是强制的。

**仍会进行的连接。** EduBoard 会检查新版本（只发送版本号，发往 GitHub；如果无法连接 GitHub，则发往 EduBoard 的更新镜像），只有在教师点击“立即更新”时才会下载，每个安装文件都会核对 SHA-256 校验值。当教师打开出门条、扫码签到或课堂大屏时，班级名单会通过普通 http（未加密）显示给学校自己的 Wi-Fi 中持有本次链接的设备，且仅在工具打开期间。姓名按“设置 → 哪些数据会离开这台电脑 → 共享屏幕上的姓名”中的选择显示：试点中默认为名字加姓氏首字母。每次使用都有新的链接，工具关闭后链接即失效；最后一个工具关闭后，课堂服务器随即停止。

**使用真实学生数据之前。** 教师可以先用示例学校试用所有功能（创建第一个班级之前，“入门指南”卡片会建议这样做）。在任何人录入真实学生信息之前：

- [ ] **学校已书面同意**，并写明哪些教师、哪些班级（[试用协议](PILOT_AGREEMENT.md)可作为这份记录）。
- [ ] **哪台电脑：** 每位教师使用一台指定的电脑，最好是学校的电脑，而不是个人或共用电脑，并有自己的 Windows 或 Mac 登录账户。
- [ ] **已开启密码保护**（设置 → 数据与安全 → 密码保护），使班级数据在这台电脑上加密；教师把恢复密钥另外妥善保存。
- [ ] **备份：** 商定由谁保管、保存在哪里。EduBoard 每天在教师电脑上自动备份；第二份副本（设置 → 数据与安全 → 备份 → U 盘或学校网盘）保存在学校内部，并受同一密码保护。不要使用 OneDrive 或百度网盘等云同步文件夹：那会把备份复制到学校电脑之外，试点模式无法阻止。
- [ ] 在第一次使用出门条或扫码签到之前，按学校的要求设置好**共享屏幕上的姓名**（试点中默认为名字加姓氏首字母）。

**试点结束时。** 每位教师可以打开“设置 → 哪些数据会离开这台电脑 → **保存试点总结…**”，如果同意，再亲自把文件发出。文件只包含大致数字（班级和学生数量以范围表示、使用过哪些功能、使用天数、应用版本和操作系统），从不包含姓名、成绩或评语，教师保存前可以看到文件的完整内容。

**结束试点：** 删除已安装的配置包（或换成普通配置包），之后每位教师可以在“设置 → 哪些数据会离开这台电脑”中关闭试点模式。若要在所有电脑上一次性关闭，可把已安装文件中的内容改为 `"pilotMode": false`。

## Option 2, step by step (Windows)

1. On a computer set up the way the school wants (app name, logo, colour, grading scale,
   terms…), open Settings → Data and security → School pack → **Export**. Save the file.
2. Put that file in the same folder as **Install-School-Pack.cmd** (in the
   [repository](https://github.com/purysho/EduBoard): Code → Download ZIP).
3. Right-click Install-School-Pack.cmd → **Run as administrator**. It copies the pack to
   `C:\ProgramData\EduBoard\school-pack.json`.
4. The next time a teacher opens EduBoard on that computer, it's the school's version.

To roll it out to many computers, copy the file to
`%ProgramData%\EduBoard\school-pack.json` with the school's usual tools (Group Policy
Preferences, Intune, a startup script, SCCM). To change it, replace the file; to stop,
delete it (teachers keep the last branding, and can then change it themselves).

**Installing EduBoard itself** for each teacher, silently (no administrator rights needed,
it installs for the signed-in user and updates itself):

```
EduBoard-Setup.exe /S
```

Each teacher's classes stay in their own Windows account on that computer.

### Mac and Linux

Put the same file at:

- macOS: `/Library/Application Support/EduBoard/school-pack.json`
- Linux: `/etc/eduboard/school-pack.json`

A copy of the portable Windows version also reads `school-pack.json` placed next to
`EduBoard-Portable.exe` (for example on a USB stick).

## What's locked, exactly

Only what the pack sets among: the app name, school name, logo, colour, stylesheet and
local-only pilot mode. A
pack without a stylesheet leaves the stylesheet to the teacher. The sample school (Settings
→ Help and updates) keeps its own made-up branding, but a pilot pack's pilot mode holds
there too.

If the file can't be read (not a school pack, or damaged), EduBoard opens as usual and
records EB-2001 in the error report (Settings → Help and updates → Copy error report).
