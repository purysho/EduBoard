// Error codes for the desktop app (EB-xxxx). Every error a teacher sees ends with its
// code, e.g. "Couldn't reach the Portal… (EB-1003)", so when someone asks for help the
// code says what happened and this catalog says what to do. The Portal's own codes
// (PT-xxxx) are in portal/errorCodes.js; a Portal code can appear inside an EB-1xxx
// message. docs/ERROR_CODES.md is generated from both catalogs (npm run error-codes) and
// a test fails if it's out of date.
//
// The catalog is for whoever supports EduBoard, so it's English only. The messages
// teachers see are translated where they're thrown.

export interface ErrorCodeInfo {
  area: string
  /** What happened. */
  meaning: string
  /** What the teacher, or whoever helps them, should do. */
  fix: string
}

export const APP_ERROR_CODES = {
  // --- General --------------------------------------------------------------------------
  'EB-0001': {
    area: 'General',
    meaning: 'EduBoard is locked (password protection) and something tried to use it.',
    fix: 'Unlock EduBoard with the password or recovery key, then try again.'
  },
  'EB-0002': {
    area: 'General',
    meaning:
      'The class, student, lesson plan or other item no longer exists (deleted, merged or restored from an older backup while the screen was open).',
    fix: 'Go back to the list and open it again. If it keeps happening, restart EduBoard.'
  },
  'EB-0003': {
    area: 'General',
    meaning: 'The student isn’t (or is no longer) in this class.',
    fix: 'Check the class’s roster; re-enrol the student if they should be there.'
  },
  'EB-0004': {
    area: 'General',
    meaning:
      'Something needed is missing or not valid (nothing chosen, nothing written, a bad date).',
    fix: 'Read the message: it names what to fill in or choose.'
  },
  'EB-0005': {
    area: 'General',
    meaning: 'The assignment has no rubric linked, so it can’t be marked with one.',
    fix: 'Edit the assessment and link a rubric, or enter the score directly.'
  },
  'EB-0900': {
    area: 'General',
    meaning:
      'Something unexpected went wrong in EduBoard itself. The details (and a reference) are in the error log.',
    fix: 'Ask for the error report (Settings → Help and updates → Copy error report) and look up the reference in it. Restarting EduBoard usually clears a one-off.'
  },
  'EB-0901': {
    area: 'General',
    meaning: 'A screen failed to draw. The details (and a reference) are in the error log.',
    fix: 'Click Reload. If the same screen fails again, get the error report (Settings → Help and updates) and look up the reference.'
  },

  // --- Portal -----------------------------------------------------------------------------
  'EB-1001': {
    area: 'Portal',
    meaning: 'No Portal is set up in Settings (address or sync secret missing).',
    fix: 'Settings → Portal and families: enter the Portal address and the sync secret from the Portal’s administrator.'
  },
  'EB-1002': {
    area: 'Portal',
    meaning: 'The Portal address in Settings isn’t a usable web address.',
    fix: 'Settings → Portal and families: use the full address, e.g. https://portal.edu-board.com.'
  },
  'EB-1003': {
    area: 'Portal',
    meaning:
      'This computer couldn’t connect to the Portal (no internet, a firewall or VPN, a wrong address, or the server is down).',
    fix: 'Check the internet connection and the address in Settings. Open the address in a browser: if it doesn’t load there either, the server is down (check the VPS).'
  },
  'EB-1004': {
    area: 'Portal',
    meaning: 'The Portal didn’t accept the sync secret.',
    fix: 'Settings → Portal and families: the sync secret must be exactly the SYNC_SECRET in the Portal’s .env file, or the teacher’s own secret from the admin page.'
  },
  'EB-1005': {
    area: 'Portal',
    meaning: 'The Portal refused something as too large.',
    fix: 'Update the Portal (Update-Live-Portal). If it still happens, the file is over the size limit; use a smaller file.'
  },
  'EB-1006': {
    area: 'Portal',
    meaning: 'The Portal server isn’t responding (502, 503 or 504 from the proxy in front of it).',
    fix: 'Wait a minute and try again. If it lasts, on the server run: systemctl status eduboard-portal (and restart it).'
  },
  'EB-1007': {
    area: 'Portal',
    meaning: 'The Portal is an older version that doesn’t have this feature.',
    fix: 'Update the Portal (Update-Live-Portal).'
  },
  'EB-1008': {
    area: 'Portal',
    meaning:
      'The Portal answered with an error. Its own code (PT-xxxx), if any, is shown in the message.',
    fix: 'Look up the PT code in the Portal section below. Without one, check the Portal’s log: journalctl -u eduboard-portal.'
  },
  'EB-1009': {
    area: 'Portal',
    meaning: 'Resetting a student’s or family’s Portal password failed.',
    fix: 'Check the username is right and belongs to this teacher’s students, then try again.'
  },
  'EB-1010': {
    area: 'Portal',
    meaning: 'Report cards are already being sent from this computer.',
    fix: 'Wait for the first send to finish (the Report tab shows how far it has got).'
  },
  'EB-1011': {
    area: 'Portal',
    meaning:
      'The Portal server is older than the feature being used (for example sending report cards).',
    fix: 'Update the Portal server (Update-Live-Portal.cmd, or portal/scripts/update-server.sh), then try again.'
  },

  // --- Files, imports and school packs ------------------------------------------------------
  'EB-2001': {
    area: 'Files',
    meaning: 'The chosen file isn’t a school pack (not readable, or not EduBoard’s format).',
    fix: 'Export a fresh school pack from the other computer (Settings → Data and security → School pack) and import that file.'
  },
  'EB-2002': {
    area: 'Files',
    meaning:
      'A roster or gradebook import couldn’t be read (no sheets, or not the expected layout).',
    fix: 'Open the file in Excel or WPS, check it has a sheet with a header row, and save it as .xlsx.'
  },
  'EB-2003': {
    area: 'Files',
    meaning: 'The course group has no classes, so there’s nothing to export.',
    fix: 'Add classes to the course group first (Composite Grades).'
  },
  'EB-2004': {
    area: 'Files',
    meaning: 'A resource file couldn’t be read (too large, an unsupported type, or damaged).',
    fix: 'Save the file as PDF, Word (.docx) or plain text, under the size limit, and add it again.'
  },
  'EB-2005': {
    area: 'Files',
    meaning:
      'A resource’s text couldn’t be read: it has no file or web address, or the web page couldn’t be fetched.',
    fix: 'Edit the resource and attach the file or fix its web address; open the address in a browser to check it works.'
  },
  'EB-2006': {
    area: 'Files',
    meaning:
      'EduBoard refused to open a handed-in file because it isn’t what its name says, or isn’t a type it opens safely.',
    fix: 'Ask the student to save the work as PDF, Word, an image or plain text and hand it in again.'
  },

  // --- Updates ------------------------------------------------------------------------------
  'EB-3001': {
    area: 'Updates',
    meaning: 'The newest release has no download for this kind of computer.',
    fix: 'Download the right file from portal.edu-board.com/download (or GitHub Releases) and install it by hand.'
  },
  'EB-3002': {
    area: 'Updates',
    meaning: 'EduBoard couldn’t ask for the newest version (through the Portal, or GitHub).',
    fix: 'Check the internet connection; with a Portal set up, check the Portal is running. Try again later: GitHub limits how often one address may ask.'
  },
  'EB-3003': {
    area: 'Updates',
    meaning: 'Downloading the update failed.',
    fix: 'Try again. If it keeps failing, download it from portal.edu-board.com/download and install it by hand.'
  },
  'EB-3004': {
    area: 'Updates',
    meaning: 'The update download stopped part-way.',
    fix: 'Try again on a steadier connection.'
  },
  'EB-3005': {
    area: 'Updates',
    meaning: 'The update is still downloading.',
    fix: 'Wait for the download to finish, then install.'
  },
  'EB-3006': {
    area: 'Updates',
    meaning:
      'EduBoard can’t update itself where it’s installed (e.g. a read-only folder, or running from the disk image on a Mac).',
    fix: 'Read the message for the reason. Usually: move EduBoard to Applications (Mac) or reinstall with the installer.'
  },

  // --- AI -----------------------------------------------------------------------------------
  'EB-4001': {
    area: 'AI',
    meaning: 'No AI provider or key is set up.',
    fix: 'Settings → AI: choose a provider and paste an API key (or a custom address and model).'
  },
  'EB-4002': {
    area: 'AI',
    meaning:
      'The AI provider couldn’t be reached or refused the request (wrong key, no credit, blocked network).',
    fix: 'Read the message for the provider’s reason. Check the key and balance with the provider, and the internet connection or VPN.'
  },
  'EB-4003': {
    area: 'AI',
    meaning: 'The AI answered, but not in a form EduBoard can use, so nothing was shown.',
    fix: 'Try again. If it keeps happening with one provider, try another model or provider.'
  },
  'EB-4004': {
    area: 'AI',
    meaning: 'The student hasn’t handed anything in, so there’s nothing to give feedback on.',
    fix: 'Wait for the submission, or write feedback yourself.'
  },

  // --- Password protection ------------------------------------------------------------------
  'EB-5001': {
    area: 'Password protection',
    meaning: 'EduBoard’s key file is damaged, so the encrypted database can’t be opened.',
    fix: 'Restore a backup (the launch screen offers this). Backups made before password protection was turned on open without the key.'
  },
  'EB-5002': {
    area: 'Password protection',
    meaning: 'The new password is too short.',
    fix: 'Use a longer password (the message says how long).'
  },
  'EB-5003': {
    area: 'Password protection',
    meaning: 'Password protection is already on.',
    fix: 'Nothing to do. To change the password, use Change password.'
  },
  'EB-5004': {
    area: 'Password protection',
    meaning: 'That isn’t the current password or the recovery key.',
    fix: 'Try again, or use the recovery key. Without either, the data can’t be opened; restore a backup.'
  },

  // --- Group chats --------------------------------------------------------------------------
  'EB-6001': {
    area: 'Group chats',
    meaning: 'The address isn’t a DingTalk or WeCom group robot’s webhook.',
    fix: 'In the group, open the robot’s settings and copy the whole webhook address (https://oapi.dingtalk.com/robot/send?… or https://qyapi.weixin.qq.com/cgi-bin/webhook/send?…).'
  },
  'EB-6002': {
    area: 'Group chats',
    meaning: 'There was nothing to send.',
    fix: 'Write the post or newsletter first.'
  },
  'EB-6003': {
    area: 'Group chats',
    meaning: 'This computer couldn’t reach DingTalk or WeCom.',
    fix: 'Check the internet connection.'
  },
  'EB-6004': {
    area: 'Group chats',
    meaning: 'DingTalk refused the message because of the robot’s security setting (310000).',
    fix: 'In the robot’s settings choose 加签 (signing) and paste its secret (SEC…) into EduBoard, or add a keyword the messages always contain.'
  },
  'EB-6005': {
    area: 'Group chats',
    meaning: 'The robot no longer exists (DingTalk 300001 / 300005, WeCom 93000).',
    fix: 'Add the robot again in the group and paste its new address in Settings → Portal and families → Class group chats.'
  },
  'EB-6006': {
    area: 'Group chats',
    meaning: 'DingTalk or WeCom refused the message for another reason, shown in the message.',
    fix: 'Look up the service’s own error code in the message in its documentation.'
  },
  'EB-6007': {
    area: 'Group chats',
    meaning: 'That group chat has been removed from Settings.',
    fix: 'Choose another group, or add it again in Settings → Portal and families → Class group chats.'
  }
} as const satisfies Record<string, ErrorCodeInfo>

export type AppErrorCode = keyof typeof APP_ERROR_CODES

/** An error a teacher may see, with its code. Thrown anywhere in the main process; the
 * IPC layer adds the code to the message the window receives. */
export class AppError extends Error {
  readonly code: AppErrorCode
  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AppError'
  }
}

export const isAppErrorCode = (code: unknown): code is AppErrorCode =>
  typeof code === 'string' && code in APP_ERROR_CODES

/** The code (and reference, for unexpected errors) as it's put at the end of a message
 * sent to the window: "… [EB-1003]" or "… [EB-0900 ref 7KQ2MX]". */
export function withCode(message: string, code: string, ref?: string): string {
  return `${message} [${code}${ref ? ` ref ${ref}` : ''}]`
}

/** Splits a message into its text and its code and reference, if it has them. */
export function splitCode(message: string): { text: string; code?: string; ref?: string } {
  const m = /^([\s\S]*?)\s*\[((?:EB|PT)-\d{4})(?: ref ([A-Z0-9]+))?\]\s*$/.exec(message)
  return m ? { text: m[1], code: m[2], ref: m[3] } : { text: message }
}
