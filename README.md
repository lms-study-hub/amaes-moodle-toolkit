# AMAES & ACLC Moodle Autonomous Toolkit

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)](https://github.com/lms-study-hub/amaes-moodle-toolkit/releases/tag/v1.2.1)
[![Install Userscript](https://img.shields.io/badge/Install-Userscript-emerald.svg)](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Violentmonkey%20%7C%20Tampermonkey-darkblue.svg)](INSTALL.md)

> **Version 1.2.1** • Modular, privacy-preserving study companion and automation toolkit for AMAES / ACLC Moodle (`semestral.amaes.com`).

---

## 🚀 One-Click Install & Update

> 📖 **Need step-by-step help?** Check the dedicated **[Installation & Browser Setup Guide (INSTALL.md)](INSTALL.md)**.

### New Users
1. **Install a Userscript Extension**:
   - **[Violentmonkey (Recommended)](https://violentmonkey.github.io/)** — Fast, lightweight, open-source. Available for [Chrome/Brave](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/), and [Edge](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjfgddacbcigncyclcoaebeent).
   - *(Alternative: [Tampermonkey](https://www.tampermonkey.net/))*.

2. ⚠️ **CRUCIAL STEP: Enable "Developer Mode" (Chrome, Brave, Edge, Opera)**:
   > Chromium Manifest V3 blocks userscripts unless Developer Mode is enabled!
   > - Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
   > - Toggle **"Developer mode"** in the top-right corner to **ON**.

3. **[👉 Click Here to Install `amaes-moodle-toolkit.user.js`](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)**:
   - Violentmonkey will open a tab with the script details. Click **"Confirm installation"**.

4. Visit **[AMAES Moodle Portal](https://semestral.amaes.com/)**. The toolkit panel will automatically dock in the bottom-right corner!

### Automatic Updates
The toolkit features built-in update mechanisms:
- **Tampermonkey / Violentmonkey Native Sync**: The userscript defines standard `@updateURL` and `@downloadURL` headers pointing directly to the official GitHub repository `main` branch. Extensions will auto-update the script in the background.
- **In-App Real-Time Notification**: Whenever a new version is tagged or published on GitHub, an update banner (`New vX.Y.Z released!`) automatically slides into the panel header with a 1-click **Update Now** button.
- **On-Demand Check**: Click the version badge (`v1.2.1`) in the panel header or inside the **Quick Start Guide** modal (`?`) to immediately check GitHub for updates, or click **Update Script** to open the raw direct installer.

---

## Overview

The **AMAES & ACLC Moodle Toolkit** is an advanced paired userscript designed for AMA Education System and ACLC College students. It streamlines online coursework by combining a non-destructive quiz co-pilot, automated verified answer matching, activity progress tracking, and seamless community answer synchronization.

### Clean & Professional Design
- **Custom SVG Iconography**: All generic unicode emojis have been replaced with a unified Lucide-style vector icon set (`ICONS`). No low-quality AI aesthetic—designed to be easy on the eyes during late-night study sessions.
- **Official Branding**: Features the official **ACLC logo** alongside AMAES in both the floating top app bar and the welcome guide.
- **Adaptive Dark & Light Modes**: Seamlessly switches between high-contrast dark theme and clean light theme with persistent preference storage.
- **Rich Interactive Tooltips**: Every button, switch, and field features an explanatory hover tooltip.

---

## Intelligent Multi-Course & Retake Engine

### Multi-Course Retention in LocalStorage
When you navigate between multiple subjects (e.g. `CS6301`, `ITE6200`, `HUM6100`), each course's database remains strictly segregated and preserved under its unique key in your browser's local storage. Switching subjects or taking quizzes in parallel will never overwrite or purge previous course answers.

### Cross-Attempt Elimination & Deduction Engine
In quizzes with multiple attempts or shared pools where Moodle does not display the correct answer upon failure, every attempt now builds **negative knowledge**:
1. **Wrong Answer Tracking**: Any choice selected that received 0.00 marks or was flagged incorrect by Moodle is permanently logged as eliminated.
2. **Visual Strikethrough & Probability Indicator**:
   - Eliminated choices are crossed out in red dashed boxes with `[Eliminated (Wrong)]` tags (or weighted like `2x Wrong` if repeatedly eliminated).
   - Remaining viable choices display estimated probabilities (e.g. `~50% chance` when 2 of 4 options are eliminated).
3. **Auto-Pick Immunity**: The Co-Pilot and Auto-Quiz solvers are strictly prohibited from picking any eliminated choice.
4. **Automatic Logical Deduction**: In a 4-choice question, when 3 choices are confirmed incorrect across retakes or community data, the 4th choice is **100% mathematically deduced** as correct. The script highlights it in green, auto-picks it, and immediately upgrades it to a permanent verified answer.
5. **AI Prompt Filtering**: When using "Copy for AI", eliminated wrong choices are automatically tagged with `[CONFIRMED WRONG CHOICES - DO NOT SELECT]` so ChatGPT/Gemini does not repeat previous errors.

---

## Safe by Default Architecture

To prevent accidental submissions or overwhelming new users, **all aggressive automation is turned OFF by default**, while convenient assistive tools are enabled out of the box:

| Feature | Default Setting | Description |
| :--- | :---: | :--- |
| **Master Auto-Quiz** | **PAUSED (Off)** | Will never automatically start clicking without your explicit command. |
| **Solver Personality** | **Co-Pilot** | Auto-picks known answers. Pauses safely when an unknown question appears. |
| **Auto-Highlight** | **Enabled (On)** | Non-destructive visual badges on quiz choices. |
| **Auto-Copy for AI** | **Enabled (On)** | Copies unknown question + choices cleanly to clipboard for Gemini/ChatGPT. |
| **Keyboard Shortcuts** | **Enabled (On)** | Fast keybindings for hands-free quiz navigation (`1-4`, `N`, `Space`, `C`, `P`, `H`). |
| **Cloud Database Sync** | **Enabled (On)** | Seamlessly checks and syncs verified answers from community repository on load. |
| **Community Auto-Share** | **Enabled (On)** | Automatically & anonymously shares 100% verified teacher answers to the world. |
| **Auto-Harvest Past Quizzes** | **Enabled (On)** | Scans Grade Report to auto-harvest completed past quizzes in the background. |
| **In-Question AI Buttons** | **Enabled (On)** | Convenient inline buttons above questions to copy questions or images. |
| **Strict AI Direct Prompt**| **Enabled (On)** | Enforces strict, direct option letter answers from LLM assistants. |
| **Auto-Next Page** | **Disabled (Off)** | Will never jump pages automatically unless explicitly enabled. |
| **Auto-Submit Quiz** | **Disabled (Off)** | Prevents accidental final exam/quiz submission. |
| **Auto-Download JSON** | **Disabled (Off)** | Prevents file clutter on quiz review pages. |

> **Tip:** You can reset all settings back to these safe defaults at any time by clicking the **Reset (`rotate-ccw`)** icon in the panel header or inside the Welcome modal.

---

## Categorized 3-Tab Architecture

Instead of an overwhelming vertical list of buttons, the toolkit is organized into 3 clear personas:

### 1. `Quiz Solver` (Companion & Co-Pilot)
- **Master Start/Pause Button**: One-click toggle for hands-free solving.
- **Personality Mode**:
  - **Co-Pilot**: Highlights and selects confirmed answers. If a question is not in the database, it safely pauses, copies the question for AI, and waits for you.
  - **Speedrun**: Auto-picks known answers and skips unknown questions immediately.
- **Toggleable Keyboard Shortcuts**:
  | Key | Action |
  | :---: | :--- |
  | `N` / `Space` / `Enter` | Trigger **Next page** navigation button |
  | `1` – `4` or `A` – `D` | Select choice option (Option A, B, C, D) |
  | `C` | Copy current question & choices for AI |
  | `P` | Pause or Resume Auto-Quiz solver |
  | `H` | Highlight answers from database |
  *(Note: Keybindings automatically deactivate when focused on input or textarea fields to prevent interference.)*
- **💡 Pro Tips & Tricks (Hands-Free Speedrun)**:
  - **Skip the Mouse on Navigation**: Instead of scrolling to the bottom to click "Next page", just tap **`N`** or **`Space`** to advance instantly.
  - **Instant Choice Selection**: Instead of clicking small radio buttons, press **`1`**, **`2`**, **`3`**, **`4`** (or **`A`**, **`B`**, **`C`**, **`D`**) to pick your choice.
  - **AI Shortcut Loop**: Press **`C`** to copy the question for ChatGPT / Claude / Gemini, then press **`V`** to auto-select the AI's answer from your clipboard!
- **Smart AI Context Prompting**:
  - The **first question** copied in a quiz attempt automatically injects rich course context (Subject Code, Course Title, and Activity Name) and a strict direct-answer instruction for the AI.
  - Subsequent questions in the same quiz session copy only clean question text and choices to keep your AI chat streamlined without repetitive headers.
- **Quick Action Bar**: Quick highlight, copy current question, copy all questions.
- **In-Question AI Buttons**: Injected buttons beside each question to copy questions or choice images with zero UI clipping.

### 2. `Answer DB` (Verified Community Hub)
- **Share Database to Community Hub**: 1-click contribution modal allowing students to share collected answers directly to GitHub without needing any token or account.
- **Automated Anti-Sabotage Engine**: Submissions are automatically parsed and merged by GitHub Actions CI with consensus locks and schema validation. Verified teacher answers cannot be overwritten by low scores or malicious inputs.
- **Auto-Find AMAUOED Link**: 1-click automatic discovery of the official `amauoed.com` study guide link matching the current subject code, with automatic scraping and caching into the local database.
- **Cloud Database Sync**: 1-click sync with the free community repository (`lms-study-hub/database`).
- **AMAUOED Scraper**: Extract study guide questions directly from `amauoed.com` course URLs.
- **Classmate Sharing & Cross-Referencing**: Multi-file JSON import/export with consensus conflict resolution.
- **Direct GitHub Push**: Anonymously publish verified answer sets directly to the community database.

### 3. `Course Tools` (Dashboard & Course Automation)
- **Batch Activity Auto-Marker**: Mark lectures, readings, and videos as completed in bulk.
- **Activity Highlighter**: Visually color-code Quizzes (pink), Lectures (blue), and Videos (purple).
- **Search Helper**: 1-click query generator and Google Search launcher tailored to the active subject code.

### 4. `Live Execution Monitor` (Doing • Plan • Done)
- **Doing (Current Action)**: Real-time pulsing status display showing what the script is actively executing right now.
- **Plan to Do (Next Step)**: Anticipatory indicator showing the immediate next scheduled or expected action.
- **Done (Activity History Feed)**: Expandable, timestamped chronological log recording every action performed with one-click clear.

---

## Answer Sources: DB vs. AMAUOED

The toolkit cleanly differentiates answer confidence so you always know where an answer originated:

- **Verified DB** (`#10b981` Emerald Green):
  - 100% verified from Moodle teacher review feedback, deduction, or the GitHub community repository.
  - Displayed with a green outline and a clean `[Verified DB]` badge.
- **AMAUOED** (`#0284c7` Sky Blue):
  - Web-scraped study guide from `amauoed.com`.
  - Displayed with a sky blue outline and an `[AMAUOED]` badge.
  - Useful as an intelligent fallback when official server review keys are not yet harvested.
- **Eliminated Wrong** (`#f43f5e` Rose Red):
  - Confirmed wrong options harvested from 0-mark questions or Moodle incorrect tags.
  - Displayed with red dashed borders, strikethrough, and a `[❌ Eliminated (Wrong)]` badge.

---

## Home Dashboard Badges

When browsing the Moodle Home or My Courses page (`courses.php`):
- The toolkit scans course cards and detects subject codes (e.g. `CS6301`, `ITE6301`).
- Directly adds an answer indicator pill:
  - **`${count} DB Answers`**: Shows how many verified answers exist locally.
  - **`Check Cloud DB`**: Lets you 1-click query the community repository for answers.
- Fully compatible with dynamic Moodle 4.x pagination via DOM Mutation Observers.

---

## Scoring Under 100% & Safe Contribution

Students often ask: *"What if I scored 60% or 80%? Will my attempt corrupt the database?"*

**It is 100% impossible to poison the database:**
1. **Missed Questions**: When a question is marked incorrect, Moodle displays the official teacher feedback: `"The correct answer is: [official text]"`. The harvester extracts this official teacher response directly.
2. **Wrong Answers Logged**: Even if Moodle hides the correct answer, the incorrect option picked is saved to your wrong-answers cache, eliminating it from future attempts.
3. **Correct Questions**: Moodle confirms full marks (`1.00 / 1.00`), verifying the student's answer.
4. **Negative Knowledge Preservation**: Low-score attempts now actively contribute to the elimination engine rather than being wasted.

---

## Repository Structure

```
amaes-moodle-toolkit/
├── README.md                     # Documentation & overview
├── INSTALL.md                    # Detailed browser & extension setup guide
├── LICENSE                       # MIT Open Source License
├── amaes-moodle-toolkit.user.js  # Main userscript (v1.0.7)
└── assets/
    └── aclc_logo_transparent.png # Official ACLC College logo asset
```

---

## Privacy & Security

This script executes 100% client-side inside your browser sandbox. All answers and preferences are stored locally in your browser's `localStorage`. No telemetry, analytics, or personal user data is ever transmitted or collected.
