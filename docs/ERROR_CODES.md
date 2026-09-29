# EduBoard error codes

Every error message in EduBoard ends with a code, so when someone asks for help the code
says what happened. This page is generated from the code catalogs
(`src/shared/errorCodes.ts` and `portal/errorCodes.js`); run `npm run error-codes`
after changing either.

- **EB-xxxx** codes come from the teacher's desktop app: "Couldn't reach the Portal… (EB-1003)".
- **PT-xxxx** codes come from the Portal (the student and family website): "Not your class
  (PT-3001)". When the desktop app talks to the Portal, a PT code can appear inside an
  EB-1008 message.
- **Unexpected errors** (EB-0900, EB-0901, PT-9900) also show a reference, such as
  "EB-0900 · ref 7KQ2MX". Look it up in:
  - the app's error log: ask the teacher for **Settings → Help → Copy error report**
    (or the file `logs/errors.log` beside the database, shown by **Show the log file**);
  - the Portal's server log: `journalctl -u eduboard-portal | grep 7KQ2MX`.

## Desktop app (EB)

### General

| Code | What happened | What to do |
| --- | --- | --- |
| EB-0001 | EduBoard is locked (password protection) and something tried to use it. | Unlock EduBoard with the password or recovery key, then try again. |
| EB-0002 | The class, student, lesson plan or other item no longer exists (deleted, merged or restored from an older backup while the screen was open). | Go back to the list and open it again. If it keeps happening, restart EduBoard. |
| EB-0003 | The student isn’t (or is no longer) in this class. | Check the class’s roster; re-enrol the student if they should be there. |
| EB-0004 | Something needed is missing or not valid (nothing chosen, nothing written, a bad date). | Read the message: it names what to fill in or choose. |
| EB-0005 | The assignment has no rubric linked, so it can’t be marked with one. | Edit the assessment and link a rubric, or enter the score directly. |
| EB-0900 | Something unexpected went wrong in EduBoard itself. The details (and a reference) are in the error log. | Ask for the error report (Settings → Help and updates → Copy error report) and look up the reference in it. Restarting EduBoard usually clears a one-off. |
| EB-0901 | A screen failed to draw. The details (and a reference) are in the error log. | Click Reload. If the same screen fails again, get the error report (Settings → Help and updates) and look up the reference. |

### Portal

| Code | What happened | What to do |
| --- | --- | --- |
| EB-1001 | No Portal is set up in Settings (address or sync secret missing). | Settings → Portal and families: enter the Portal address and the sync secret from the Portal’s administrator. |
| EB-1002 | The Portal address in Settings isn’t a usable web address. | Settings → Portal and families: use the full address, e.g. https://portal.edu-board.com. |
| EB-1003 | This computer couldn’t connect to the Portal (no internet, a firewall or VPN, a wrong address, or the server is down). | Check the internet connection and the address in Settings. Open the address in a browser: if it doesn’t load there either, the server is down (check the VPS). |
| EB-1004 | The Portal didn’t accept the sync secret. | Settings → Portal and families: the sync secret must be exactly the SYNC_SECRET in the Portal’s .env file, or the teacher’s own secret from the admin page. |
| EB-1005 | The Portal refused something as too large. | Update the Portal (Update-Live-Portal). If it still happens, the file is over the size limit; use a smaller file. |
| EB-1006 | The Portal server isn’t responding (502, 503 or 504 from the proxy in front of it). | Wait a minute and try again. If it lasts, on the server run: systemctl status eduboard-portal (and restart it). |
| EB-1007 | The Portal is an older version that doesn’t have this feature. | Update the Portal (Update-Live-Portal). |
| EB-1008 | The Portal answered with an error. Its own code (PT-xxxx), if any, is shown in the message. | Look up the PT code in the Portal section below. Without one, check the Portal’s log: journalctl -u eduboard-portal. |
| EB-1009 | Resetting a student’s or family’s Portal password failed. | Check the username is right and belongs to this teacher’s students, then try again. |
| EB-1010 | Report cards are already being sent from this computer. | Wait for the first send to finish (the Report tab shows how far it has got). |
| EB-1011 | The Portal server is older than the feature being used (for example sending report cards). | Update the Portal server (Update-Live-Portal.cmd, or portal/scripts/update-server.sh), then try again. |

