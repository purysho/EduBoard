# How EduBoard is built

EduBoard has two parts: a **desktop app** where a teacher keeps their classes, and the
**Portal**, a website where students and families see what the teacher chose to share.
The teacher's computer is the source of truth; the Portal is a copy for families plus
what families send back (handed-in work, replies, messages).

```
 Teacher's computer                                    Portal server (Hong Kong, or the school's own)
┌──────────────────────────────────────┐   publish   ┌────────────────────────────────────┐
│ EduBoard desktop app (Electron)      │ ──HTTPS───▶ │ Node/Express + SQLite              │
│  React screens  ⇄  typed IPC  ⇄  main │  sync key   │  /api/sync   (teacher's app)        │
│  main: SQLite (encrypted if locked), │ ◀────────── │  /api/me     (signed-in family)     │
│        backups, exports, updater     │ work, replies│  /api/admin  (server owner)        │
└──────────────────────────────────────┘             │  web pages: login, homepage, legal  │
                                                     └────────────────────────────────────┘
                                                                ▲ phones and browsers
                                                                │ (students and families)
```

## Desktop app (`src/`)

| Layer | Where | What |
| --- | --- | --- |
| Screens | `src/renderer/src` | React 19, Tailwind v4 (colours are CSS variables, so schools can restyle), React Query for data |
| Bridge | `src/preload`, `src/shared/api.ts`, `src/shared/ipc.ts` | A typed `window.api`: the screens can't touch files, the database or the network directly |
| Main process | `src/main` | IPC handlers (`ipc/register.ts`), repositories per table (`repositories/`), services (`services/`: grading, reports, publishing, backups, exports, updates, AI) |
| Storage | `src/main/db` | One SQLite file via Drizzle; hand-written, numbered migrations (`migrations.ts`) that run at start |
| Shared | `src/shared` | Types, grading maths, school packs, error codes, English/Chinese text (`i18n/`) |

Design decisions worth knowing:

- **Local-first.** Everything works offline. The network is used only for what the
  teacher sets up: publishing to the Portal, AI suggestions with their own key, group-chat
  posts, update checks, and an anonymous weekly count that is off by default.
- **Encryption at rest when protected.** With password protection on, the database and
  its backups are encrypted (ChaCha20-Poly1305 via SQLite3 Multiple Ciphers). The random
  key is stored only wrapped by the teacher's password and a recovery key (AES-256-GCM,
  scrypt). While locked, the IPC layer refuses every call except unlocking.
- **AI only suggests.** Report comment wording, newsletters and so on are shown for the
  teacher to accept or edit; nothing AI-written is saved or sent unseen.
- **Errors are coded.** Every error a person can see has a code (`EB-xxxx`, `PT-xxxx`) with
  its meaning and fix in `docs/ERROR_CODES.md`, and is logged next to the database without
  student data, so support works from a copied error report.
- **Two languages everywhere.** All text goes through `tr()`; tests fail if a Chinese
  translation is missing or drops a placeholder.
- **Updates** come from GitHub Releases, relayed through the teacher's Portal when there
  is one (GitHub is often slow or blocked in mainland China). A downloaded update installs
  at the next start, after a backup.
- **Schools** can share settings as a school pack, or install one for every teacher on a
  computer (`docs/SCHOOL_DEPLOYMENT.md`).

## Portal (`portal/`)

| Part | Where | What |
| --- | --- | --- |
| Server | `server.js` | Express; security headers, HTTPS-only cookies and HSTS behind a proxy |
| Data | `db.js` | SQLite; each teacher's published data is replaced in one transaction per publish |
| Teachers' apps | `routes/sync.js` | Authenticated with a per-teacher sync key; can only write to that teacher's classes |
| Families | `routes/me.js` | Signed-in session; every read is scoped to the family's own children |
| Server owner | `routes/admin.js` | Teachers, usage numbers, consent records; admin secret |
| Pages | `public/` | The family app (`index.html`, no framework, works on any phone), homepage, legal pages, brochure |
| Background | `services/` | Weekly digest email, AI Study Helper, calendar feed, demo account, backups |

Security basics: bcrypt passwords, signed session cookies, rate limits on sign-in and
invite codes, request size limits before bodies are read, uploads checked by content,
no third-party scripts, and a demo account that can't change anything. The server script
`portal/scripts/harden-server.sh` adds a firewall, blocking of failed sign-ins, automatic
security updates and a sandboxed service user. More in `portal/public/security.html`.

## Quality checks

- `npm test`: unit tests plus integration tests against real SQLite databases, including
  publishing to a real test Portal.
- `portal/npm test`: the Portal's API, end to end over HTTP.
- CI on every push: lint, typecheck, both test suites, a Windows installer build, and a
  dependency security check (plus weekly). Releases build Windows, Mac and Linux.

## Where to start reading

- A screen: `src/renderer/src/pages/<Area>/`.
- What it calls: the matching `window.api.<area>` in `src/shared/api.ts`, then its
  `handle(...)` in `src/main/ipc/register.ts`.
- Grading maths: `src/main/services/grading.ts` (tests in `src/main/services/__tests__`),
  grading scales in `src/shared/gradeScales.ts`.
- Publishing: `src/main/services/portalSyncService.ts` and `portal/routes/sync.js`.
