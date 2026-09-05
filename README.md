# AMAES & ACLC Moodle Autonomous Toolkit

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/lms-study-hub/amaes-moodle-toolkit/releases/tag/v1.0.2)
[![Install Userscript](https://img.shields.io/badge/Install-Userscript-emerald.svg)](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-darkblue.svg)](https://www.tampermonkey.net/)

> **Version 1.0.2** • Modular, privacy-preserving study companion and automation toolkit for AMAES / ACLC Moodle (`semestral.amaes.com`).

---

## 🚀 One-Click Install & Update

### New Users
1. Install a userscript extension like **[Tampermonkey](https://www.tampermonkey.net/)** or **[Violentmonkey](https://violentmonkey.github.io/)** in your browser (Chrome, Edge, Firefox, Brave).
2. **[👉 Click Here to Install `amaes-moodle-toolkit.user.js`](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)**
3. Tampermonkey will open with the script details. Click **Install**.
4. Visit **[AMAES Moodle Portal](https://semestral.amaes.com/)**. The toolkit panel will automatically dock in the bottom-right corner!

### Automatic Updates
The toolkit features built-in update mechanisms:
- **Tampermonkey Native Sync**: The userscript defines standard `@updateURL` and `@downloadURL` headers pointing directly to the official GitHub repository `main` branch. Tampermonkey will auto-update the script in the background.
- **In-App Real-Time Notification**: Whenever a new version is tagged or published on GitHub, an update banner (`New vX.Y.Z released!`) automatically slides into the panel header with a 1-click **Update Now** button.
- **On-Demand Check**: Click the version badge (`v1.0.2`) in the panel header or inside the **Quick Start Guide** modal to immediately check GitHub for updates.

---

## Overview

The **AMAES & ACLC Moodle Toolkit** is an advanced paired userscript designed for AMA Education System and ACLC College students. It streamlines online coursework by combining a non-destructive quiz co-pilot, automated verified answer matching, activity progress tracking, and seamless community answer synchronization.

### Clean & Professional Design
- **Custom SVG Iconography**: All generic unicode emojis have been replaced with a unified Lucide-style vector icon set (`ICONS`). No low-quality AI aesthetic—designed to be easy on the eyes during late-night study sessions.
- **Official Branding**: Features the official **ACLC logo** alongside AMAES in both the floating top app bar and the welcome guide.
- **Adaptive Dark & Light Modes**: Seamlessly switches between high-contrast dark theme and clean light theme with persistent preference storage.
- **Rich Interactive Tooltips**: Every button, switch, and field features an explanatory hover tooltip.

---

## Safe by Default Architecture

To prevent accidental submissions or overwhelming new users, **all aggressive automation is turned OFF by default**:

| Feature | Default Setting | Description |
| :--- | :---: | :--- |
| **Master Auto-Quiz** | **PAUSED (Off)** | Will never automatically start clicking without your explicit command. |
| **Solver Personality** | **Co-Pilot** | Auto-picks known answers. Pauses safely when an unknown question appears. |
| **Auto-Highlight** | **Enabled (On)** | Non-destructive visual badges on quiz choices. |
| **Auto-Copy for AI** | **Enabled (On)** | Copies unknown question + choices cleanly to clipboard for Gemini/ChatGPT. |
| **Keyboard Navigation** | **Enabled (On)** | Fast keybindings for hands-free quiz navigation. |
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
  - 100% verified from Moodle teacher review feedback or the GitHub community repository.
  - Displayed with a green outline and a clean `[Verified DB]` badge.
- **AMAUOED** (`#0284c7` Sky Blue):
  - Web-scraped study guide from `amauoed.com`.
  - Displayed with a sky blue outline and an `[AMAUOED]` badge.
  - Useful as an intelligent fallback when official server review keys are not yet harvested.

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
2. **Correct Questions**: Moodle confirms full marks (`1.00 / 1.00`), verifying the student's answer.
3. **Hidden / Ambiguous Questions**: If Moodle hides the correct answer and the question was missed, the harvester strictly skips it.

---

## Repository Structure

```
amaes-moodle-toolkit/
├── README.md                     # Documentation, guide & install links
├── LICENSE                       # MIT Open Source License
├── amaes-moodle-toolkit.user.js  # Main userscript (v1.0.0)
└── assets/
    └── aclc_logo_transparent.png # Official ACLC College logo asset
```

---

## Privacy & Security

This script executes 100% client-side inside your browser sandbox. All answers and preferences are stored locally in your browser's `localStorage`. No telemetry, analytics, or personal user data is ever transmitted or collected.
