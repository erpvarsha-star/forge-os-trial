# CODE — VF Website Technical SEO Implementation
**Date:** 03 Sep 2026  
**Agent:** CODE (Claude Code)  
**Task:** #24 — Technical SEO fixes for varshaforgings.com  
**Site CMS:** Wix (not GitHub — Wix MCP tools used throughout)  
**Wix Site ID:** `4a42e2d8-8fd2-43d7-95a8-1c319f041137`

---

## What WORK's Audit Found

**Source documents read:**
- `VF_Website_SEO_Audit_02SEP2026` (Drive ID: `1ErEBc71u46-Dr2U6LrIP0OJWEDDTmEXacYdJmdkqjGE`)
- `Varsha_Forgings_Website_SEO_Technical_Package_03SEP2026` (SPARK's spec — Drive ID: `1Ms__1oWuF7NZfeG29XEEiKKkh2NftfLURk40w_-0Z_A`)

**5 technical gaps identified by WORK:**

| # | Finding | Priority |
|---|---|---|
| 1 | Homepage title generic — "Forging suppliers in India" adds no keyword value | Critical |
| 2 | 27 additional pages on Wix's default auto-generated title pattern | High |
| 3 | og:image missing from all 46 pages | High |
| 4 | Image alt text using Wix stock-art defaults ("Glass Bottle Production", "Snow") | Medium |
| 5 | URL slug typo: `/tool-manufactring` (missing 'u') | Medium |

**Already covered before this task (no work needed):**
- JSON-LD structured data: SPARK had already added 19 custom HEAD embeds — LocalBusiness, FAQPage (23 Q&A), product schemas, page-specific schemas. No duplicates added.
- Google Search Console verification: already present in the site's HEAD.
- Bing Webmaster verification: already present.
- robots.txt and sitemap: Wix manages these automatically for all Wix sites; no manual intervention needed or possible via API.
- Canonical links: Wix handles these automatically per page.

---

## What Was Fixed — LIVE on varshaforgings.com

**Method:** Wix Promote SEO API — `POST /promote/seo/v1/bulk/item-seo-tags/set`  
**Result:** 28/28 successes, 0 failures, all changes published live (`publish: true`)

### Pages Updated

All 28 pages received new keyword-rich titles, replacing either generic DEFAULT_PATTERN auto-titles or weak existing overrides. Where a page had no existing meta description, one was added. Existing description overrides were preserved.

| Page | Old Title (abbreviated) | New Title |
|---|---|---|
| Homepage (`plew4`) | Varsha Forgings Pvt. Ltd. \| Forging suppliers in India | **Varsha Forgings \| Precision Closed-Die Forgings Manufacturer India** |
| Forging (`a3evt`) | (default pattern) | Closed-Die Forging Process \| Varsha Forgings \| Carbon & Alloy Steel India |
| Tool Manufacturing (`akw9j`) | (default pattern) | Tool & Die Manufacturing \| Varsha Forgings \| In-House Forging Dies India |
| Our Customers (`g5gt9`) | Customer's (apostrophe error) | Our Customers \| Varsha Forgings \| OEM & Tier-1 Partners |
| Railway | (default pattern) | Railway Forgings Supplier \| Varsha Forgings \| Axles, Bolsters & Brackets India |
| Agriculture | (default pattern) | Agriculture Forgings \| Varsha Forgings \| Tractor & Farm Equipment Parts India |
| EV / Electric Vehicles | (default pattern) | Electric Vehicle Forgings \| Varsha Forgings \| EV Powertrain Parts Manufacturer |
| Machining | (default pattern) | Precision CNC Machining \| Varsha Forgings \| Machined Forged Parts India |
| Heat Treatment | (default pattern) | Heat Treatment Services \| Varsha Forgings \| In-House Hardening & Tempering |
| Quality | (default pattern) | Quality Assurance \| Varsha Forgings \| IATF 16949 Certified Forging Manufacturer |
| Assembly | (default pattern) | Sub-Assembly & Assembly \| Varsha Forgings \| Forged Component Assembly India |
| Certifications | (default pattern) | Certifications \| Varsha Forgings \| IATF 16949, ISO 9001 & NABL Accredited |
| Design & Engineering | (default pattern) | Design & Engineering \| Varsha Forgings \| In-House Forging Design Support India |
| History / About | (default pattern) | About Varsha Forgings \| 25+ Years Manufacturing Excellence Aurangabad |
| + 14 more pages | (default patterns) | Keyword-rich titles per SPARK's Technical Package spec |

**Homepage description set to:**  
*"Varsha Forgings is an Indian manufacturing partner for closed-die forgings, precision machining and assembly. From design and tooling to traceable delivery, we support automotive, agriculture, railway, EV and industrial OEMs."*

**Key fix — apostrophe error on Customers page:** Previous title `Customer's` (possessive apostrophe renders as `%27` in URLs and SERPs, and signals poor content quality to crawlers). Fixed to `Our Customers`.

---

## What Remains Blocked

These items cannot be fixed via the Wix SEO Tags API and require either Yash's action or are WORK's content domain:

| Item | Blocker | Owner |
|---|---|---|
| **og:image on all 46 pages** | Need the actual Wix CDN URL for the hero/OG image (e.g. `https://static.wixstatic.com/media/...`). Without the exact URL the API call cannot set a valid image. | **Yash** — open Wix Editor, right-click any hero image, copy image URL, share in chat |
| **Image alt text** ("Glass Bottle Production", "Snow") | Requires Wix Editor — click the image, edit Alt Text field. These are stock-art Wix defaults from image replacements. Purely content editing, no API access to image alt attributes. | **WORK** (content domain) or Yash in Wix Editor |
| **URL slug typo `/tool-manufactring`** | Requires Wix Editor — Pages & Menu → right-click Tool Manufacturing page → Page Info → change slug to `/tool-manufacturing`. Cannot change slugs via SEO Tags API. | **Yash** in Wix Editor (2-minute fix) |
| **Navigation typo "Industrial Applicatin"** | Wix Editor content editing. | **WORK** (content domain) |
| **Body copy / heading improvements** | Per WORK's audit recommendations. CODE does not touch body copy — WORK's domain. | **WORK** |

---

## What Needs Yash

1. **og:image URL** — share the Wix CDN URL for the main hero image. One URL, one API call, all 46 pages fixed.
2. **URL slug typo** — 2-minute Wix Editor fix: Pages & Menu → Tool Manufacturing → Page Info → slug: `tool-manufacturing`.
3. **No SQL patches, no secrets, no APK rebuild needed** — all changes are live on the Wix site already.

---

## No GitHub Branch / PR

The VF website is on Wix, not GitHub. Per the task instructions ("If the site is on Wix, use the Wix MCP tools instead of cloning a repo"), all changes were made directly via the Wix Promote SEO API. There is no branch or PR — changes are live on `varshaforgings.com` already.

---

## Technical Notes

- The Wix bulk SEO tag API requires reading existing override tags before writing — otherwise a title update silently wipes any existing description override. All 28 updates preserved existing override tags.
- `TAG_SOURCE_HOST_PAGE` = explicit override set; `TAG_SOURCE_DEFAULT_PATTERN` = Wix auto-generated (nothing set). The 18 remaining pages (not in the 28 updated) already had reasonable HOST_PAGE overrides that didn't need changes.
- SPARK's 19 JSON-LD HEAD embeds cover: LocalBusiness (site-wide), full product catalogue, FAQPage (23 Q&A), Aurangabad location, and 15 page-specific schemas. No additional structured data was added to avoid duplication.
