# EduBoard: competitor research, integrations plan and VC roadmap

Written September 2026. Sources are linked where a figure is quoted; anything marked
_(check)_ is a working assumption to confirm before it goes in front of an investor.

## 1. What EduBoard is, in one paragraph

A bilingual (English / 简体中文) teacher's desktop app that works fully offline and keeps
every student's data on the teacher's own computer, encrypted: gradebook, attendance,
lesson plans, report cards, parent letters, classroom tools and exit tickets over the
classroom Wi-Fi. An optional Portal (a small self-hosted website) gives students and
families logins, homework hand-in, a Class Story and a weekly digest email. AI is used
only to _suggest_ (short report-comment phrases, newsletter wording) and every AI button
says it needs internet; nothing AI-written goes out unchecked.

**What's built (v0.4.0):** 157 commits, ~57 test files / 324 tests, Windows
installer, macOS and Linux builds, auto-update, encrypted database with app lock, Chinese
UI across every screen and printout, school branding packs, custom attendance codes and
school terminology, templates for letters / posts / lesson plans / report cards, weekly
digest with teacher and family versions, AI-assisted newsletter, and Word / PowerPoint /
Excel export.

## 2. HappyClass Smart School System (educationtek.com)

Source: <https://www.educationtek.com/en-US/en-solution/smart-school-system.html>.
HappyClass is a school-wide cloud + IoT platform sold to the school, built around its own
hardware (teacher pad, student pads, IoT router, classroom cloud terminal). EduBoard is
the opposite shape: a teacher's own tool that needs no hardware or server. So the aim is
to take the _teaching ideas_ and leave out the infrastructure.

| HappyClass system                  | What it does                                                                                                                                                              | What EduBoard can take                                                                                                                                                                                                                                                                                    | Effort | Value                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| Homework Guide System              | Teacher records a short video explaining a homework question; students watch when stuck; the system counts views and builds a "frequently missed" problem set per student | **Help clips on homework:** attach a short video or image explanation to each homework question on the Portal; show the teacher how many watched. Pair with **question-level scores** in the gradebook to build a per-class "most missed questions" list (错题本)                                         | M      | High: very familiar to Chinese parents and teachers     |
| Lesson Preview / Flipped Classroom | "Learn first, teach later": assign preview material and a check before the lesson, track each student's progress                                                          | **Preview before the lesson:** attach a resource and a 3-question check to a lesson plan; results appear on the lesson plan and on Today. Reuses the resources library and exit tickets                                                                                                                   | M      | High                                                    |
| Smart Classroom (IoT)              | Projector, whiteboard, VR cameras, lights, AC and tablets on one cloud terminal                                                                                           | Not pursued: hardware and school-wide installs. EduBoard already has presenting mode, the Classroom tab and LAN exit tickets that work on the school's existing projector and Wi-Fi                                                                                                                       | —      | —                                                       |
| Vocabulary Learning System         | Word lists in textbook-unit order; recitation, review and tests assigned as tasks                                                                                         | **Word lists by unit:** a teacher (or school pack) keeps lists per textbook unit; students practise on the Portal with spaced repetition; in class, a quick spelling / meaning check runs over the exit-ticket network with no internet. School packs could carry a publisher's lists _(check licensing)_ | M–L    | High for English-as-a-foreign-language classes in China |
| SPOC (live and on-demand courses)  | The school's own online course platform                                                                                                                                   | Roadmap only: link out to existing video platforms from lesson plans and the Portal. Hosting video is a cost and, in China, a licensing question                                                                                                                                                          | L      | Medium                                                  |

## 3. Other competitors and what we can adapt

Effort: S = days, M = 1–3 weeks, L = a month or more, for one developer.
"Fit" is how well it suits EduBoard's shape: offline-first, teacher-owned data, China-friendly.

### Family communication