### Files

| Code | What happened | What to do |
| --- | --- | --- |
| EB-2001 | The chosen file isn’t a school pack (not readable, or not EduBoard’s format). | Export a fresh school pack from the other computer (Settings → Data and security → School pack) and import that file. |
| EB-2002 | A roster or gradebook import couldn’t be read (no sheets, or not the expected layout). | Open the file in Excel or WPS, check it has a sheet with a header row, and save it as .xlsx. |
| EB-2003 | The course group has no classes, so there’s nothing to export. | Add classes to the course group first (Composite Grades). |
| EB-2004 | A resource file couldn’t be read (too large, an unsupported type, or damaged). | Save the file as PDF, Word (.docx) or plain text, under the size limit, and add it again. |
| EB-2005 | A resource’s text couldn’t be read: it has no file or web address, or the web page couldn’t be fetched. | Edit the resource and attach the file or fix its web address; open the address in a browser to check it works. |
| EB-2006 | EduBoard refused to open a handed-in file because it isn’t what its name says, or isn’t a type it opens safely. | Ask the student to save the work as PDF, Word, an image or plain text and hand it in again. |
| EB-2007 | The chosen file can’t be used as a Course Pack: it isn’t readable, isn’t a Course Pack (or is for a newer EduBoard), or something in it is missing, not valid or refers to something the pack doesn’t have. The message names the place, e.g. lessons[3].standardKeys[0]. | Ask whoever made the pack for a corrected copy, or fix the named place in the .json file and import it again. Nothing was changed. |
| EB-2008 | The Course Pack can’t be installed as chosen: a term has no class or no first class date, the same class was chosen for two terms, a chosen class no longer exists, or one of the pack’s student fields clashes with a field already set up. | Read the message: it names the term or field. Choose a class and first date for every term (a different class each), or rename the clashing student field in Settings → Class lists. Nothing was changed. |

### Updates

| Code | What happened | What to do |
| --- | --- | --- |
| EB-3001 | The newest release has no download for this kind of computer. | Download the right file from portal.edu-board.com/download (or GitHub Releases) and install it by hand. |
| EB-3002 | EduBoard couldn’t ask for the newest version (through the Portal, or GitHub). | Check the internet connection; with a Portal set up, check the Portal is running. Try again later: GitHub limits how often one address may ask. |
| EB-3003 | Downloading the update failed. | Try again. If it keeps failing, download it from portal.edu-board.com/download and install it by hand. |
| EB-3004 | The update download stopped part-way. | Try again on a steadier connection. |
| EB-3005 | The update is still downloading. | Wait for the download to finish, then install. |
| EB-3006 | EduBoard can’t update itself where it’s installed (e.g. a read-only folder, or running from the disk image on a Mac). | Read the message for the reason. Usually: move EduBoard to Applications (Mac) or reinstall with the installer. |

### AI

| Code | What happened | What to do |
| --- | --- | --- |
| EB-4001 | No AI provider or key is set up. | Settings → AI: choose a provider and paste an API key (or a custom address and model). |
| EB-4002 | The AI provider couldn’t be reached or refused the request (wrong key, no credit, blocked network). | Read the message for the provider’s reason. Check the key and balance with the provider, and the internet connection or VPN. |
| EB-4003 | The AI answered, but not in a form EduBoard can use, so nothing was shown. | Try again. If it keeps happening with one provider, try another model or provider. |
| EB-4004 | The student hasn’t handed anything in, so there’s nothing to give feedback on. | Wait for the submission, or write feedback yourself. |

### Password protection

