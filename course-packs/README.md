# Course Packs

Put your own Course Packs (`*.coursepack.json`) and their notes in this folder. They stay on
your computer: everything here except this README is ignored by git and left out of the
installers, because a pack describes a real course at a real institution.

Import a pack from **Settings → Data and security → Course Pack** and map each of its terms to
one of your classes. The format is defined in `src/shared/coursePack.ts`.

When packs are here, `npm test` also checks that each one parses and installs cleanly (twice,
without duplicating anything); without them, that check is skipped.
