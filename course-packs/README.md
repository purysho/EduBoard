# Course Packs

Put your own Course Packs (`*.coursepack.json`) and their notes in this folder. They stay on
your computer: everything here except this README is ignored by git and left out of the
installers, because a pack describes a real course at a real institution.

Import a pack from **Settings → Data and security → Course Pack** and map each of its terms to
one of your classes. The format is defined in `src/shared/coursePack.ts`.

When packs are here, `npm test` also checks that each one parses and installs cleanly (twice,
without duplicating anything); without them, that check is skipped.


## Private Course Bundles

A `.coursebundle` is a ZIP-based private delivery format for a Course Pack plus local
resource files. It is useful when a course has audio, PDFs or other files that should
travel with the curriculum without being committed to this public repository.

A bundle source folder contains:

```text
manifest.json
course.coursepack.json
resources/
  intro.mp3
  worksheet.pdf
```

`manifest.json` is intentionally small:

```json
{
  "kind": "eduboard-course-bundle",
  "version": 1,
  "coursePack": "course.coursepack.json",
  "resources": {
    "intro-audio": "resources/intro.mp3",
    "week-1-sheet": "resources/worksheet.pdf"
  }
}
```

Every key under `resources` must name a `type: "file"` resource in the Course Pack.
Build the portable file with:

```bash
npm run course-bundle -- /path/to/source /path/to/my-course.coursebundle
```

Import it from **Settings → Data and security → Course Pack / Bundle**. EduBoard validates
the bundle, extracts only files named by the manifest into its private data directory,
backs up the database, then installs the Course Pack using those extracted file paths.

Like `*.coursepack.json`, `*.coursebundle` is ignored by git. Never put real course
bundles in this public repository.
