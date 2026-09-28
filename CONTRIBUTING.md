# Contributing to EduBoard

Thank you for helping. Bug reports, ideas and translations are welcome from anyone;
code needs one extra step, explained below.

## Reporting a problem or an idea

Open an [issue](https://github.com/purysho/EduBoard/issues). For a problem, say what you
did, what you expected and what happened, and include the error code and reference if
EduBoard showed one (for example `EB-1003` or `EB-0900 ref 7KQ2MX`). Settings → Help and
updates → Copy error report gives a report that contains no student data.

Security problems go privately to privacy@edu-board.com instead (see
[SECURITY.md](SECURITY.md)).

## Contributing code, text or translations

EduBoard is licensed under the GNU AGPL v3.0, and its author also offers it under other
terms to organisations that need them (dual licensing). To keep that possible, every
contribution has to come with the right to do so. Before your first pull request is
merged, please read the [Contributor Licence Agreement](docs/CLA.md) and add this line to
the pull request:

> I have read the EduBoard Contributor Licence Agreement and agree to it for this and my
> future contributions.

You keep the copyright in your work; the agreement only gives the project permission to
use it under the AGPL and under other licences.

## Working on the code

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the parts fit together. Before
opening a pull request, run what CI runs:

```
npm ci && (cd portal && npm ci)
npm run lint
npm run typecheck
npm test
(cd portal && npm test)
```

A few house rules:

- **Student data stays on the teacher's computer** unless the teacher publishes it. Don't
  add anything that sends data anywhere else.
- **AI only suggests.** Nothing an AI writes is saved or sent without the teacher seeing
  it first, and AI features say they need the internet.
- **Every screen in English and Chinese.** New text goes through `tr('…')` with a Chinese
  entry in `src/shared/i18n/zh/`; the Portal's through `t('…')` with an entry in
  `portal/public/i18n.js`.
- **Errors carry a code** from `src/shared/errorCodes.ts` or `portal/errorCodes.js`.
- **Plain words.** Teachers and families read every message; say what happened and what
  to do next.
