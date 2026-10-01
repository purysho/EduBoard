# EduBoard Handoff

## Current state

EduBoard **v0.7.8 — Lean Core** is complete, released, measured, documented, and closed.

The published v0.7.8 release has the full expected 19-asset set. The Lean Core pass reduced package size without removing classroom functionality:

- Windows Setup: **-9.38%**
- Windows Portable: **-9.40%**
- Linux AppImage: **-5.84%**
- macOS arm64 DMG: **-10.72%**
- macOS x64 DMG: **-10.39%**

The Windows post-release validation regression was fixed in PR #50 by replacing the shared-runner public updater/API probe with deterministic authenticated `gh release download` verification plus byte-size and SHA-256 comparison.

There is no known red deterministic EduBoard workflow at this handoff point. A GitHub "Code scanning AI findings" run failed because its configured analysis model was unsupported; this was an external GitHub/Copilot agent failure, not an EduBoard code or CodeQL failure.

## Start here

The authoritative next-step plan is:

**[Next_Steps_ChatGPT.MD](./Next_Steps_ChatGPT.MD)**

Use that document as the starting brief for the next development loop.

Supporting context:

- **[Project_Review.MD](./Project_Review.MD)** — full implementation/release review, measurements, CI findings, and Lean Core closeout.
- **[Changes_Made.MD](./Changes_Made.MD)** — concise record of what changed in v0.7.8.
- **[README.md](./README.md)** — current product overview and usage.

## Next loop priorities

Do **not** reopen the already-validated Lean Core locale/dependency-placement cuts unless new evidence requires it.

Start from the published v0.7.8 measurements and prioritize:

1. **Offline student progress return**
   - Study Pack records student-local completion.
   - Student exports a tiny progress file.
   - Teacher imports it without requiring accounts or a server.

2. **Reusable teacher templates**
   - lesson
   - worksheet
   - quiz
   - rubric
   - feedback/comment bank
   - homework

3. **School Pack refinement**
   - make school-wide policy/default configuration easier to install and audit;
   - avoid duplicating classroom or teacher data.

4. **Bulk workflow improvements**
   - duplicate work across classes;
   - bulk archive;
   - bulk feedback/roster operations where existing APIs already support them.

5. **Measured package pruning**
   - inspect `app.asar.unpacked/node_modules` separately on each target platform;
   - remove only files that provably cannot load on that OS/architecture;
   - change one native package at a time;
   - require Windows, Linux, Apple Silicon Mac, and native Intel Mac smoke/validation before accepting a pruning change;
   - reject complexity when the measured saving is trivial.

## Feature-admission rule

Prefer additions that satisfy at least **4 of these 6**:

- repeatedly useful;
- meaningfully saves teacher/student time;
- works offline or degrades gracefully offline;
- reuses existing EduBoard data;
- adds no large runtime dependency;
- has broad teaching value.

The goal is to improve teacher, school, and optional student workflows **without turning EduBoard into a bloated all-in-one platform**.

## Handoff instruction for a new chat/agent

> Continue EduBoard from the post-v0.7.8 Lean Core baseline. Read `HANDOFF.md`, then `Next_Steps_ChatGPT.MD`, then the v0.7.8 section of `Project_Review.MD` before making changes. Treat v0.7.8 as the measured size/reliability baseline. Do not redo already-closed Lean Core work. Work in small, verifiable loops: plan → implement narrowly → test → inspect actual measurements → document → merge only when deterministic gates are green.