| Product                   | Known for                                                                                                                                                                                                                     | Feature to adapt for EduBoard                                                                                                                                          | Fit                 | Effort | Value                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ | ----------------------------- |
| ClassDojo                 | Class points, Class Story, messaging; reported a user in 95% of US preK–8 schools ([EdSurge, 2019](https://www.edsurge.com/news/2019-02-28-now-with-revenue-classdojo-raises-35-million-to-expand-to-homes-across-the-world)) | **Message translation:** a family reads a teacher's message in their own language; the teacher sees both (AI, needs internet, shown as a translation)                  | Good                | S–M    | High in international schools |
| Remind                    | Texting families without sharing a phone number; office hours                                                                                                                                                                 | **Quiet hours** on Portal messages (no notifications to families after a set time)                                                                                     | Good                | S      | Medium                        |
| ParentSquare              | One place for every school message; forms, permission slips, sign-ups                                                                                                                                                         | **Forms and permission slips** on the Portal with a yes/no and a typed signature, and a list of who hasn't answered                                                    | Good                | M      | High                          |
| Bloomz                    | Parent-teacher conference sign-ups, volunteer slots                                                                                                                                                                           | **Conference booking:** the teacher offers time slots, families pick one on the Portal, slots feed the parent-communication log                                        | Good                | M      | High, a pain point every term |
| 晓黑板 (Xiaoheiban)       | Shanghai school notices with read receipts; daily check-ins (打卡)                                                                                                                                                            | **Read receipts** on Class Story and notices ("24 of 30 families have read this") and **daily check-ins** (reading log, exercise, a photo)                             | Very good for China | S / M  | High                          |
| 钉钉 DingTalk 家校本      | Class groups, homework hand-in, notices inside DingTalk                                                                                                                                                                       | **Post to a DingTalk group:** send the newsletter or a notice to a class group through its robot webhook (no company registration needed for a custom robot _(check)_) | Good                | S      | High in China                 |
| 企业微信 WeCom 家校通讯录 | School directory that reaches parents inside ordinary WeChat                                                                                                                                                                  | Same as DingTalk: **post to a WeCom group** by webhook, then later a proper WeCom app (needs a registered organisation)                                                | Good                | S / L  | Very high in China            |

### Classroom and behaviour

| Product              | Known for                                                                                                                                                                                                 | Feature to adapt                                                                                                                                                              | Fit                       | Effort | Value                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------ | ------------------------------------- |
| 班级优化大师 (Seewo) | Classroom points across several dimensions (德智体美劳), parents see their child's record ([App Store](https://apps.apple.com/cn/app/%E7%8F%AD%E7%BA%A7%E4%BC%98%E5%8C%96%E5%A4%A7%E5%B8%88/id989685406)) | **Point categories:** class points get the school's own categories (e.g. 德/智/体/美/劳, or Respect / Effort / Teamwork), with a summary on the report card and in the digest | Very good                 | S      | High in China                         |
| Class Charts (UK)    | Seating plans that show behaviour and needs at a glance; detentions                                                                                                                                       | **Seating chart with points:** tap a seat to give a point; icons for support plans or allergies from custom fields                                                            | Very good                 | S      | Medium–high                           |
| Plickers             | Students hold up printed cards; the teacher's phone camera reads the answers                                                                                                                              | **Paper answer cards:** a whole-class check with no student devices. The camera reading is the hard part; a first version could use the webcam on the classroom PC            | Excellent (fully offline) | L      | High where students don't have phones |
| Kahoot / Quizizz     | Game-style quizzes                                                                                                                                                                                        | A **live quiz mode** for exit tickets (question by question, with a leaderboard on the projector)                                                                             | Good                      | M      | Medium                                |

### Learning, assessment and planning

| Product                      | Known for                                                                                                                                                                                 | Feature to adapt                                                                                                                                                                                                                                              | Fit    | Effort | Value                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------------------------------------- |
| Seesaw                       | Student portfolios (photo, voice, drawing); families see and comment                                                                                                                      | **Portfolio on the Portal:** the teacher picks a student's best handed-in work to show families, with a teacher note                                                                                                                                          | Good   | M      | High                                   |
| Google Classroom             | Assignments, Forms quizzes, Drive files                                                                                                                                                   | **Import from Google Classroom** (rosters and grades via its export files first, no account link)                                                                                                                                                             | Good   | S–M    | Medium                                 |
| Toddle / ManageBac           | IB unit planning, curriculum maps, AI report comments, portfolios ([Toddle](https://www.toddleapp.com/))                                                                                  | **Units above lesson plans** (unit → lessons → assessments) and a **curriculum map** per class and year. Their AI writes whole report comments; ours only suggests phrases, which is a selling point to cautious schools                                      | Good   | M      | High in international schools          |
| PowerSchool / Veracross      | School information systems: enrolment, timetables, state or national reporting, billing                                                                                                   | Not competing head-on. Adapt **standards-based grading** (mastery per standard, using the rubric standards we already have) and a **OneRoster CSV** import and export so schools can move data in and out                                                     | Medium | M      | Medium–high                            |
| 一起作业 (17zuoye) / Quizlet | Vocabulary and listening practice; spaced repetition                                                                                                                                      | Feeds the **word lists** idea in section 2                                                                                                                                                                                                                    | Good   | M–L    | High for English teachers in China     |
| MagicSchool / Brisk          | AI tools for teachers; MagicSchool raised a $45M Series B and Brisk a $15M Series A in 2025 ([New Market Pitch deal list](https://newmarketpitch.com/blogs/news/edtech-funding-analysis)) | Keep AI narrow and checked: phrase suggestions, wording help, translation. Possible next ones: **differentiate a worksheet** (easier / harder version of text the teacher gives) and **mark against a rubric as a suggestion** the teacher accepts or changes | Good   | M each | High (it's what investors are funding) |

### The top ten, in the order we'd build them

1. **Point categories** (德智体美劳 or the school's own), with report-card and digest summaries. S.
2. **Read receipts** on Class Story posts and notices. S.
3. **Post to a DingTalk / WeCom group** by webhook (newsletter, notices). S.
4. **Seating chart with points and needs icons.** S.
5. **Conference booking** on the Portal. M.
6. **Forms and permission slips** on the Portal. M.
7. **Help clips on homework and question-level scores** (the "most missed" list). M.
8. **Preview before the lesson** (flipped classroom). M.
9. **Word lists by unit** with Portal practice and in-class checks. M–L.
10. **Message translation for families** (AI, needs internet). S–M.

Items 1–4 are **built** (September 2026, after 0.4.0), along with the opt-in usage ping from section 5. Items 5–8 make the Portal something a school would pay to have
hosted.

## 4. Connecting to other apps and logins

### Done now (no accounts or fees needed)

- **Word (.docx):** report cards, parent letters, newsletters, lesson plans.
- **PowerPoint (.pptx):** a lesson plan as a starter slide deck in the school colour.
- **Excel (.xlsx):** gradebook, course grade sheet, "export everything", roster import.
- These open in Microsoft Office and in WPS, the office suite most schools in China use.

### Logins for the Portal

The desktop app needs no login, and that doesn't change. Logins are for the Portal, where
students and families sign in today with a username and password, a QR code, or an
invite link.

| Login                                    | What it needs                                                                                                                                                                                                                                                                                                                                                                       | Cost                                                                | Works in mainland China?                                             | Can we build it now?                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Google** (OpenID Connect)              | A Google Cloud project and OAuth client, made by whoever runs the Portal; HTTPS on a fixed domain. Basic sign-in (openid, email, profile) doesn't need Google's full app review                                                                                                                                                                                                     | Free                                                                | No (Google is blocked)                                               | **Yes.** Build one generic OpenID Connect sign-in; the school pastes in its client ID and secret            |
| **Microsoft** (Entra ID / Microsoft 365) | An app registration in the school's Entra tenant                                                                                                                                                                                                                                                                                                                                    | Free                                                                | Mostly _(check; China's Microsoft 365 is a separate 21Vianet cloud)_ | **Yes**, same generic OpenID Connect code. Also gives schools on Microsoft 365 single sign-on straight away |
| **Apple** (Sign in with Apple)           | Apple Developer Program membership, a Services ID, domain verification; handles Apple's private relay email                                                                                                                                                                                                                                                                         | US$99/year                                                          | Yes                                                                  | Code is small; **needs the paid account.** Required only if a future iPhone app offers other social logins  |
| **WeChat** (网站应用 QR login)           | WeChat Open Platform account with developer verification, which needs a business licence; a website app approved by WeChat; the domain must have an **ICP filing**, which needs a mainland entity and a mainland server ([LobeHub](https://lobehub.com/docs/self-hosting/auth/providers/wechat), [AppInChina](https://appinchina.co/blog/the-complete-guide-to-chinas-icp-filing/)) | Verification fee ¥300/year _(check)_ plus company and hosting costs | Yes                                                                  | **No: needs a Chinese company or partner.** Roadmap                                                         |
| **Alipay** (网页应用 login)              | Alipay Open Platform enterprise account, a web app with the member-information capability approved, ICP-filed domain ([Logto docs](https://docs.logto.io/zh-CN/integrations/alipay-web))                                                                                                                                                                                            | Low                                                                 | Yes                                                                  | **No**, same blocker as WeChat. Lower priority than WeChat for families                                     |
| **Phone number + SMS code**              | An SMS provider. In China (Alibaba Cloud, Tencent Cloud) the sender name (签名) and message template must be approved, which needs a company                                                                                                                                                                                                                                        | Fractions of a yuan per SMS _(check)_                               | Yes, with a Chinese provider                                         | Code: yes. Sending in China: **needs a company.** Outside China: Twilio or similar works now                |
| **School SSO (SAML 2.0)**                | Per-school setup with the school's identity provider                                                                                                                                                                                                                                                                                                                                | Free (library)                                                      | Yes                                                                  | Yes, but only worth it with a school customer asking. Belongs in a paid school plan                         |
| **Clever / ClassLink** (US districts)    | Partner application with each                                                                                                                                                                                                                                                                                                                                                       | _(check partner terms)_                                             | n/a                                                                  | Later, only if the US district market is the target                                                         |
| **DingTalk / WeCom app login**           | An app in the DingTalk or WeCom developer console; WeCom third-party apps need a registered service provider                                                                                                                                                                                                                                                                        | Free to low                                                         | Yes                                                                  | DingTalk internal app: probably yes _(check)_. WeCom: needs a company                                       |

**Suggested order:** generic OpenID Connect (Google + Microsoft) → DingTalk / WeCom group
webhooks → Apple (once there's a reason to pay the fee) → China entity or partner → ICP
filing and mainland hosting → WeChat login, then SMS, then Alipay → SAML for paying
schools.

### What running in mainland China needs (for the pitch's "China" slide)

- **A legal entity:** a WFOE, a joint venture, or a licensed local partner who operates the hosted Portal.
- **ICP filing (备案)** for the Portal's domain, served from a mainland server.
- **Education app filing (教育移动互联网应用程序备案)** for apps used by schools and students _(check scope for web portals)_.
- **Data rules:** PIPL (personal information, with extra care for under-14s), data kept in China, and likely MLPS 2.0 (等保) level 2 for a school system _(check)_.
- **Policy:** the 2021 "double reduction" rules restrict for-profit tutoring, not teacher and school tools. Stay clearly on the school side and away from after-school tutoring.

EduBoard's offline, teacher-owned design is an advantage here: the desktop app stores
nothing outside the teacher's computer, so most of this applies only to the hosted Portal.

## 5. The VC case

### Why now

- Investors are funding AI tools that save teachers time. MagicSchool raised a $45M Series B and Brisk a $15M Series A in early 2025; SchoolAI raised a $25M Series A, and in APAC Teacher's Buddy raised seed rounds for AI lesson and report tools ([New Market Pitch deal list](https://newmarketpitch.com/blogs/news/edtech-funding-analysis)).
- Edtech funding overall is low: Q1 2025 was about $410M, down 35% year on year ([EdWeek via OpenVC](https://www.openvc.app/investor-lists/edtech-investors)); Crunchbase says edtech funding "stays low" ([Crunchbase News](https://news.crunchbase.com/venture/edtech-funding-stays-low/)). The bar is traction and a clear wedge, not a feature list.
- Trust in AI and student data is a real concern for schools. "The AI suggests, the teacher decides, the data never leaves your computer" is an easy position to explain.

### The wedge and the business model

- **Wedge:** a free desktop app for one teacher, bottom-up, the way ClassDojo spread. It is useful on day one with no IT department, no account and no internet.
- **Paid, per school:** a hosted Portal (families, homework, digest, conference booking, forms), a school dashboard across teachers, SSO, school packs managed centrally, priority support.
- **Paid, China:** the same hosted Portal run in China with WeChat login, through an entity or a partner.
- **Optional, per teacher:** AI features at cost, or bring your own key (already supported).

### Where it's different

|                          | EduBoard                                                                                | Typical competitor                      |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------- |
| Works with no internet   | Yes, everything but AI and the Portal                                                   | No                                      |
| Where student data lives | The teacher's computer, encrypted; the Portal holds only what the teacher publishes     | Vendor cloud                            |
| Chinese and English      | Full UI, printouts, student pages, digest                                               | Usually one market or the other         |
| AI                       | Suggests phrases and wording; never sends anything unchecked; labelled "needs internet" | Often drafts whole comments or messages |
| Setup                    | Install and go; school pack for house style                                             | Admin setup, rostering, training        |

### What an investor will ask for (collect before pitching)

- **Active teachers per week** and how many are still active after 4 and 12 weeks. EduBoard now has an opt-in, anonymous weekly ping (off by default); the Portal admin page shows these numbers once the live Portal is updated.
- **Schools with 3 or more teachers** using it, a sign of the paid school plan.
- **Portal adoption:** share of teachers who publish, and families who log in.
- **Two or three pilot schools** (ideally one in China, one international school) with a quote each.
- **Time saved:** e.g. report cards before and after, measured with a pilot teacher.

### Roadmap tied to funding

| Stage                  | Money                                                                     | What it pays for                                                                                                                   | Milestone                                                                 |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Now (bootstrapped)     | —                                                                         | Top-four features from section 3; generic OpenID Connect; usage ping (opt-in); code signing; 0.4.0 release                         | 3 pilot schools, first retention numbers                                  |
| Pre-seed / accelerator | ~$100k–$500k _(check current accelerator terms, e.g. YC's standard deal)_ | Hosted Portal for schools; conference booking, forms, read receipts; China partner talks; Apple developer account; security review | 20 schools on a paid pilot, 500 weekly active teachers _(targets to set)_ |
| Seed                   | ~$1.5M–$3M                                                                | Small team; China entity or partner, ICP and mainland hosting; WeChat login and SMS; school dashboard; SAML                        | Paid schools in two markets, a repeatable sales motion                    |
| Series A               | —                                                                         | Word lists, homework help clips, flipped preview; standards-based grading; OneRoster; SOC 2 / ISO 27001; MLPS in China             | —                                                                         |

### Honest risks to address up front

- **Single developer, early stage:** no usage data yet. The first job is the numbers above.
- **Offline-first limits network effects:** the Portal is where the network effect comes from (families, schools), so it needs to be easy to host or hosted for the school.
- **China is a regulatory project, not a feature:** entity, ICP, data rules and education filings take months and need a local partner.
- **Crowded category:** ClassDojo, Seesaw and the Chinese super-apps are free to teachers. EduBoard wins on privacy, offline use and bilingual schools, not on being free.

## 6. Where this lives

- Handoff notes for the next build session: `NEXT_SESSION.md`.
- What's shipped: `CHANGELOG.md` (the `[Unreleased]` section).
- This file: `docs/ROADMAP_VC.md`.
