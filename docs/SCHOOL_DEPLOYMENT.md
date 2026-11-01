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

A free pilot where **no student data leaves the teacher's computer**. EduBoard runs as a
desktop app only: no Portal, no AI, no email to families, no group chats, no usage count.
Everything in the app that works on one computer (classes, rosters, attendance,
gradebook, lesson plans, report cards, backups, the classroom tools on the school Wi-Fi)
works as usual. The full list of connections, and what pilot mode does with each, is in
[DATA_FLOWS.md](DATA_FLOWS.md) and in the app under Settings → What leaves this computer.

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
to GitHub) and downloads one only when the teacher presses Update now. Exit tickets, QR
check-in and the classroom screen reach phones on the same Wi-Fi only, never the
internet; they show the class list to anyone on that network with the link.

**At the end of the pilot.** Each teacher can open Settings → What leaves this computer →
**Save pilot summary…** and send the file by hand, if they agree. It holds rough counts
only (classes and students as ranges, which features were used, how many days, the app
version and the operating system), never names, grades or comments, and the teacher sees
the whole file before saving it.

**To end the pilot,** delete the installed pack (or replace it with an ordinary one); each
teacher can then turn pilot mode off in Settings → What leaves this computer. To turn it
off on every computer at once, edit the installed file to say `"pilotMode": false`.

### 本地试点（中文）

免费试点期间，**学生数据不会离开教师的电脑**。EduBoard 只作为桌面应用运行：不使用学生门户、AI、家长邮件、群聊和使用统计。所有在单台电脑上就能完成的功能（班级、名单、考勤、成绩册、教案、成绩单、备份，以及在学校 Wi-Fi 上使用的课堂工具）照常可用。所有网络连接及试点模式对每项连接的处理，见 [DATA_FLOWS.md](DATA_FLOWS.md)，或应用内的“设置 → 哪些数据会离开这台电脑”。

**设置步骤（每所学校约 15 分钟）**

1. 在一台电脑上安装 EduBoard，并按学校的要求设置：“设置 → 您与您的学校”（学校名称和**语言**）、“外观”（校徽、颜色）、“成绩与报告”（评分等级、学期）。
2. “设置 → 数据与安全 → 学校配置包 → **导出试点配置包**”。它在普通学校配置包的基础上多了两项：开启本地试点模式，并设定教师初次使用的界面语言（中文或 English）。
3. 用 **Install-School-Pack.cmd** 把配置包安装到每位教师的电脑上（见下文“方案 2”）。以这种方式安装后，试点模式会被锁定开启，教师无法关闭，学校名称和校徽也会被锁定。（如果由教师通过“设置 → 学校配置包 → 导入”自行导入，试点模式会开启，但教师可以关闭。）
4. 为每位教师安装 EduBoard（`EduBoard-Setup.exe /S`）。首次启动时，侧边栏会显示**本地试点**，点击即可查看哪些功能已关闭。
5. 教师的“入门指南”清单会跳过学生门户相关步骤；创建第一个班级后，EduBoard 会建议设置密码保护。建议教师开启，尤其是在共用电脑上，但这不是强制的。

**仍会进行的连接。** EduBoard 会检查新版本（只向 GitHub 发送版本号），只有在教师点击“立即更新”时才会下载。出门条、扫码签到和课堂大屏只连接同一 Wi-Fi 下的手机，从不连接互联网；同一网络中拿到链接的人可以看到班级名单。

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