| Code | What happened | What to do |
| --- | --- | --- |
| EB-5001 | EduBoard’s key file is damaged, so the encrypted database can’t be opened. | Restore a backup (the launch screen offers this). Backups made before password protection was turned on open without the key. |
| EB-5002 | The new password is too short. | Use a longer password (the message says how long). |
| EB-5003 | Password protection is already on. | Nothing to do. To change the password, use Change password. |
| EB-5004 | That isn’t the current password or the recovery key. | Try again, or use the recovery key. Without either, the data can’t be opened; restore a backup. |

### Group chats

| Code | What happened | What to do |
| --- | --- | --- |
| EB-6001 | The address isn’t a DingTalk or WeCom group robot’s webhook. | In the group, open the robot’s settings and copy the whole webhook address (https://oapi.dingtalk.com/robot/send?… or https://qyapi.weixin.qq.com/cgi-bin/webhook/send?…). |
| EB-6002 | There was nothing to send. | Write the post or newsletter first. |
| EB-6003 | This computer couldn’t reach DingTalk or WeCom. | Check the internet connection. |
| EB-6004 | DingTalk refused the message because of the robot’s security setting (310000). | In the robot’s settings choose 加签 (signing) and paste its secret (SEC…) into EduBoard, or add a keyword the messages always contain. |
| EB-6005 | The robot no longer exists (DingTalk 300001 / 300005, WeCom 93000). | Add the robot again in the group and paste its new address in Settings → Portal and families → Class group chats. |
| EB-6006 | DingTalk or WeCom refused the message for another reason, shown in the message. | Look up the service’s own error code in the message in its documentation. |
| EB-6007 | That group chat has been removed from Settings. | Choose another group, or add it again in Settings → Portal and families → Class group chats. |

## Portal (PT)

### Signing in

| Code | What happened | What to do |
| --- | --- | --- |
| PT-1001 | Not signed in, or the session has ended. | Sign in again. If it keeps happening, check the browser allows cookies for the Portal. |
| PT-1002 | Wrong username or password. | Check the username. The teacher can reset the password (EduBoard → a class → Portal, or approve a reset request on the Dashboard). |
| PT-1003 | Too many attempts from this network or for this account; paused for a few minutes. | Wait 15 minutes. Only failed logins count toward the network’s limit; if a whole school shares one internet address and still hits it, raise RATE_LOGIN_PER_IP in the Portal’s .env. |
| PT-1004 | A password reset request was sent without a username. | Type the username first. |
| PT-1005 | The password reset request doesn’t exist any more, or the teacher hasn’t approved it. | Ask again, and ask the teacher to approve it on EduBoard’s Dashboard. |
| PT-1006 | The new password or username isn’t acceptable (too short, or taken). | Read the message: it says what’s needed. |
| PT-1007 | The current password typed to change it is wrong. | Type the current password again, or ask the teacher for a reset. |
| PT-1008 | The email address isn’t valid. | Check the address for typos. |
| PT-1009 | The public demo login can’t be changed (password, email or QR login). | Nothing to do: the demo is shared and resets every day. |
| PT-1010 | The agreement to the terms at first sign-in is missing a choice or the guardian’s name. | Choose who is agreeing, and type the parent or guardian’s name if it’s them. |

### Joining

| Code | What happened | What to do |
| --- | --- | --- |
| PT-2001 | The invite code or join link is wrong, already used, or withdrawn. | Ask the teacher for a new invite (EduBoard → the class → Portal). |
| PT-2002 | Something needed to join is missing or not acceptable (username, password). | Read the message: it says what to change. |
| PT-2003 | The student chosen isn’t in this class. | Choose the right name, or ask the teacher to add the student and publish. |
| PT-2004 | Joining through the class link didn’t work (the reason is in the message). | Read the message; if the class link was withdrawn, ask the teacher for a new one. |

### Homework and files

| Code | What happened | What to do |
| --- | --- | --- |
| PT-3001 | This account isn’t allowed to see or change that (not its student, or not enrolled in the class). | Sign in with the right account. If the student should be in the class, the teacher enrols them and publishes. |
| PT-3002 | What was asked for doesn’t exist on the Portal (removed, or not published yet). | Refresh the page. If it should be there, the teacher publishes from EduBoard. |
| PT-3003 | There’s nothing to hand in (no text, file or answers), or the assignment has no questions. | Add the work before submitting. |
| PT-3004 | The file is too large. | Use a smaller file (20 MB at most for handed-in work). |
| PT-3005 | The class has finished, so work can’t be handed in any more. | Nothing to do; the class is read-only now. |
| PT-3006 | The file type isn’t allowed, or the file isn’t what its name says. | Save it as PDF, Word, an image or plain text and try again. |
| PT-3007 | The message (or text to translate) is empty. | Write something first. |
| PT-3008 | The language chosen for translation isn’t one the Portal offers. | Pick a language from the list. |

### AI

| Code | What happened | What to do |
| --- | --- | --- |
| PT-4001 | AI help or translation isn’t available (no AI key published by the teacher, or the provider refused). | The teacher adds an AI key in EduBoard’s Settings and publishes. |
| PT-4002 | The AI provider didn’t answer properly. | Try again in a moment. If it lasts, check the key and balance with the AI provider. |
| PT-4003 | This account has used today’s AI allowance. | Try again tomorrow. The limit is RATE_AI_PER_DAY in the Portal’s .env. |

### Teacher sync

| Code | What happened | What to do |
| --- | --- | --- |
| PT-5001 | The sync secret sent by the desktop app is wrong. | In EduBoard’s Settings, the sync secret must be exactly SYNC_SECRET from the Portal’s .env, or the teacher’s secret from the admin page. |
| PT-5002 | An attachment or material text didn’t match what was published (a publish was interrupted). | Publish again from EduBoard. |
| PT-5003 | The desktop app sent an incomplete request (usually a newer or older app than the Portal). | Update both EduBoard and the Portal to the latest version. |
| PT-5004 | The weekly digest email isn’t set up (no mail server details). | In EduBoard’s Settings, fill in the digest email settings and publish. |
| PT-5005 | Sending the digest email failed (the mail server refused it). | Check the mail server, username and password in EduBoard’s digest settings; the message has the mail server’s reason. |
| PT-5006 | The teacher’s own email address isn’t set, so the weekly summary can’t be sent. | EduBoard → Settings → Your email address, then publish. |
| PT-5007 | The password reset request was already answered or withdrawn. | Refresh the Dashboard. |
| PT-5008 | No Portal account has that username (for this teacher’s students). | Check the username on the class’s Portal tab. |

### Administration

| Code | What happened | What to do |
| --- | --- | --- |
| PT-6001 | The admin secret is wrong. | Use ADMIN_SECRET from the Portal’s .env file. If it isn’t set, add it and restart the Portal. |
| PT-6002 | A teacher’s name is missing or too long. | Type a name of up to 100 characters. |
| PT-6003 | That teacher doesn’t exist (already removed). | Refresh the admin page. |

### Downloads and updates

| Code | What happened | What to do |
| --- | --- | --- |
| PT-6004 | The Portal couldn’t reach GitHub to find or pass along the newest EduBoard. | Check the server’s internet connection; try again later (GitHub limits how often one server may ask). |
| PT-6005 | The newest release has no file with that name. | Use the download page (/download) to pick the file. |
| PT-6006 | A usage ping wasn’t in the expected form, or the Portal isn’t accepting new copies. | Nothing for a teacher to do; the app tries again next week. |

### Server

| Code | What happened | What to do |
| --- | --- | --- |
| PT-9001 | The address asked for doesn’t exist on this Portal (often an older Portal than the app expects). | Update the Portal (Update-Live-Portal). |
| PT-9002 | The request couldn’t be read. | Refresh the page and try again. |
| PT-9900 | Something unexpected went wrong on the server. The reference is in the server log. | On the server: journalctl -u eduboard-portal \| grep <ref> shows the details. |
