# The name and the licence: findings (28 September 2026)

A first check, from public web sources, before spending on branding or talking to
investors. It isn't legal advice or a formal clearance search; a trademark agent should
confirm before anything is filed.

## 1. The name "EduBoard" is taken, including in China

| Where | Who | What | Why it matters |
| --- | --- | --- | --- |
| **China** | 厦门边锋电子科技有限公司 (renamed 厦门边锋检测服务有限公司 in June 2025) | **"EDUBOARD" registered in China in 2012, class 9** (per [Baidu Baike](https://baike.baidu.com/item/EduBoard/7450583)); interactive whiteboards with their own teaching software, sold in China and 60+ countries | Class 9 covers computer software, which is what the EduBoard app is. Same market (schools), same country as your first users. **The main blocker.** |
| China | 洲洋伟业 | "EduBoard电子白板助手", teaching software ([Sina download page](http://down1.tech.sina.com.cn/download/down_softpic/1157817600/29354.shtml)) | Another prior user of the name for teacher software in China. |
| South Africa | EduBoard (Pty) Ltd, [eduboard.co.za](https://eduboard.co.za) | Interactive classroom displays and teaching software | Active brand in education, with its own terms of use. |
| Canada | [eduboard.ca](http://eduboard.ca) | "School management software": academic management, online exams, attendance | Closest match in what the product does. |
| India | Social Compass Pvt Ltd | "EDUBOARD" **registered** 2024, classes 16 and 35 ([record](https://www.indiafilings.com/search/eduboard-tm-6292137)) | Different classes, but shows the word is being claimed. |
| Elsewhere | eduboard.com (tutoring), eduboard.group (displays), several small apps | | A crowded name: hard to own in search results. |

**What this means:**

- Registering "EduBoard" in China for software would very likely be refused, because the
  2012 class 9 mark is earlier. Using it commercially there risks a complaint from the
  owner.
- Chinese law lets anyone ask for a mark to be cancelled if it hasn't been used for three
  years in a row (撤三). The owner renamed itself a testing company in 2025, so the mark
  may no longer be in use. But that's slow, uncertain, and needs a Chinese trademark
  agent. It isn't something to build a company on.
- Investors and schools will search the name and find whiteboards.

**Recommendation: rename before spending on branding, printing or a company name.**
Choose a name that is:

- free as a word mark in classes 9, 41 and 42 in China (CNIPA), Hong Kong, and your other
  target markets;
- matched by a Chinese name, registered too (a Chinese mark is filed separately);
- available as a .com (or .cn) domain, and free in the WeChat and app store names.

Where to check (all free):
[CNIPA 商标局](https://sbj.cnipa.gov.cn/) (商标查询),
[WIPO Global Brand Database](https://branddb.wipo.int),
[USPTO](https://www.uspto.gov/trademarks/search),
[EUIPO eSearch](https://euipo.europa.eu/eSearch/),
[Hong Kong IPD](https://esearch.ipd.gov.hk).
Then pay a Chinese trademark agent for a proper search and filing; typically a few hundred
to a couple of thousand RMB per class (check current fees).

Renaming the software itself is straightforward: the name lives in a few dozen strings,
the installer and app IDs, the domain and the README. Existing installs can be carried
over by an update.

## 2. The licence: MIT now; consider AGPL for the Portal

**Today:** the whole repository is MIT. Anyone, a competitor included, may take the code,
run the Portal as a paid hosted service and keep their changes private.

**Who can change it:** only the copyright holders. The history has two authors: purysho,
and commits made with an AI coding assistant (Claude) on purysho's behalf. There are no
outside contributors, so the decision is yours alone. (Whether AI-assisted code is fully
protected by copyright varies between countries. Mention it to a lawyer before a funding
round; investors sometimes ask.)

**What can't change:** versions already published under MIT stay MIT forever. Anyone can
keep using and forking them. A new licence applies from the next version on.

**Dependencies:** all permissive (MIT, ISC, BSD, Apache-2.0), plus two LGPL-3.0 libraries
in the Portal. Every one of them is compatible with MIT and with AGPL.

**Options:**

| | MIT (now) | AGPL-3.0 for the Portal, MIT for the app | Source-available (e.g. BSL, Elastic) |
| --- | --- | --- | --- |
| A competitor hosts your Portal as a paid service | Allowed, and they can keep changes private | Allowed only if they publish all their changes under AGPL | Not allowed |
| Schools run their own Portal | Yes | Yes | Yes |
| Counts as "open source" | Yes | Yes | No |
| Common in edtech and SaaS | Yes | Yes (Plausible, Cal.com, Grafana, Nextcloud) | Some (Sentry, HashiCorp) |

**Recommendation: AGPL-3.0 for `portal/`, keep MIT for the desktop app**, before the Portal
is marketed. It keeps the "open, schools can self-host" story that builds trust, while
making it unattractive for a competitor to resell your hosted Portal. Because you own all
the code, you can still offer a separate commercial licence later (dual licensing) if a
partner needs one.

To do it: a `portal/LICENSE` with the AGPL-3.0 text, `"license": "AGPL-3.0-only"` in
`portal/package.json`, a line in the README, and a short "Source" link on the Portal's
pages (AGPL asks that users of a network service can get its source).
