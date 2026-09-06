# 🚀 Installation & Browser Setup Guide

This guide explains how to install and enable the **AMAES & ACLC Moodle Toolkit** on any web browser.

---

## 📋 Overview of Steps
1. **Install a Userscript Extension** (Violentmonkey is strongly recommended)
2. **Enable "Developer Mode"** (⚠️ **Crucial Step** for Chrome, Brave, Edge & Opera)
3. **Install the Userscript** (1-click link)
4. **Open Moodle** (`semestral.amaes.com`) and start using the toolkit!

---

## Step 1: Install a Userscript Manager

A userscript manager is a browser extension that allows custom scripts to run on specific websites. 

### 🌟 Violentmonkey *(Recommended)*
Violentmonkey is 100% open-source, lightweight, fast, and privacy-respecting:
- **Google Chrome / Brave / Opera**: [Chrome Web Store](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)
- **Microsoft Edge**: [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjfgddacbcigncyclcoaebeent)
- **Mozilla Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/)

*(Alternative: You can also use [Tampermonkey](https://www.tampermonkey.net/), though Violentmonkey is recommended for speed and simplicity).*

---

## Step 2: Enable "Developer Mode" *(CRUCIAL for Chrome / Brave / Edge / Opera)*

> [!WARNING]
> **Why is this required?**
> Starting in modern Chromium updates (Manifest V3), Google Chrome, Brave, Opera, and Microsoft Edge **block all userscripts from executing on web pages** unless **Developer Mode** is turned ON.
> If you skip this step, the toolkit will NOT load on Moodle!

### How to Turn on Developer Mode:
1. Open a new tab and go to your browser's extensions page:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
   - **Opera**: `opera://extensions`
2. Look at the **top-right corner** of the page.
3. Find the toggle switch labeled **Developer mode**.
4. Click the switch to turn it **ON** (it will turn blue).
5. *(Firefox users: You can skip this step! Firefox allows userscripts by default).*

---

## Step 3: Install the Userscript

Once Violentmonkey is installed and Developer Mode is enabled:

1. **[👉 Click Here to Install `amaes-moodle-toolkit.user.js`](https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js)**
2. A Violentmonkey tab will open displaying the script's metadata and code.
3. Click the blue **"Confirm installation"** button in the top-right corner.
4. Close the Violentmonkey tab.

---

## Step 4: Verify on AMAES Moodle

1. Navigate to the **[AMAES Moodle Portal](https://semestral.amaes.com/)**.
2. Log into your student account.
3. Look at the **bottom-right corner** of the screen:
   - The **AMAES & ACLC Moodle Toolkit** floating panel will dock automatically!
   - On first load, the **Quick Start Guide** will welcome you and allow you to configure safe defaults.

---

## ❓ Troubleshooting & FAQs

### Q: Clicking the install link just shows a page full of raw JavaScript code!
- **Fix**: You do not have Violentmonkey or Tampermonkey installed in that browser, or the extension is disabled. Install Violentmonkey first (Step 1), then click the link again.

### Q: I installed Violentmonkey and the script, but nothing appears on Moodle!
- **Fix 1**: Did you enable **Developer mode** in `chrome://extensions`? (See Step 2). This is the #1 cause on Chrome/Brave/Edge.
- **Fix 2**: Refresh the Moodle tab with <kbd>Ctrl</kbd> + <kbd>F5</kbd> (or <kbd>Shift</kbd> + <kbd>Reload</kbd>).
- **Fix 3**: Make sure you are on `https://semestral.amaes.com/`. The script is locked to this official domain for privacy and safety.

### Q: Can I use this on Android or Mobile?
- **Yes!** Install **Kiwi Browser** or **Firefox Nightly** on your Android device:
  1. Open Kiwi Browser.
  2. Install Violentmonkey from the Chrome Web Store.
  3. Go to `chrome://extensions` in Kiwi and enable Developer mode.
  4. Click the raw script install link.

---

## 🔄 How to Update the Script

- **Automatic**: Violentmonkey automatically checks GitHub for updates once a day.
- **In-App Notification**: When a new version is released, the toolkit panel displays a **"New vX.Y.Z released!"** banner with a 1-click update button.
- **Manual**: Click the version pill (e.g. `v1.0.7`) in the panel header anytime to check immediately!
