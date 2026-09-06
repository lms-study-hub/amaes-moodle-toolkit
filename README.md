# AMAES & ACLC Moodle Autonomous Toolkit

[![Version](https://img.shields.io/badge/version-1.2.5-blue.svg)](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)
[![Install Userscript](https://img.shields.io/badge/Install-Userscript-emerald.svg)](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)
[![Platform](https://img.shields.io/badge/platform-Violentmonkey%20%7C%20Tampermonkey-darkblue.svg)](INSTALL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **A smart, privacy-preserving study companion and assistive toolkit for AMA Education System and ACLC College students on Moodle (`semestral.amaes.com`).**

---

## ⚡ Quick Setup (3 Simple Steps)

> Need detailed browser-specific screenshots? See the **[Installation & Browser Setup Guide (INSTALL.md)](INSTALL.md)**.

### Step 1: Install a Userscript Manager
- **[Violentmonkey (Recommended)](https://violentmonkey.github.io/)** — Fast, lightweight, open source. Available for [Chrome/Brave](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/), and [Edge](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjfgddacbcigncyclcoaebeent).
- *(Alternative: [Tampermonkey](https://www.tampermonkey.net/))*.

### Step 2: Enable Developer Mode *(Chromium Browsers Only)*
> Chromium Manifest V3 requires **Developer Mode** enabled to run userscripts:
1. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
2. Toggle **Developer mode** in the top-right corner to **ON**.

### Step 3: Install the Script
1. **[Click Here to Install `amaes-moodle-toolkit.user.js`](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)**.
2. Violentmonkey will open an installation tab. Click **"Confirm installation"**.
3. Visit **[AMAES Moodle Portal](https://semestral.amaes.com/)**. The toolkit docks neatly in the bottom-right corner!

---

## 🛡️ What It Does vs. What It Does NOT Do

| What It DOES | What It Does NOT Do |
| :--- | :--- |
| ✅ **Highlights verified answers** in clean color-coded badges (Verified DB, Community Cloud, AMAUOED). | ❌ **Never auto-submits quizzes**. You always review your answers and click submit when ready. |
| ✅ **Eliminates wrong choices** across retakes so you never pick confirmed incorrect answers again. | ❌ **Never guesses blindly**. If a question is not in the database, Co-Pilot safely pauses and waits for you. |
| ✅ **Deduces answers mathematically** when 3 wrong choices are confirmed in a 4-choice question. | ❌ **Zero personal data collection**. No student IDs, passwords, names, or grades are ever transmitted. |
| ✅ **1-Click Copy for AI (C)** with option letter formatting and confirmed wrong answer filters. | ❌ **Zero tokens or account logins required**. Works out of the box with pure client-side storage. |
| ✅ **Dynamic semester detection** supporting any term code (`/2612/`, `/2613/`, `/301/`, etc.). | ❌ **Cannot bypass proctored lockdowns or time limits** set by the school server. |
| ✅ **Batch marks completed activities** (lectures, readings, video resources) in 1 click. | ❌ **Cannot poison the community database**; submissions are verified against teacher review keys. |
| ✅ **Scans for missing/unanswered quizzes** directly on Course and Grades pages. | ❌ **No heavy background drain**. Pure lightweight vanilla JavaScript with zero tracking. |

---

## 🧭 The 3-Tab Interface

The toolkit is organized into 3 focused tabs:

```
[ Quiz ]  •  [ DB ]  •  [ Course Tools ]
```

### 1. Quiz Tab *(Autonomous Co-Pilot & Assistive Navigation)*
- **Master Auto-Quiz Toggle**: Start or pause solving at any time (or press `P`).
- **Co-Pilot Safety**: Automatically picks 100% verified answers. When an unknown question appears, it safely pauses, copies the question prompt, and waits for your input.
- **Answer Highlighting**: Non-destructive visual badges on quiz choices (Verified DB, Community Cloud, AMAUOED, Eliminated Wrong).
- **Copy Question (C)**: Formats the active question cleanly for ChatGPT/Gemini, including choices, confirmed wrong choices to avoid, and optional DB answer probability hints.
- **Paste AI (V)**: Quickly selects the AI's proposed answer letter (A, B, C, D) directly from your clipboard.
- **Keyboard Shortcuts**:
  - `1` – `4` or `A` – `D` : Select choice option A through D
  - `N` / `Space` / `Enter` : Advance to next quiz page
  - `C` : Copy current question for AI
  - `V` : Select choice matching clipboard text
  - `P` : Pause / Resume Auto-Quiz solver
  - `H` : Highlight answers on the page
- **Non-Invasive Guidance**: When opened outside a quiz attempt, displays a gentle status notice guiding you to enter any quiz session.
- **Safe Defaults**: Auto-Next is OFF by default (with an explicit confirmation warning if enabled), and Auto-Submit is permanently removed to prevent accidental submissions.

### 2. DB Tab *(Knowledge Hub & 4-Tier Coverage)*
- **Course-Wide Coverage Card**: Instant metrics for your active subject:
  - **Verified DB**: 100% confirmed teacher keys from review feedback.
  - **Community Cloud**: Verified consensus answers from fellow students.
  - **AMAUOED**: Web-scraped study guide questions from `amauoed.com`.
  - **Eliminated Wrong**: Confirmed incorrect choices tracked across attempts.
- **Term Breakdown**: Filter coverage by Prelim, Midterm, Pre-Final, and Final terms.
- **Cloud Database Auto-Sync**: Automatically syncs the latest verified question bank on course load.
- **Auto-Scrape AMAUOED**: Automatically queries and caches course guides for your current subject code.
- **Anonymous Auto-Share on Review**: Whenever you complete a quiz attempt, any verified teacher answers or eliminated choices are automatically and anonymously shared to help fellow students.
- **Grade Report Auto-Harvester**: Automatically scans completed past quiz reviews from your Grades page to seed your local database.
- **Manual JSON Backup & Import**: Export your answers to JSON or import study packs from classmates.

### 3. Course Tools Tab *(Productivity & Course Navigation)*
- **Batch Activity Auto-Marker**: Completes lectures, readings, and video assignments in 1 click.
- **Highlight Missing Quizzes**: Instantly scans your current Course or Grades page, color-coding missing or unattempted quizzes so you never miss a deadline.
- **Course Search Helper**: Generates tailored Google search queries for your active subject code with 1 click.
- **Live Execution Monitor**:
  - **Doing**: Real-time indicator of active background operations.
  - **Plan**: Anticipated next step.
  - **Done Feed**: Timestamped chronological log of all actions.
  - **Copy Log**: 1-click button to export the diagnostic log for easy troubleshooting.

---

## 🎯 4-Tier Answer Intelligence

The toolkit differentiates answers with clear visual cues and confidence levels:

| Tier | Badge | Color | Confidence | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Verified DB** | `Verified • 100% Prob` | Green (`#10b981`) | **100%** | Confirmed teacher feedback from Moodle review screens or verified cloud key. |
| **Community Cloud** | `Community • 95% Prob` | Emerald (`#059669`) | **95%** | Cross-validated consensus answer from student community pool. |
| **AMAUOED** | `AMAUOED • 90% Prob` | Sky Blue (`#0284c7`) | **90%** | Scraped study guide matching question text from `amauoed.com`. |
| **Eliminated Wrong** | `Wrong • 0% Prob` | Red (`#f43f5e`) | **0%** | Confirmed incorrect choice from previous attempts. Strikethrough applied. |

---

## 🔒 Privacy & Safety Guarantee

- **100% Client-Side**: Executes entirely within your browser's userscript sandbox.
- **Local Isolation**: Every subject code (e.g. `CS6301`, `ITE6200`) has an isolated local storage partition. Switching subjects never overwrites or mingles question banks.
- **Zero Telemetry**: No tracking pixels, cookies, or remote user analytics.
- **Anti-Poisoning Protection**: Community sync enforces strict schema checks, consensus locking, and review-grade validation to prevent invalid entries.

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
