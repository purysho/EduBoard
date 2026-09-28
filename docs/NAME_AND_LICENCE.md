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

### Legal review: does the name have to change?

**Short answer: yes, before selling to schools in China, unless you first obtain the
Chinese "EDUBOARD" mark.** Selling to Hong Kong only, or outside China, is lower risk but
still crowded (see above).

What the law says, and how it applies:

| Question | Finding |
| --- | --- |
| Is the Chinese mark still in force? | Registered **28 July 2012**, so the first 10-year term ended in July 2022. Company records cited up to December 2025 (Tianyancha, Qichacha via Baidu Baike) still list "EDUBOARD" among the company's marks, which points to a **renewal to July 2032**. Only the official register confirms this (CNIPA 商标查询, search "EDUBOARD" in class 9; an agent can do it in minutes). |
| Would EduBoard's use infringe? | China's Trademark Law, article 57(1)–(2): using an **identical or similar mark on identical or similar goods** without permission is infringement. The mark is in class 9, which includes recorded computer software, and the owner itself published "eduBoard" teaching software for its whiteboards. EduBoard is teaching software for schools in China, under an identical word. That is the core case the article covers. |
| Does being free, or small, help? | Only in practice: the owner may never notice. Legally, offering the software to schools is use in trade, and a sale certainly is. Damages, a court order to stop, and having to rename after schools have adopted it are the risks. |
| Unfair competition? | The Anti-Unfair Competition Law, article 6, also forbids using another's name that has "a certain influence" in the market in a way that causes confusion. The owner calls eduBoard China's leading interactive-whiteboard brand, so this is a second route for them. |
| Can EduBoard register the name itself? | Not in class 9 (the earlier mark blocks it), and a class 41/42 filing risks rejection or opposition. Without a registration, you can't stop anyone else from using "EduBoard" either. |
| Is the owner still using it? | The company renamed itself a testing company in June 2025, which suggests the whiteboard business has wound down. But old "Eduboard 电子白板" software is still offered on download sites, so non-use would have to be proved. |

**Your options, cheapest first:**

1. **Rename** (recommended). Pick a name that's free in China's classes 9, 41 and 42, in Hong
   Kong, and as a domain, and file it before announcing it. Cost: the filing fees (about
   ¥300 per class officially, ¥500–1,000 per class with an agent) plus a day of renaming
   work in the code. Existing installs can be carried over by an update.
2. **Buy the mark.** The owner has moved to testing services and may sell. An agent
   approaches them, and a transfer is registered at CNIPA (agent fee about ¥900 plus the
   agreed price). This keeps the name and the domain, and gives you the registration.
3. **Cancel it for non-use (撤三).** Possible if it hasn't been used for three years in a
   row. It takes about 9–12 months (agent fee about ¥2,000), the owner can answer with
   evidence of use, and someone else may file for the name as soon as it's cancelled.
   It's only worth trying alongside a filing of your own.

Either way, until one of these is settled: don't print the name, register a company under
it, or file it anywhere. The school branding feature (Settings → Appearance, and a school pack installed for the whole computer; see `SCHOOL_DEPLOYMENT.md`)
lets schools show their own name, but the app, the installer and edu-board.com still say
EduBoard, so it doesn't solve this.

This review uses public sources and isn't legal advice; a Chinese trademark agent or lawyer
should confirm the register entry and the goods it covers before you decide.

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

## 2. The licence: AGPL-3.0 from version 0.6.1

**Decided:** the whole repository (the desktop app and the Portal) is licensed under the
**GNU Affero General Public License v3.0** (`AGPL-3.0-only`) from version 0.6.1. Versions up
to 0.6.0 were MIT and stay available under MIT; that can't be withdrawn.

What AGPL means in practice:

- Schools and teachers can use, change and run EduBoard freely, including running their
  own Portal.
- Anyone who shares a changed version, **or runs a changed Portal for others over a
  network**, must offer their changed source under the same licence. The Portal's login
  page and Account page link to the source, and the app's About panel says so, as the
  licence's section 13 asks.
- A competitor can't take the code into a closed product or a private hosted service.
- Because you hold all the copyright, you can still sell a separate licence on other terms
  (dual licensing), e.g. to a partner who wants to build it into their own closed product.
  Keep it that way: before accepting code from anyone else, ask them to agree (a
  contributor licence agreement) so you can still do this.
- Why not AGPL for the Portal only? One licence is simpler to explain to schools, and the
  app has no competitor-hosting risk that MIT would handle better.

<details><summary>The analysis before the decision</summary>


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

</details>
