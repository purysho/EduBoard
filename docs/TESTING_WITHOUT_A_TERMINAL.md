# Trying EduBoard without PowerShell or a terminal

Four things to check. Nothing below needs typed commands on your own PC.

## 1. The desktop app: download a ready-made installer

Every push to a `claude/...` branch (or `v0.3-dev`) builds a Windows installer on
GitHub. You can also start a build yourself.

1. On GitHub, open the repository → **Actions** → **Test build (Windows installer)**.
   (To build on demand: **Run workflow** → pick the branch → **Run workflow**.)
2. Click the most recent run with a green tick. Builds take about 10 minutes.
3. Under **Artifacts** at the bottom, click **EduBoard-Windows-…** to download a zip.
   You need to be signed in to GitHub.
4. Open the zip and double-click **EduBoard-Setup.exe** to install it, or
   **EduBoard-Portable.exe** to run it without installing.
5. The test build isn't code-signed, so Windows shows "Windows protected your PC".
   Click **More info** → **Run anyway**. This happens once per download.

Your existing EduBoard data is kept. The installer updates the program, not your
classes. To be safe anyway, first use **Settings → Backups → Back up now**.

## 2. The student Portal

### On your live Portal (portal.edu-board.com)

Students see the new features (English/中文, Translate buttons, AI help, the app layout)
only once the Portal server runs the new code. One command updates it. It backs up the
students' data first, leaves the data and `.env` settings alone, restarts the Portal and
checks it's working.

1. Log in at [my.vps.do](https://my.vps.do), open your server, and open its **console**
   (VNC / web console). Log in as `root`.
2. Paste this and press Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/claude/trusting-goodall-hxsi5s/portal/scripts/update-server.sh | bash
   ```

3. It ends with **Done. The Portal is running the new version.** and the backup's name.

**If the VNC button does nothing**, the browser is blocking its pop-up window: allow
pop-ups for my.vps.do (in Brave, turn Shields off for the site) or use Edge. **Or skip
VNC:** download the branch as a ZIP and double-click **Update-Live-Portal.cmd**. It
connects with Windows' built-in SSH, asks for the server's root password and runs the same
update.

If the console can't paste, type the address carefully.

#### If the repository is private

The line above downloads from GitHub without logging in, which only works while the
repository is public. For a private repository, give the server a read-only GitHub token
once:

1. On GitHub: your picture → **Settings** → **Developer settings** → **Personal access
   tokens** → **Fine-grained tokens** → **Generate new token**. Repository access: **Only
   select repositories** → EduBoard. Permissions: **Contents: Read-only**. Pick an
   expiry (e.g. one year) and copy the token.
2. In Command Prompt (paste the token in place of `TOKEN`):

   ```
   ssh root@portal.edu-board.com "cp /opt/eduboard/portal/scripts/update-server.sh /tmp/eb-update.sh && GITHUB_TOKEN=TOKEN bash /tmp/eb-update.sh"
   ```

The server keeps the token (readable by root only), so later updates are just
**Update-Live-Portal.cmd**. When the token expires, repeat these two steps. If it stops with an error, nothing after that step was changed and the backup
in `/root/` has the data as it was.

### On your own computer, before it goes live (Start-Test-Portal.cmd)

This runs a private copy of the Portal on your own PC. Only your PC can open it.
Nothing touches the live site or real students.

1. On GitHub, pick the branch → **Code** → **Download ZIP**, and unzip it.
2. Double-click **Start-Test-Portal.cmd** in the unzipped folder.
   - If Node.js isn't installed, it opens the download page. Install the **LTS**
     version (click Next through the installer), then double-click again.
   - The first run downloads the Portal's parts (a minute or two).
3. A window shows the addresses and secrets. Your browser opens a **demo class** you
   can join as a student.
4. To connect the desktop app to this test copy, go to **Settings**:
   - **Portal URL:** `http://localhost:4790`
   - **Portal sync secret:** the black window that opened when you double-clicked
     `Start-Test-Portal.cmd` shows a line starting **Portal sync secret:**, followed
     by a 48-character code. It's already copied, so press Ctrl+V. It's also saved in
     `portal\local-test\settings.json` as `"syncSecret"`. (This is not the
     "digest" shown on GitHub. That's just a checksum of the download.)

   Then **Publish to Portal**. Your classes replace the demo class. Remember to
   switch Settings back to `https://portal.edu-board.com` afterwards, with that
   Portal's own sync secret: the `SYNC_SECRET` set on the server (usually in the
   Portal folder's `.env` file).

5. Close the window to stop it. Everything is kept in `portal\local-test`. Delete that
   folder to start from scratch.

## 3. English / 中文 for students

- The **中文 / English** button at the top right switches every button, menu, date and
  error message. It's also under **Account → Language**. First visit follows the
  browser's language. After that, the student's choice is remembered.
- Homework instructions, class posts, study guides and messages each have a
  **Translate** button. The translation appears under your original, marked as AI,
  so students can compare the two. It goes into the student's **Preferred language**
  (Account → Profile), or into the interface language if none is set.
- The **Study Helper** answers in that same language.
- Translation and the Study Helper use the **Student AI** key from your desktop
  Settings (published to the Portal). Without that key, the buttons say AI isn't set up.
- Not translated: the admin page and the weekly digest emails (English only).

## 4. The free AI

1. Get a free key at [open.bigmodel.cn](https://open.bigmodel.cn) (Zhipu). Sign up,
   then create an API key under API Keys.
2. Desktop **Settings → Student AI (Portal)**: provider **Zhipu (GLM) — free tier**,
   paste the key.
3. Click **Test connection**. "Works. glm-4-flash-250414 replied." means it's good.
   If not, the message says why: key rejected, out of quota, or can't reach the
   provider.
4. **Save**, then **Publish to Portal** so the Portal gets the key.

The same button is under the teacher AI settings too.
