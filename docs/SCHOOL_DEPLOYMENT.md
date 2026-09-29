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

Only what the pack sets among: the app name, school name, logo, colour and stylesheet. A
pack without a stylesheet leaves the stylesheet to the teacher. The sample school (Settings
→ Help and updates) keeps its own made-up branding.

If the file can't be read (not a school pack, or damaged), EduBoard opens as usual and
records EB-2001 in the error report (Settings → Help and updates → Copy error report).
