// Error codes for the Portal (PT-xxxx). Every error the Portal answers with carries one
// ({ error, code }), the Portal page shows it after the message, and the desktop app
// shows it inside its own EB-1008 message. Unexpected server errors (PT-9900) also carry
// a reference that is written to the server log (journalctl -u eduboard-portal).
// docs/ERROR_CODES.md is generated from this and src/shared/errorCodes.ts.
//
// For whoever runs the Portal, so English only.

const PORTAL_ERROR_CODES = {
  // --- Signing in and accounts ------------------------------------------------------------
  'PT-1001': {
    area: 'Signing in',
    meaning: 'Not signed in, or the session has ended.',
    fix: 'Sign in again. If it keeps happening, check the browser allows cookies for the Portal.'
  },
  'PT-1002': {
    area: 'Signing in',
    meaning: 'Wrong username or password.',
    fix: 'Check the username. The teacher can reset the password (EduBoard → a class → Portal, or approve a reset request on the Dashboard).'
  },
  'PT-1003': {
    area: 'Signing in',
    meaning: 'Too many attempts from this network or for this account; paused for a few minutes.',
    fix: 'Wait 15 minutes. Only failed logins count toward the network’s limit; if a whole school shares one internet address and still hits it, raise RATE_LOGIN_PER_IP in the Portal’s .env.'
  },
  'PT-1004': {
    area: 'Signing in',
    meaning: 'A password reset request was sent without a username.',
    fix: 'Type the username first.'
  },
  'PT-1005': {
    area: 'Signing in',
    meaning:
      'The password reset request doesn’t exist any more, or the teacher hasn’t approved it.',
    fix: 'Ask again, and ask the teacher to approve it on EduBoard’s Dashboard.'
  },
  'PT-1006': {
    area: 'Signing in',
    meaning: 'The new password or username isn’t acceptable (too short, or taken).',
    fix: 'Read the message: it says what’s needed.'
  },
  'PT-1007': {
    area: 'Signing in',
    meaning: 'The current password typed to change it is wrong.',
    fix: 'Type the current password again, or ask the teacher for a reset.'
  },
  'PT-1008': {
    area: 'Signing in',
    meaning: 'The email address isn’t valid.',
    fix: 'Check the address for typos.'
  },
  'PT-1009': {
    area: 'Signing in',
    meaning: 'The public demo login can’t be changed (password, email or QR login).',
    fix: 'Nothing to do: the demo is shared and resets every day.'
  },
  'PT-1010': {
    area: 'Signing in',
    meaning:
      'The agreement to the terms at first sign-in is missing a choice or the guardian’s name.',
    fix: 'Choose who is agreeing, and type the parent or guardian’s name if it’s them.'
  },

  // --- Joining a class --------------------------------------------------------------------
  'PT-2001': {
    area: 'Joining',
    meaning: 'The invite code or join link is wrong, already used, or withdrawn.',
    fix: 'Ask the teacher for a new invite (EduBoard → the class → Portal).'
  },
  'PT-2002': {
    area: 'Joining',
    meaning: 'Something needed to join is missing or not acceptable (username, password).',
    fix: 'Read the message: it says what to change.'
  },
  'PT-2003': {
    area: 'Joining',
    meaning: 'The student chosen isn’t in this class.',
    fix: 'Choose the right name, or ask the teacher to add the student and publish.'
  },
  'PT-2004': {
    area: 'Joining',
    meaning: 'Joining through the class link didn’t work (the reason is in the message).',
    fix: 'Read the message; if the class link was withdrawn, ask the teacher for a new one.'
  },

  // --- Homework, files and messages -------------------------------------------------------
  'PT-3001': {
    area: 'Homework and files',
    meaning:
      'This account isn’t allowed to see or change that (not its student, or not enrolled in the class).',
    fix: 'Sign in with the right account. If the student should be in the class, the teacher enrols them and publishes.'
  },
  'PT-3002': {
    area: 'Homework and files',
    meaning: 'What was asked for doesn’t exist on the Portal (removed, or not published yet).',
    fix: 'Refresh the page. If it should be there, the teacher publishes from EduBoard.'
  },
  'PT-3003': {
    area: 'Homework and files',
    meaning:
      'There’s nothing to hand in (no text, file or answers), or the assignment has no questions.',
    fix: 'Add the work before submitting.'
  },
  'PT-3004': {
    area: 'Homework and files',
    meaning: 'The file is too large.',
    fix: 'Use a smaller file (20 MB at most for handed-in work).'
  },
  'PT-3005': {
    area: 'Homework and files',
    meaning: 'The class has finished, so work can’t be handed in any more.',
    fix: 'Nothing to do; the class is read-only now.'
  },
  'PT-3006': {
    area: 'Homework and files',
    meaning: 'The file type isn’t allowed, or the file isn’t what its name says.',
    fix: 'Save it as PDF, Word, an image or plain text and try again.'
  },
  'PT-3007': {
    area: 'Homework and files',
    meaning: 'The message (or text to translate) is empty.',
    fix: 'Write something first.'
  },
  'PT-3008': {
    area: 'Homework and files',
    meaning: 'The language chosen for translation isn’t one the Portal offers.',
    fix: 'Pick a language from the list.'
  },

  // --- AI and translation -----------------------------------------------------------------
  'PT-4001': {
    area: 'AI',
    meaning:
      'AI help or translation isn’t available (no AI key published by the teacher, or the provider refused).',
    fix: 'The teacher adds an AI key in EduBoard’s Settings and publishes.'
  },
  'PT-4002': {
    area: 'AI',
    meaning: 'The AI provider didn’t answer properly.',
    fix: 'Try again in a moment. If it lasts, check the key and balance with the AI provider.'
  },
  'PT-4003': {
    area: 'AI',
    meaning: 'This account has used today’s AI allowance.',
    fix: 'Try again tomorrow. The limit is RATE_AI_PER_DAY in the Portal’s .env.'
  },

  // --- The teacher’s desktop app ----------------------------------------------------------
  'PT-5001': {
    area: 'Teacher sync',
    meaning: 'The sync secret sent by the desktop app is wrong.',
    fix: 'In EduBoard’s Settings, the sync secret must be exactly SYNC_SECRET from the Portal’s .env, or the teacher’s secret from the admin page.'
  },
  'PT-5002': {
    area: 'Teacher sync',
    meaning:
      'An attachment or material text didn’t match what was published (a publish was interrupted).',
    fix: 'Publish again from EduBoard.'
  },
  'PT-5003': {
    area: 'Teacher sync',
    meaning:
      'The desktop app sent an incomplete request (usually a newer or older app than the Portal).',
    fix: 'Update both EduBoard and the Portal to the latest version.'
  },
  'PT-5004': {
    area: 'Teacher sync',
    meaning: 'The weekly digest email isn’t set up (no mail server details).',
    fix: 'In EduBoard’s Settings, fill in the digest email settings and publish.'
  },
  'PT-5005': {
    area: 'Teacher sync',
    meaning: 'Sending the digest email failed (the mail server refused it).',
    fix: 'Check the mail server, username and password in EduBoard’s digest settings; the message has the mail server’s reason.'
  },
  'PT-5006': {
    area: 'Teacher sync',
    meaning: 'The teacher’s own email address isn’t set, so the weekly summary can’t be sent.',
    fix: 'EduBoard → Settings → Your email address, then publish.'
  },
  'PT-5007': {
    area: 'Teacher sync',
    meaning: 'The password reset request was already answered or withdrawn.',
    fix: 'Refresh the Dashboard.'
  },
  'PT-5008': {
    area: 'Teacher sync',
    meaning: 'No Portal account has that username (for this teacher’s students).',
    fix: 'Check the username on the class’s Portal tab.'
  },

  // --- Administration and the server ------------------------------------------------------
  'PT-6001': {
    area: 'Administration',
    meaning: 'The admin secret is wrong.',
    fix: 'Use ADMIN_SECRET from the Portal’s .env file. If it isn’t set, add it and restart the Portal.'
  },
  'PT-6002': {
    area: 'Administration',
    meaning: 'A teacher’s name is missing or too long.',
    fix: 'Type a name of up to 100 characters.'
  },
  'PT-6003': {
    area: 'Administration',
    meaning: 'That teacher doesn’t exist (already removed).',
    fix: 'Refresh the admin page.'
  },
  'PT-6004': {
    area: 'Downloads and updates',
    meaning: 'The Portal couldn’t reach GitHub to find or pass along the newest EduBoard.',
    fix: 'Check the server’s internet connection; try again later (GitHub limits how often one server may ask).'
  },
  'PT-6005': {
    area: 'Downloads and updates',
    meaning: 'The newest release has no file with that name.',
    fix: 'Use the download page (/download) to pick the file.'
  },
  'PT-6006': {
    area: 'Downloads and updates',
    meaning: 'A usage ping wasn’t in the expected form, or the Portal isn’t accepting new copies.',
    fix: 'Nothing for a teacher to do; the app tries again next week.'
  },
  'PT-6007': {
    area: 'Administration',
    meaning:
      'The Portal’s name and logo can only follow the teachers’ apps, one teacher, or EduBoard.',
    fix: 'Refresh the admin page and choose again (the teacher may have been removed).'
  },
  'PT-9001': {
    area: 'Server',
    meaning:
      'The address asked for doesn’t exist on this Portal (often an older Portal than the app expects).',
    fix: 'Update the Portal (Update-Live-Portal).'
  },
  'PT-9002': {
    area: 'Server',
    meaning: 'The request couldn’t be read.',
    fix: 'Refresh the page and try again.'
  },
  'PT-9900': {
    area: 'Server',
    meaning: 'Something unexpected went wrong on the server. The reference is in the server log.',
    fix: 'On the server: journalctl -u eduboard-portal | grep <ref> shows the details.'
  }
}

module.exports = { PORTAL_ERROR_CODES }
