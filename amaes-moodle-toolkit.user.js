// ==UserScript==
// @name         AMAES Moodle Toolkit
// @namespace    https://semestral.amaes.com/
// @version      1.2.4
// @description  Modular toolkit for AMAES Moodle with AI Quiz Question & Choice Auto-Copier, Grades Past Quiz Harvester, Background Community Answer Sync, and Auto-Marker.
// @author       Anonymous / Open LMS Contributor
// @match        https://semestral.amaes.com/*
// @updateURL    https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setClipboard
// @connect      amauoed.com
// @connect      raw.githubusercontent.com
// @connect      githubusercontent.com
// @connect      gist.githubusercontent.com
// @connect      api.github.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // STRICT DOMAIN LOCK: Ensure execution ONLY on semestral.amaes.com
    if (window.location.hostname !== 'semestral.amaes.com') {
        return;
    }

    const SCRIPT_VERSION = "v1.2.4";
    const SCRIPT_RAW_URL = "https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js";
    const GITHUB_REPO_URL = "https://github.com/lms-study-hub/amaes-moodle-toolkit";
    const HOME_URL = "https://semestral.amaes.com/2612/my/courses.php";

    // DEBUG SWITCH: Toggle to enable/disable the debug export button
    const DEBUG_MODE = true;

    // In-memory debug log buffer for AI diagnosis
    const debugLogs = [];
    function logDebug(msg, data = null) {
        const entry = `[${new Date().toLocaleTimeString()}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
        debugLogs.push(entry);
        console.log(`[AMAES Toolkit] ${entry}`);
    }

    // Activity State & Real-Time Logging Engine (Doing, Done, Plan)
    const activityHistory = [];
    let currentDoing = "Ready. Select a tool above.";
    let currentPlan = "Ready for action";

    function setLog(doingMsg, color = null, planMsg = null, addToHistory = true) {
        if (doingMsg) currentDoing = doingMsg;
        if (planMsg) currentPlan = planMsg;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (addToHistory && doingMsg) {
            const cleanDoing = doingMsg.replace(/<[^>]*>?/gm, '');
            const cleanPlan = (planMsg || currentPlan).replace(/<[^>]*>?/gm, '');
            const last = activityHistory[0];
            if (!last || last.text !== cleanDoing) {
                activityHistory.unshift({
                    time: timeStr,
                    text: cleanDoing,
                    plan: cleanPlan,
                    color: color || "var(--text-secondary)"
                });
                if (activityHistory.length > 50) activityHistory.pop();
            }
        }

        const statusEl = document.getElementById('amaes-status');
        if (statusEl) {
            statusEl.innerHTML = currentDoing;
            statusEl.title = currentDoing.replace(/<[^>]*>?/gm, '');
            if (color) statusEl.style.color = color;
            else statusEl.style.color = "var(--text-primary)";
        }

        const planEl = document.getElementById('amaes-plan-text');
        if (planEl) {
            planEl.innerHTML = currentPlan;
            planEl.title = currentPlan.replace(/<[^>]*>?/gm, '');
        }

        const dotEl = document.getElementById('amaes-status-dot');
        if (dotEl) {
            dotEl.style.background = color || "var(--accent-green, #10b981)";
        }

        const countBadge = document.getElementById('amaes-log-count-badge');
        if (countBadge) {
            countBadge.innerText = `Log (${activityHistory.length})`;
        }

        const logsList = document.getElementById('amaes-logs-list');
        if (logsList && logsList.parentElement && logsList.parentElement.style.display !== 'none') {
            renderActivityLogs();
        }

        logDebug(`[${timeStr}] DOING: ${currentDoing.replace(/<[^>]*>?/gm, '')} | PLAN: ${currentPlan.replace(/<[^>]*>?/gm, '')}`);
    }

    function renderActivityLogs() {
        const logsList = document.getElementById('amaes-logs-list');
        if (!logsList) return;
        if (activityHistory.length === 0) {
            logsList.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No recorded events yet.</span>';
            return;
        }
        logsList.innerHTML = activityHistory.slice(0, 15).map(item => `
            <div style="display: flex; gap: 6px; line-height: 1.35; padding: 2px 0; border-bottom: 1px dotted rgba(255,255,255,0.06); font-size: 9.5px;">
                <span style="color: var(--text-muted); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${item.time}</span>
                <span style="color: ${item.color || 'var(--text-secondary)'}; word-break: break-word;">${item.text}</span>
            </div>
        `).join('');
    }

    logDebug(`Toolkit initialized. Version: ${SCRIPT_VERSION}, Host: ${window.location.hostname}`);

    // Auto-remove any old/duplicate panel version if still present in DOM
    const oldPanel = document.getElementById('amaes-toolkit-panel') || document.getElementById('amaes-helper-panel');
    if (oldPanel) oldPanel.remove();

    let isRunning = false;
    let shouldStop = false;

    // Remote GitHub Asset Loader & Permanent LocalStorage Cache
    const ACLC_LOGO_URL = "https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/assets/aclc_logo_transparent.png";
    const FALLBACK_ACLC_URL = "https://raw.githubusercontent.com/lms-study-hub/database/main/assets/aclc.png";
    const FALLBACK_ACLC_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 78 112" width="78" height="112"><text x="50%" y="70%" font-size="26" font-weight="900" fill="%23d30425" text-anchor="middle" font-family="sans-serif">ACLC</text></svg>`;

    function getAclcLogoSrc() {
        return localStorage.getItem('amaes_aclc_logo_cache') || ACLC_LOGO_URL || FALLBACK_ACLC_SVG;
    }

    function fetchAndCacheAclcLogo() {
        if (localStorage.getItem('amaes_aclc_logo_cache')) return;
        const req = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
        if (!req) return;

        const tryFetch = (url, fallback) => {
            try {
                req({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: (res) => {
                        if (res.response && res.status === 200) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64Data = reader.result;
                                if (base64Data && base64Data.startsWith('data:image')) {
                                    localStorage.setItem('amaes_aclc_logo_cache', base64Data);
                                    document.querySelectorAll('.amaes-aclc-logo').forEach(img => {
                                        img.src = base64Data;
                                    });
                                }
                            };
                            reader.readAsDataURL(res.response);
                        } else if (fallback) {
                            tryFetch(fallback, null);
                        }
                    },
                    onerror: () => {
                        if (fallback) tryFetch(fallback, null);
                    }
                });
            } catch (e) {
                logDebug("Error fetching ACLC logo asset:", e.message);
                if (fallback) tryFetch(fallback, null);
            }
        };

        tryFetch(ACLC_LOGO_URL, FALLBACK_ACLC_URL);
    }

    // ==========================================
    // Update Checker & Release Notifier
    // ==========================================

    function isNewerVersion(remote, local) {
        if (!remote || !local) return false;
        const r = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        const l = local.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0;
            const lv = l[i] || 0;
            if (rv > lv) return true;
            if (rv < lv) return false;
        }
        return false;
    }

    function renderUpdateNotice(latestVersion) {
        let container = document.getElementById('amaes-update-container');
        if (!container) {
            setTimeout(() => renderUpdateNotice(latestVersion), 400);
            return;
        }

        const versionPill = document.getElementById('amaes-version-pill');
        if (versionPill) {
            versionPill.innerHTML = `${SCRIPT_VERSION} <span style="background: #10b981; color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 8px; margin-left: 2px; font-weight: 800;">UPDATE</span>`;
            versionPill.title = `Update available: v${latestVersion}! Click to install`;
            versionPill.style.borderColor = '#10b981';
            versionPill.style.color = '#10b981';
        }

        container.innerHTML = `
            <div id="amaes-update-banner" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 7px 10px;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.25));
                border: 1px solid rgba(59, 130, 246, 0.5);
                border-radius: 6px;
                margin-bottom: 6px;
                font-size: 11px;
                animation: amaesFadeIn 0.3s ease;
            ">
                <div style="display: flex; align-items: center; gap: 6px; min-width: 0; color: #93c5fd;">
                    ${ICONS.download}
                    <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        New v${latestVersion} released!
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <a href="${SCRIPT_RAW_URL}" target="_blank" rel="noopener noreferrer" class="amaes-btn amaes-btn-primary" style="padding: 2px 8px; font-size: 10px; font-weight: 700; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                        Update Now
                    </a>
                    <button id="btn-dismiss-update" style="background: none; border: none; color: #94a3b8; font-size: 15px; cursor: pointer; padding: 2px; line-height: 1;" title="Dismiss">&times;</button>
                </div>
            </div>
        `;

        const dismissBtn = document.getElementById('btn-dismiss-update');
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                sessionStorage.setItem('amaes_update_dismissed', latestVersion);
                container.innerHTML = '';
            };
        }
    }

    function checkForScriptUpdates(manual = false, callback = null) {
        const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
        const lastCheck = parseInt(localStorage.getItem('amaes_last_update_check') || '0', 10);
        const now = Date.now();

        const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, SCRIPT_VERSION);

        // 1. If an update is ALREADY known from cache:
        if (hasKnownUpdate) {
            renderUpdateNotice(cachedLatest);
            if (manual) {
                // If user clicks check when an update is already known, immediately open installer URL!
                showToast(`Opening v${cachedLatest} installer in browser...`, 3500);
                setLog(`Update <b>v${cachedLatest}</b> is already known. Opening installer...`, "var(--accent-green)");
                try {
                    window.open(SCRIPT_RAW_URL, '_blank');
                } catch (e) {
                    window.location.href = SCRIPT_RAW_URL;
                }
                if (callback) callback({ status: 'update_available', version: cachedLatest });
                return;
            }
        }

        // 2. Cache throttling: avoid repeated network requests on every page load or repeat clicks
        const throttleWindow = manual ? 30 * 1000 : 2 * 60 * 60 * 1000;
        if (!manual && (now - lastCheck < throttleWindow)) {
            if (callback) callback({ status: hasKnownUpdate ? 'update_available' : 'cached', version: cachedLatest || SCRIPT_VERSION });
            return;
        }

        if (manual) {
            setLog("Checking GitHub for toolkit updates...", "var(--accent-blue)", "Querying releases...");
        }

        const req = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        const processRemoteVersion = (remoteVer) => {
            localStorage.setItem('amaes_last_update_check', String(now));
            localStorage.setItem('amaes_latest_version_seen', remoteVer);

            if (isNewerVersion(remoteVer, SCRIPT_VERSION)) {
                renderUpdateNotice(remoteVer);
                setLog(`Update found: <b>v${remoteVer}</b> is available! Opening installer...`, 'var(--accent-green)');
                showToast(`Update found: v${remoteVer} is available!`, 4000);
                if (manual) {
                    try {
                        window.open(SCRIPT_RAW_URL, '_blank');
                    } catch (e) {
                        window.location.href = SCRIPT_RAW_URL;
                    }
                }
                if (callback) callback({ status: 'update_available', version: remoteVer });
            } else {
                if (manual) {
                    setLog(`Toolkit is up to date (<b>${SCRIPT_VERSION}</b>).`, 'var(--accent-green)');
                    showToast(`Toolkit is up to date (${SCRIPT_VERSION})`);
                }
                if (callback) callback({ status: 'up_to_date', version: SCRIPT_VERSION });
            }
        };

        const checkViaRawUrl = () => {
            const rawUrl = `${SCRIPT_RAW_URL}?_t=${now}`;
            const parseRaw = (text) => {
                const m = text.match(/@version\s+([0-9.]+)/);
                if (m && m[1]) {
                    processRemoteVersion(m[1].trim());
                } else {
                    if (manual) setLog("Unable to verify update header.", "var(--accent-amber)");
                    if (callback) callback({ status: 'error', message: 'Could not parse version' });
                }
            };

            if (req) {
                try {
                    req({
                        method: 'GET',
                        url: rawUrl,
                        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
                        onload: (res) => parseRaw(res.responseText || ''),
                        onerror: (err) => {
                            logDebug("Raw update check error:", err);
                            if (manual) setLog("Network error checking updates.", "var(--accent-red)");
                            if (callback) callback({ status: 'error', error: err });
                        }
                    });
                } catch (e) {
                    if (manual) setLog("Exception checking updates.", "var(--accent-red)");
                    if (callback) callback({ status: 'error', error: e });
                }
            } else {
                fetch(rawUrl, { cache: 'no-store' })
                    .then(r => r.text())
                    .then(parseRaw)
                    .catch(err => {
                        logDebug("Fetch update error:", err);
                        if (manual) setLog("Network error checking updates.", "var(--accent-red)");
                        if (callback) callback({ status: 'error', error: err });
                    });
            }
        };

        // Query GitHub API Releases first for instantaneous 0-delay tag detection
        const apiUrl = `https://api.github.com/repos/lms-study-hub/amaes-moodle-toolkit/releases/latest?_t=${now}`;
        if (req) {
            try {
                req({
                    method: 'GET',
                    url: apiUrl,
                    headers: { 'Accept': 'application/vnd.github.v3+json', 'Cache-Control': 'no-cache' },
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText || '{}');
                            if (data && data.tag_name) {
                                const ver = data.tag_name.replace(/^v/i, '').trim();
                                processRemoteVersion(ver);
                                return;
                            }
                        } catch (e) {}
                        checkViaRawUrl();
                    },
                    onerror: () => checkViaRawUrl()
                });
            } catch (e) {
                checkViaRawUrl();
            }
        } else {
            fetch(apiUrl, { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    if (data && data.tag_name) {
                        const ver = data.tag_name.replace(/^v/i, '').trim();
                        processRemoteVersion(ver);
                    } else {
                        checkViaRawUrl();
                    }
                })
                .catch(() => checkViaRawUrl());
        }
    }

    // ==========================================
    // Theme Management
    // ==========================================

    const THEMES = {
        dark: {
            bg: "#18181b",
            surface: "#27272a",
            surfaceSubtle: "#202023",
            border: "#3f3f46",
            borderSubtle: "#2e2e33",
            textPrimary: "#f4f4f5",
            textSecondary: "#a1a1aa",
            textMuted: "#71717a",
            accentBlue: "#3b82f6",
            accentBlueHover: "#2563eb",
            accentPink: "#f43f5e",
            accentPinkHover: "#e11d48",
            accentPurple: "#a855f7",
            accentPurpleHover: "#9333ea",
            accentGreen: "#10b981",
            accentGreenHover: "#059669",
            accentAmber: "#f59e0b",
            accentGray: "#52525b",
            shadow: "0 14px 36px rgba(0, 0, 0, 0.45)",
            statusBg: "#111114"
        },
        light: {
            bg: "#ffffff",
            surface: "#f4f4f5",
            surfaceSubtle: "#fafafa",
            border: "#e4e4e7",
            borderSubtle: "#ececee",
            textPrimary: "#18181b",
            textSecondary: "#52525b",
            textMuted: "#71717a",
            accentBlue: "#2563eb",
            accentBlueHover: "#1d4ed8",
            accentPink: "#e11d48",
            accentPinkHover: "#be123c",
            accentPurple: "#7c3aed",
            accentPurpleHover: "#6d28d9",
            accentGreen: "#059669",
            accentGreenHover: "#047857",
            accentAmber: "#d97706",
            accentGray: "#e4e4e7",
            shadow: "0 14px 36px rgba(0, 0, 0, 0.12)",
            statusBg: "#f8fafc"
        }
    };

    let currentTheme = localStorage.getItem('amaes_toolkit_theme') || 'dark';
    if (!THEMES[currentTheme]) currentTheme = 'dark';

    let autoCopyKeyword = localStorage.getItem('amaes_auto_copy_search') !== 'false'; // default true
    let autoHighlightQuiz = localStorage.getItem('amaes_auto_highlight_quiz') !== 'false'; // default true
    let autoCopyQuizForAI = localStorage.getItem('amaes_auto_copy_ai') !== 'false'; // default true
    let autoQuizMode = localStorage.getItem('amaes_auto_quiz_mode') === 'true'; // default false (Master autonomous switch)
    let quizPersonality = localStorage.getItem('amaes_quiz_personality') || 'passive'; // 'passive' | 'aggressive'
    let autoPickQuiz = localStorage.getItem('amaes_auto_pick_quiz') === 'true'; // default false (Safe companion mode)
    let autoNextQuiz = localStorage.getItem('amaes_auto_next_quiz') !== 'false'; // default true: auto-next when questions on page are answered
    let autoSubmitQuiz = localStorage.getItem('amaes_auto_submit_quiz') !== 'false'; // default true: auto-submit to review screen
    let autoNextTimer = null;
    let pageLoadSolverTimer = null;
    let smartSkipQuiz = localStorage.getItem('amaes_smart_skip_quiz') !== 'false'; // default true: skip answered questions
    let autoCloudSync = localStorage.getItem('amaes_auto_cloud_sync') !== 'false'; // default true
    let autoHarvestGrades = localStorage.getItem('amaes_auto_harvest_grades') !== 'false'; // default true: auto-harvest past quizzes on course/grades open
    let cloudDbBaseUrl = localStorage.getItem('amaes_cloud_db_url') || 'https://raw.githubusercontent.com/lms-study-hub/database/main/data/verified/';
    const CLOUD_DB_FALLBACK_URL = 'https://raw.githubusercontent.com/lms-study-hub/database/main/data/';
    const CLOUD_DB_AMAUOED_URL = 'https://raw.githubusercontent.com/lms-study-hub/database/main/data/amauoed/';
    const DEFAULT_COMMUNITY_RELAY_URL = 'https://amaes-community-relay.workers.dev';
    let communityRelayUrl = localStorage.getItem('amaes_community_relay_url') || DEFAULT_COMMUNITY_RELAY_URL;
    let aiPromptHint = localStorage.getItem('amaes_ai_prompt_hint') !== 'false'; // default true for clean a/b/c/d answers
    let showInQuestionAiBtns = localStorage.getItem('amaes_show_in_question_ai_btns') !== 'false'; // default true
    let enableKeyboardShortcuts = localStorage.getItem('amaes_enable_hotkeys') !== 'false'; // default true: N, Space, 1-4, C, P, H
    let autoCommunityShare = localStorage.getItem('amaes_auto_community_share') !== 'false'; // default true: auto-share on review / harvest
    let autoMinimizeQuiz = localStorage.getItem('amaes_auto_min_quiz') !== 'false'; // default true: smart pill in quiz

    // ==========================================
    // Authentic ACLC Transparent PNG Logo
    // ==========================================

    const ACLC_LOGO_PNG_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAABwCAYAAACw2kbAAABFb0lEQVR4nNW9d7Rl2V3f+dnphBtefvXeq6pXr3J1d3VOklpICAkhgYDByLI9a7CMMWFgYWzCeA0GM4OHYC+PDRgcYDkh24MXyQQjJKyAQre6W51T5ZxfvvGkHeaPc9/r6lZLdIN6ZnnX2qvuve/cc8/5nd/+5d93i6eePcnNQwjxmu9f/fmfNUIIX/a8r3gNSAJVVaF1RJo2IAic81hncaOplERrTVF5ijxDG830zPiH8jz7rSzP8N4zMT6BtYGqtFSVQyrB673sN3p/+qt5sj/feQKIQBxHCKFwzqGkoqxKnLNEUYRzDiEkWhtc8PjIIyWUZfVb3nukkAgFVVXhPQRASokQ4Sv87l9syC93g28W0V77vGF0o+C9RRv5oRAsw2GftbXVDwhRc2Cn08O5gNYRUmmKosS5+rtSKqqqwjkHIYx+56tzD681tgn31SaaEOLPJJoQgq215IPDB4cQEMfmN5US9Pv9cPr06f8mJVRlybWr18NwMEQgUVJTVQ7vA0JIlFRYa/Hej879F76Frzjkq2/wtW7uq0XI1zqnEAKlFNZWhOBJUvOutGFotuKHijLj+eefw7uCohh814WLl7hxYzXkeYkUCoIkjLhLCPHya1k/iHrRvjnjyy7V13r/RodAfAnhv/Q3QEqBUpI41iSp+bRSgjRNHm61GqtKKTrdwa8Whf+1SMesrqzT7w1+0bqAUhoh1GhJ1g9Aa4UQAu/9lyior+Z4zaX6Wu//XONVp/hyv+G9J44j0jT+aBRpQnAYo5icnJhdWtrDyvLm9+a5VzOz8/R6Q7rdwd8piwqlNFIqQhCEAEoppFQj7vN/8ev/CuNLluqrb/DPu1Rf7zmDr02RJIn/fZyYbxTCU9qcgGN6ZvKX77//PrG8vEKWFSwt7RfeBwaDIXmWI4WqlywQgkcpNTrvm8dpW0O++oP/LzTrzSMQAI8x6juVUjhvAY8PljjSP7hnz87TUgpsVSGCoNVs41xgMMyDtaG+hQDeB0IA52oFUS/Zr8rlv+Z4hR33/4c5UpsSerTMagIoJUf2mEQKc2BiYoLgYXOz85lWs43HkWc51lq0VgRqxRBCwHtHCAKtNc553iwx92Vl3F9kCCHY+keA+urDSOSF7SkEaKVoNBr3SyFfFvBKbS+7EALz83P/RmvN6uryO8cmmiACg+GQLMvxCBBbci7UnLd9a2+iHfflZNjWE9yaX0KYV82ac0ZTSJQQiBAI3oP3CO8ROPCW4CsEFiU9SazfNTE28cXgJcEKjIqQQoB3COFJEs3i7rnvGWtH5OUmc7vHhBNDrt64xpVrq8E6iVARXkicEKgoARnTH3i8f+1rfa35hgn3FyL7TYR8xfubfdybCB1GnEcIEEAKgZLyvVophJCwfRMShBw9EEGSxg+nafwvjNHkxXC/MQZjDN1enzyvCEGglMY5SyAgZG3LvYkM99Uh3KtHGHHsFieKERG4iZNr+00ilXiHkCCVqDltZJMJUXOuEAKt9UONZuMH0zSls9k9E0UprVabbqfPYJD9PeccSisQgRAc4NHmq2O4f7nxphDuZnNgi2tuJhwjpaCUiqVU7xAClJJIJbdlU03s+vKiyNAea9FuN9nc3CRJUlrNCbrdPp1O/x8XRR0Y0NqMXLcSbQRSvv6l+kbnm0Q4XuEKvZb3UFv5+ke0UtufvXyMuGmC1oJWM/1Eu90WzjmklERxhJSajfUN+r3+dwkhiSKD9w7nLFr/D8lxr62la59ebHEbWqu/rbTe/tvoqHqGkZAKtUsWJ9F7xsZbpGmC9xYhYHp6mvW1DTY3O/9WCNn0bqTACQTeZM/hTT37aLyslF8mmlLqXVrrBaXUaGGH7WPr48X25QkBUaRpt9Pfn5wex7oS5yt2795Ft9en0+lhKz8oihKBQEqFc35k8vwPtlQZLdfa2fZ471/FbfpHtVYoybZfuXW8cy8v1ZE1U2vXxHzr7I5x4XyOcyW7dy+IEALdbr9WFP0MITRGx9jK82a6q28S4V5WBDUh/LbMU0phjD6glPrmreBlHan9Uo6rTZiacADaSCYmGt8UJwohaw9jbm6Osqw4dfpc8F4IKQygCUFtmzf/w3DclrjaItxWiKfWngql1F+pQ0Ji++BaxoWRk7Htd2yfJ4RAHW6K/qjZjM8pDVmWsXtxN8F5Tpw4hVZREGi8E0ihbzrDV3+8IcK9nssIgBc3HR1GBAwjcS0ESslvU0qO7LaXOS4EXjaSbzJpfBjF1oRAaUGzne43RrKydiMsLu4UQknOnT2P1gkBOQqnq5s0zmtf+fav/Dno+wpf9Su5UbGTNCpFJDRBa6yWWAkSiZEGYxJsnLAZa9a1pCcEOhgaMkYbQzd2rIic3HhaSfpgXFikdQBUIWAJBBkQ2hO0xYoSS4mXFdIE0FukTJhb2PmxdCr+oZcuPY2L++w7uMihfUc4/fz5kHcKGpEBWZHZCickJo6UFBpfeXzlUELiCeS+IqPCNQxBiS9xM7/S/LIc92pzQkmFVhqkwgNuFMqRHrQFbQPKBZSnngFKEXCxQqcxqTK0hCFF36+EQBqFkCOtiaynqDXilr87EoC1MVzrS6JgaCeN9020mr/cSDX93ua3tlqNK7t3L3Ls2El6/e4JEYmdWZXhnMN5j3PBbTGWGAlNIzWxMighqbIc79yfj+P+zKElwSicCLjgCd4jHSgH2nlM5UlKR6P0NCtP4hyldhQxSC2YKgQLPnnrmFe/75zFJ5qgJSIIFAoZJCIoRFBIrxBBI4NGeIXwspZ7XhB5SeIk02lz6eCuRdaur/0+wc/O75rh4vVLbAw6h63wV52gzj3YijLPEdTKRAiBLSt0gKaOphsYfDcnVG8S4SyeQjhK7/DeIwMYpTFao4XaZQJvSSy0vaThPNIWmJbBS0vR6eAvroRkwM8ZK3fmVUkeAs57gvMEB96BtwFXemzpcaXDlR5vPcEFqF1QCALpoR2l5/ct7BQbN27gq260a7EtVKzY7A3IMsfc9I4/bCYpeE9VlQgpiJJoXCrFMMsY9gf4olpLUI1GUKg3KOheN+G893Umyjmkr5euNBqvFYUKVzJhHyuo8FQ4UWJVyaTgveb6Otmx86F7+iKuyFeFUaAVlatw3iEICGGBCrCj6Ua51oBSAak8UjmEcqDqq46MZrzV/BkZPFlWASn333cfw80uV46fCeOYb55qpBdbaYxSgdIXlLiOVQGvBbmryMsSZ+0wiWOUVG8O4ULwEDw6gKaWQUFIchnoS0dXWgaypFAVlbZ4VWBW1hfEiQvBHT8P/SFB+qshUojIIPB1vC44fMjxoSCEkiAsQnikDKPpQVQECjwllQo4JUArojj6iYnJMfKiZGV1/fl777xFkA25+PxxNk5eWFJZ9ZmWUt+RaoVzlsIVVNIjmzEkhkp4SmcR6mYN/FUmnJSgpSCSEiNq2VQFzwBLV1p62jGMPJl2WGMRLv++4Ysnfj1//EXkmWtMjI0hmyb3iURqTSoVWghCsFQuw7kc50tCsAgZkCogpAfh8L6gshmFHZLhKZTEGYWKFXv2LYqiHHLyxAu371uaCE081148xeN/8N8v9M9dentS2A+N6+ivG6AoS0o88XhrfzLRhiQix5N7j3+DCZ7Xz3FAEAElBDLUatXagJOgYkPcTEibEY1Y0RjmR+Tpi//64ic+y+axU2ghmLz9MHaicXcmPVb4WnMGjyBgTIQyBqk1SEMQ9UQaEAahDFJpUJpKCCpqFRlpzd69u0NrrMlar8NG34vdu/cznjb53Mc+wQsf/9N9nedPfWuzW35kIW5tTJiYSAhCcGeDFvuDVnitCFoS3iyOcyJQiYAbZd+ECwjn0SgSZWhKSVpa1HpnTJ64eFx9/nl6L53GuYJk5yTRrhl0Er9PAjgLBLzweCEIMsGGiKyQdPv2n69t5B9c38w/stmtGObgggGZIERcKwfn6ykEzWaDqbnpf9WYHOfExcuhOT35yfmlRbr9PtcefZblh58mO3aeeK0/0S7DfQ0vCJXFlfYsYduTecMhqK9YrXTzqETAi4AItQkiAmgHMigiD7qwuNXOh4aXrvym+eILRJ95BtXr0jh4gMaRXYSmIVIa6QMWR6VqORY8lKUiy+zvdjrZBzubA7Jh9YSS6mNpmojxySYT43GIE4NUEuPBOIcMHpTA45ienfmB+b3Z9z9z+jhvP3L7mblDe98zvWcn+ekrLGeB1MKCEpi98/+qOdF4eyV8VYWAQKKFQoQ6kfRGFuvrJpyT4BSEIJFWIOp0KKr0qLLCdTenu6cv/ubKC8doPvY0u08dZ/7obYzffZDmLYtFNexuajExF8cGKQL9KiPWiuAEy2s9sbK8/q5rV1bD1SurdDoDlNL3jY+3f2Lnzh0s7tkhZucn/trEWPobTQXSgfC1e5YVw9XJseaf7to9J/7g058OexcWvnfv3OTH7nzowfen5z5K98QZTmQZmQjsVA88kDSW/rexJPnjoQ9PhyDAhjq5HUmEev1cp7WvJX/lHEEJlNGYOKa0FUVZYquKOEmIlUR4h6sKMm/QcUIcx7cJZ1+yK6tUp06v6ieeZvzJpxGnL9DzmvZ8m/biJNHCeJw323OhDE7nQxVHFbFRdL3h/PVV8cWHPxcUTUoX0yXmelWSnbtOa/0UmYCx23eH2Tt2IW7b9TvLS4sfHNOGZqWg8uDcC1qreydbTe7fv0SUZ1gZv3/37Ud5Yv+LzDx/mtsv3WDmTz7FsLhK5R742eZDD04NZfp0VgmCl7RkgzJyhCigA1R5QXC+5vAkwZYVrrBIG5hIW0ul8Bd0ALRWOOu3Y6ZS1PGd4BzeOQQQBYnwnm5VEaRGR5I0MY/Z5V67f/ZCyJ58HvXk86Qnz0G3T5iYLlrHjM7jW+1IG0QXKW8t8F7IXCGS+duiBMnz4fByhC0JkfQyyFf7SHPrRJfuILsbFBcP8dwZZ60f+iDmVaiMT07cDpqVN4ilXpBRTcfzoPQcPsnFlld6gy8Liroli39JmfnkNeeEi5twaHbOOiitaszM/mu7c/2O+0aaUClzA+QpcwEiFERIvRzUGwdfFjMGjEEjYI+CCtlpgIo0W4CoLeUWoQDlLXAWMlzQqkFpSek2FQxtBpAJpnl0cnD0X8seeZu3hL6LPnWXaOdqNlGQypbG4n2p8/imnkntjAnHT4J0RWenpbeT3HP/ME2HlzDW+7v73cXKwyanrV+mcv8jE6Wvsu9Zh13qXdncN9eJl1jdO4dcuM6nSEN17+wvV/MztPexPtJoTPxupCCOqtywtLIprl66HYdZlX+tgZ/eu3Qx3XOTc6g1SXzI8c4PIP0MldzDxTWNh7LY2w7ZhLe+JKsuQGWAimnFyAE1cuOqlfj8jCFBGo2JN1xWfC0KgCxlQwSNDqDWV9SQEQOO1xHqP8oJhGcilpNlqEwuPWFtm9fS524affQL/6NO0zpxHDrtUSuBmx2kemsMcOEA5M/cbTkf36lAgnMB5xWp/KH77Nz4RZvKCe5ZuI6umuHTuDKunz5BeusDR5S77NzeYGmwi6CGdRV7voIZ9tG1QFcXt4aE7P8K+pZ8dek+oLLHVzIxNhKnZGTa6Hday9X89eWA3nXOznL0sWcpTxqoB5tIq/Y99geAMaadHeufB32nNNn+9MTDfVfVyVwxyRBXOmMjUiXUvUHGEjg0owcbmJkZqNEJQWYuqLNp5FBIlFEKKGRfkqqWi9JZCR3hjaCIwq+vjgxPHNje+8Cj+sRdoXrjO1CDHB0VPgp9sI27di1zaBc32PwlOIawHJzl/+Yb4/Aunwmq/5ODOXahkgo+9+DybF84TnbvMzsuX2JN1WQg5cZLTC0O8szQKw8SmRzz5HL22gDH94ebOuZWK6FpluVMFQRQZ5mZnRRlcWN5Y+T65a5awOMNgvEE+9CyIFqrIWbtwlvLTklDkpDb7oHrHrYcj2f5+aaJfqcqKoBVB61GMUGArS1ACqTQqjZBeoJUQ+LKCyiGRCC3xShAEq2UI5CFQBoeLFUppotUuHD+7WT3+DL0vPE5y7gqtzDOtDGWQuEihFuZxd96GnxtHGIUqIZSGbmf44y8+fzY8/NjT3H3PA5iJOU5dXuXjT/8pRza7HL1+jVvWV1kQmzRSjzWWzOcoJ1GiTRpSsqtX6T7uCeMxjb17ZtX84rf4ZOwXSqnelgjJ9OQEvWHvxdOXlo+OH1xE75rFzMzQu9BD0EZJGBbXsceOYZxDSEs1I0+qnYeaOhlfjBvJJYzGKYF3IKTG2hJfBLQMJGmMKAMyCQrpRsXGWmG1pI9lw+Vs+JyB8lSxQjb0ncaW9J5+IfQ/+Sju88/QvnidSSyNSBBkoAqeiZlpJm45irj33iedqUiqIS3rEU7yxLNnf/746QuMtwX3vu3Q4edXr/Dbn/4UZv0ME5dOcHBzmXsjWGoaKrvJauc6vj+kpVtYYq4Oi/ohnrtC9vHHufbv/wB97uqjcXBvIxWoSNBQ4ucaUvwTrSRIwcTCHNMHD3DNWtaCJxOaICKkCNjr1+l94Sk2f+Pj5MdPD2SVXUka6sFSWjo2p+8rolbKWGuMho4JpSUUJTiHlqVFBpDGIIzCSVFHDYJHKkUSR2itydfWnxueOBvkw4+RPvk85tIlQj5ENwwFgcJbukEwMzeLWVqCuT33WT8gEjDMqs+efGnljpfO3pgcn57ljsNHePbRx04+8/BJ7JlLfH1ng3tk4BbjSfMh/XyTRAh2qTamMhSFoy8thVGgYqKqQF5dxX36KdamphkXgfY9RxFKkhjz4824IRom/Q9xP0e1x3C3HODc3AQ71wtM5WjFDWzk6PkB6uJl2oOKfGKOIHCtA0t/I2omj+cBHAqp07sTo37eFXyfzfKLpXMgDRrr6qIDLQla4qjdKqM0idSkTuEGOf3jp8LgC4/RfOpZzIVLiF4HKyuc0+RO4JAM0xi/tBO5uIBIGoQqMMj59OXlzXc/+eLpUErBwvwOWo2EZz7xBYYvbXLrZs43DDMWgqAdSpwoyYMnFRFNYUikoSsEmXB4KSh1RGoD8dDizt9g81MPI8djxmbHEQs7ibSm2WrSbowh+jmmkZIt7aJ3yyLXj19leq1i3sZsiiF5laOKkvlBxMojT1OFkoatfr1xcCm4VvM/FkrjKvtM4e03hqpCeDBGgZRoXAAtCFJgg8eF2pEf1wnNSnyf3MxuX71w+QcHDz9B9vnPM37qOq3S4gh0gKp0RC5CmAZhegJ3ZAmxMIWpSnw8zsXr6+9+8dylcPrKce5/59swqeKxR5/j8qMnuHU4xrtVwluspzPsk1ERIoHW49iyInMBtMTEEa1g8XaI97W/mgqIkaw9+Ry9tmEwM0n7Pe9ATs/SGG+dnBqfFJ0ra4E0IZ2bwtx3C6vdIWvdHvtzRVFVZL4iEBPJGPvkMarOGkPnGWs2PjJ5oHlmmESP9LpD+oMhEkjSmGa7/W5r3ae0jjROBApnqWydymsITcPL74l6+ff2T12+98xnH8U++wwTly7TKLuY0AATo4xBSE0UNNI0KKanady2n2T3LD4v6diEZy8sh1NrG9z99qO0ZxTPvXCKT37yMZbkLPcUnv3DdXK3yVAFMiUIUhMjsZFiaDI6fpOmc8x6xQIJm2GMkoK+KNHCs0sYNo+d48Iff5Jbbz+Eb7eRaevQzp3z71++vkzsPdPpdHPXLbcMLj97nAsi515rmQsRkdZsGs017ZnKPPmV61z6759Dy8BkZR8ev/2omJ5o/1Sho39obYWXgW5/8CkpJNpphZES56q6tkxL0ljh1tce7Z+88Gudzz1N8tgTxNcu0RoGvGoydDEgibEMXA+EpDnWZO7Ww+jdeyjHxsjy7GdfPNtZXL8x/PCYmGDXwp5PPnv5xHtOnjiHud7lSNeyv+wx4dcZBosPAuUFgVHkRXg0ksRrtJcEJBUS5S0Ej5WKUmtCWRCtdzAvnSd8+jGEl6iDB6CV/LFsxkhrSDOV792Zcn2qxWZzgZVBxIw7BWqAkaAqEEaj7YDGxYuEP30MFxRlIOi7bxGyHe/WTl92eUmobO05WQFGCDQCoxRaBaIyo3/21HPDx5+iePhxZi9eISkLpIzIZEzXQRQ8MYGu61NKi55cYPHBuylm539vqMy3LWdrP/n8C6eCHo6za2IBVzXe8/SzZ1k9folbMrgj7zMblkH3KCzIEIhcAFc7fhEQIWjT2Hase0AUCmQIeKkplKESEJWOxvUO+ccfIWq3Yaz1W27f4ocak2Mf9jfkR9x65vbtNb94an7u7/YmA+c2Y3x1iZguxgXSAvJmbYrN5iXVi+cogqKHIxmXIdm3R5i0+UFp+R1V1cF9GSpHJ+tRmkCkFI3N7C3Vwy+E9T/6PJuffRJ3dZnYxIjIYF1JWjq8L6k0mEbCVNSmcJLraUR4xwPIyYlvG3SsuHy2G1bPnCWOSqIJwxPHz7Dy7EXGTlzljo0Od01GxLFmw73+Ag8hBEZrEFB5S24thhQpNINswJWz51l+6RT20tUP7RCSuV07PlmpktXNayxMLH1u8eAtMD/BM73LDCqJKSAqC6yBYTbEeUlzeie60SQ/d5nenzwCv/8IrRcvhXan+HCk9AN2lBqVUkAhPYVyDHpdemcuPLr5mafwT7xEcv4SjUFG5TIKn4EvaciAFB4bLKVzhMozvWcvu+69F2ZbFF5z6fzm//ns0+eZSRqMtRXr2RqPPfU0E1eH3NcN3Nvv0O7foLIDsjfck1DbnAEobAVGE7SisCWDtVU2j51m8NRx1LHLTAj1z0xqGfoOw6753V37jnxi4vAeTtFlzcXIENEUnlwXJHGCD5KL3TX61YCxImf+ygrh44+w9rHPsfHc8W8Npf1ic3L8x6NmilRCgJYUOAbD3se615fJzl9BXV+l0RnSqEpc0SfYHIUHaZE6EHAURc6wCrSO3MbM29/OMNFcWtkUp85d/z+uXO2wtLCEEoJLF89w9fgxlroFd1nBUpFhB8vYqo8Qb6CkKIS6BVMKkJLSWyoJTtS9Drq0VBev03/yBINHniPu9P5orCUO6XHB+cud0JqYfO/c4Z3kOxus6JRcxmgjqShQQoITZFmGCo5WsLT6PcpTZ8jOXsCubmKk+muY+G+j5LiUUmCMxjm3MCyy9/VthktUHW/TBh0sMs+IrSWW0Jc5IgEtA2VWMJAR6vY7iR966ORG0L/yzIkz4cSFS6gkZe++235w0C0488yzpNcvcms55JAMJMGxWm5CGNIWrz8RHEKgtCVC1gmfynsK53ABYhkzFTWJ1gfkz59i5RNfQJy//JHZcXNmcnGSZ09cJviKXQdm2HXfIW60GqxGMT6K8VVGUZQIJ5hUKVM6RsnAUBXkiSMebzI2MUaSJL/RzcqdWeE60nqPdhDZcC1ttf9W+/BeJr/+PsKDR+jsmWZNChJSWiQIAWsiw0mPVgJtDO07jhIv7UHo+LDOxGdPnz5L5XIefMsdLG/mv3LmhQvkJy7wgBsw2ztPObzOilHkrRmaSjPpyzewSMHj66qnUY7AhUCQta3XjhukSVcW6H/zHHyR56ktbLhZ8Zbou8sG6tFGE9nJt75vodYm2lzUmmuEdN0EucsRmp2NqagdCwHx8ruHcx+xweY/Z/eQ3Ro/+l+P0/6vT5lWaJdCDRlhHIenzT+ndo19++aU2NPZYm5J081JZ5iuYfO+3VhcqIBXzdkNBpIBiVIgU6p9oU9ZaymK8G+7Z88k8y/eW5fBfWWPpyvNnefjxxzh+5SrjdcGukyd417vezt0PvI25ycm/7b2/a3VlhXNPPsny+QvMjc1y9613sOfAgX/vXU6nU7A6WOHKyyc4f/Ikl66tc2vU4O49c8zt3cO2O6i1bW7e2ODqsROsnTnLzNAz99ZbWHzrvcx94z3oI3u5sbTEn734Is8+9hizpSdzFfseOMqb3/0A1w5P0fWjP4Zq6sDCLF9z512sra3z2FNPce250ywMNG/bM8t9b72LO+6+g4m5efrDYX5tfc3fOHmCladPsXrpKivdPkujnL233sKe+9/G7Ntu46aF088e5+jhQ6yt9XjuxRdZPnOS2eWY973tdu554K3sObA/r2yFWttYkacvXmD9xEk2z59n+cqA9QG0j93G3L33Mn5w5392PndrGxv0zp7j2rNnWb10kdncsntunnsfesD7g+MvVbVfW1/f4Ozp0/TPn6e7dJm15R432jWTe3ew4577mHzgHvTebcx89vP86aOP8vKTTzO9skpnucv19Q1mD9/OzvuPkvY2T0bWf2O12+H0sRP0zpxl9dJFZjd6zEw12Xv7Ucbvv4fGbbdQ3jBcur7O+tNPs37iJMvLq2wOa4K7Zcbe/lbGj7wV44I4c/q0d5ev0n3uBOunLrJ6+To3VrtcbXpG+/dQvO2tjD14D16lPPvC87z82GOsnT7LzFqf9Rs9lgchjR2zxA/eR+vAgZ8Krnprtzvg2tETrJ48zfq162xcW2e5q2hNTjBx5G4aR4/gD0xyqjPkmRdfZOPkSfrnr7DeW2F5o8eNgWNu7x52ve1txO94EDoDzpxbYsUv0z1zkfXlVa5dWGG5C+3WJPHR25h84B6it72FC+urPH38FGsXLrF5YYm1pS4rPY9uTzN+x0GKhx/Ef909PHHhIicef5rlp59j/Nxl+uvLLK8M2egGdrR2kLzjAcanJv/Q+8bSypq7fPkaayfPsH7hApsbq6ysthl0O4xNTjB93z3Et9yK2bOLLz97mueeeIrNy9dZvrpCf61Ptz+i2Zxg+sEbIq4AAAKmSURBVGBBPvI2/D338NTF85x44gkWn3ue9oXL9NdWWVld4+Z6j7XSkjRaaI/sQo+1uHjhEtcurdG9ts76ygqra3263YDVjkbM7CLdNY8cmecLV67w7BNPsXnqPOunLtNfWWF9tcfaWp/1QUWzNYG4ZQ8ynqDr5Vv7G+tsXFxhfWWZlfU+CIEZb2G0Qjdb1PfsRuzb/f3rG+vPnT156j9eePYEK8tLrC53WVu/wfpmj0EnR5q640822tTN8b+f2Wz9j8XFFVbPLbG2vMzq+jpb1eG9R5kIR0T78H4kMhH96v6zL55g8aUTLB8/w+b5VTY2OlxbXWdjs4cvK2RjHN+c3E5rL5w69R+eOX6SZ558ls2LF1lZXmJ1fY2NrS02tT0E3zY09s6h7tr/b22Vf93F0+f58tPnWD13hdXlFdbW1lnb3GBr8xYv6PjE/dYk+5bmP7C23vn5l557gWNPPM/m8Uv0zi/RWeuxvtZhY6uDFwYx1qI6sIv5N93zV7PHzrF+8hy9C5dZX15mbWODtbUNNjoDWu1xZHMCf/sB/K6d/9g2m783HPS48tIprp84Q/9CH2c1xWb/l9V8w7w1R2/YxV+6wvT99zD7/vuZe/tt5J31f7+6uPqfFs+v88Tjj7N87AztCyv0rl9jff2G+NoM5756/q927z/wS7aIX2hN5fz3z/wZTzz2eW5cWSZf37i173Lq5j5rUjY312lsn2H+x76P6V+9G7Vvnr3Z8Jk3f/vbv2fv/O7/+uLFi3/v9Llz9K9dJ3tthU6W0e908N5TN537bKvZ/vG5ubnf1lqf/spXvvKnPvCBD/j19fUPbGxs/Prm5ub5Gzc2/1Xf2R87fO8bH3rv13//P/mD3/kPvP/Pvs9/8h//2z999uzZ91+9evWDa2tr/3hjY+MD3W53vdPp/ODm5uZD169ff15rnX/5y1/+0e33/+Wv+3/X/g+k4Y13yN0eHwAAAABJRU5ErkJggg==";

    // ==========================================
    // SVG Icons
    // ==========================================

    const ICONS = {
        home: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        debug: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>`,
        sun: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
        moon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        minimize: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        preview: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
        check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        book: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
        edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
        zap: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        undo: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        stop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
        search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
        download: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        lightbulb: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
        checkCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
        clear: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        chevronRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
        chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
        cloud: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
        cloudDownload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/></svg>`,
        upload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        share: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
        camera: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
        copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
        sparkles: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
        external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
        git: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>`,
        github: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
        help: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        target: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        database: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
        tools: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
        shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        shieldCheck: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
        play: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        fastForward: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>`,
        alertTriangle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        rotateCcw: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        sliders: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
        checkBadge: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
        clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        xCircle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        clipboard: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
        keyboard: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/></svg>`,
        skipForward: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
        close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    };


    // Detect whether user is currently logged into Moodle
    function isUserLoggedIn() {
        if (window.location.pathname.includes('/login/')) return false;
        if (window.location.pathname.includes('/mod/') ||
            window.location.pathname.includes('/course/') ||
            window.location.pathname.includes('/my/')) {
            return true;
        }
        if (document.body && document.body.classList.contains('notloggedin')) return false;
        if (document.getElementById('page-login-index')) return false;
        if (document.querySelector('.usermenu, .usertext, #action-menu-toggle-0, .logininfo a[href*="/user/profile.php"]')) {
            return true;
        }
        if (window.M && window.M.cfg && typeof window.M.cfg.userId !== 'undefined') {
            return Number(window.M.cfg.userId) > 0;
        }
        return true;
    }

    // Reset all settings to safe defaults (turns off all aggressive features)
    function resetAllSettingsToDefault() {
        localStorage.setItem('amaes_auto_quiz_mode', 'false');
        localStorage.setItem('amaes_quiz_personality', 'passive');
        localStorage.setItem('amaes_auto_pick_quiz', 'false');
        localStorage.setItem('amaes_auto_next_quiz', 'true');
        localStorage.setItem('amaes_auto_submit_quiz', 'true');
        localStorage.setItem('amaes_auto_dl_json', 'false');
        localStorage.setItem('amaes_auto_push_github', 'false');
        localStorage.setItem('amaes_auto_copy_search', 'true');
        localStorage.setItem('amaes_auto_cloud_sync', 'true');
        localStorage.setItem('amaes_auto_harvest_grades', 'true');
        localStorage.setItem('amaes_enable_hotkeys', 'true');

        localStorage.setItem('amaes_auto_highlight_quiz', 'true');
        localStorage.setItem('amaes_auto_copy_ai', 'true');
        localStorage.setItem('amaes_smart_skip_quiz', 'true');
        localStorage.setItem('amaes_show_in_question_ai_btns', 'true');
        localStorage.setItem('amaes_ai_prompt_hint', 'true');
        localStorage.setItem('amaes_auto_community_share', 'true');
        localStorage.setItem('amaes_auto_min_quiz', 'true');

        autoQuizMode = false;
        quizPersonality = 'passive';
        autoPickQuiz = false;
        autoNextQuiz = true;
        autoSubmitQuiz = true;
        smartSkipQuiz = true;
        autoHighlightQuiz = true;
        autoCopyQuizForAI = true;
        autoCopyKeyword = true;
        autoCloudSync = true;
        autoHarvestGrades = true;
        showInQuestionAiBtns = true;
        aiPromptHint = true;
        enableKeyboardShortcuts = true;
        autoCommunityShare = true;
        autoMinimizeQuiz = true;

        const updateCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };
        updateCheck('chk-auto-cloud-sync', true);
        updateCheck('chk-auto-community-share', true);
        updateCheck('chk-auto-harvest-grades', true);
        updateCheck('chk-auto-hl-quiz', true);
        updateCheck('chk-auto-copy-ai', true);
        updateCheck('chk-smart-skip', true);
        updateCheck('chk-auto-min-quiz', true);
        updateCheck('chk-in-question-ai', true);
        updateCheck('chk-show-in-q-btns', true);
        updateCheck('chk-ai-hint', true);
        updateCheck('chk-ai-prompt-hint', true);
        updateCheck('chk-keyboard-shortcuts', true);
        updateCheck('chk-auto-pick', false);
        updateCheck('chk-auto-next', true);
        updateCheck('chk-auto-submit', true);
        updateCheck('chk-auto-dl-json', false);
        updateCheck('chk-auto-push-github', false);

        // Update welcome modal checkboxes if open
        updateCheck('welcome-chk-sync', true);
        updateCheck('welcome-chk-share', true);
        updateCheck('welcome-chk-harvest', true);
        updateCheck('welcome-chk-hl', true);
        updateCheck('welcome-chk-copy', true);
        updateCheck('welcome-chk-skip', true);
        updateCheck('welcome-chk-hotkeys', true);
        updateCheck('welcome-chk-next', true);
        updateCheck('welcome-chk-submit', true);
        updateCheck('welcome-chk-dl', false);

        const btnPassive = document.getElementById('btn-personality-passive');
        const btnAggressive = document.getElementById('btn-personality-aggressive');
        const personalityDesc = document.getElementById('personality-desc');
        if (btnPassive && btnAggressive) {
            btnPassive.className = 'amaes-btn amaes-btn-blue';
            btnAggressive.className = 'amaes-btn amaes-btn-outline';
        }
        if (personalityDesc) {
            personalityDesc.innerHTML = '<b>Co-Pilot:</b> Auto-picks answers. On unknown question: pauses safely, auto-copies for AI, and waits.';
        }

        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btnMasterAutoQuiz.innerHTML = `${ICONS.play} <span>Start Auto-Quiz</span>`;
        }

        setLog("Settings reset to safe defaults (all aggressive features off).", "var(--accent-blue)");
        showToast("Settings reset to safe defaults!");
    }

    // Helper to detect academic term from activity title, quiz name, or text
    function detectTermFromText(text) {
        if (!text || typeof text !== 'string') return null;
        const lower = text.toLowerCase();
        if (lower.includes('prelim') || lower.includes('preliminary') || /\bweek\s*[1-5]\b/i.test(lower)) {
            return 'Prelim';
        }
        if (lower.includes('midterm') || lower.includes('mid-term') || /\bweek\s*[6-9]\b/i.test(lower)) {
            return 'Midterm';
        }
        if (lower.includes('prefi') || lower.includes('pre-final') || lower.includes('prefinal') || /\bweek\s*(1[0-4])\b/i.test(lower)) {
            return 'Prefi';
        }
        if (lower.includes('final') || lower.includes('finals') || /\bweek\s*(1[5-9]|20)\b/i.test(lower)) {
            return 'Final';
        }
        return null;
    }

    // Calculates answer count breakdown per term (Prelim, Midterm, Prefi, Final)
    function getSubjectTermBreakdown(subCode) {
        const questions = getCachedAnswers(subCode) || [];
        const stats = {
            prelim: 0,
            midterm: 0,
            prefi: 0,
            final: 0,
            general: 0,
            total: questions.length
        };

        questions.forEach(q => {
            const term = q.period || q.term || detectTermFromText(q.sourceQuiz || q.quizTitle || q.question || q.qRaw || '');
            if (term === 'Prelim') stats.prelim++;
            else if (term === 'Midterm') stats.midterm++;
            else if (term === 'Prefi') stats.prefi++;
            else if (term === 'Final') stats.final++;
            else stats.general++;
        });

        return stats;
    }

    // Detects all enrolled courses visible on the Moodle dashboard or course catalog
    function detectDashboardCourses() {
        const results = [];
        const seen = new Set();
        const courseCards = document.querySelectorAll(`
            .dashboard-card,
            [data-region="card-item"],
            .course-info-container,
            .card.dashboard-card,
            .coursename,
            [data-region="course-content"],
            .coursebox
        `);

        courseCards.forEach(card => {
            const titleElem = card.querySelector('.coursename, .coursename .multiline, h3, h4, .text-truncate, a') || card;
            const cardText = (titleElem.innerText || card.innerText || '').trim();
            if (!cardText) return;

            let subCode = '';
            const codeMatch = cardText.match(/-\s*([A-Za-z0-9]+) /) || cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
            if (codeMatch) {
                subCode = codeMatch[1].toUpperCase();
            }

            if (subCode && subCode !== 'DEFAULT' && subCode !== 'GENERAL' && !seen.has(subCode)) {
                seen.add(subCode);
                const cached = getCachedAnswers(subCode);
                results.push({
                    code: subCode,
                    count: cached ? cached.length : 0,
                    title: cardText.split('\n')[0].trim()
                });
            }
        });

        return results;
    }

    // Injects verified DB indicators on home/dashboard course cards
    function injectDashboardCourseBadges() {
        if (!isUserLoggedIn()) return;

        const courseCards = document.querySelectorAll(`
            .dashboard-card,
            [data-region="card-item"],
            .course-info-container,
            .card.dashboard-card,
            .coursename,
            [data-region="course-content"],
            .coursebox
        `);

        if (courseCards.length === 0) return;

        courseCards.forEach(card => {
            if (card.querySelector('.amaes-home-db-badge')) return;

            const titleElem = card.querySelector('.coursename, .coursename .multiline, h3, h4, .text-truncate, a') || card;
            const cardText = (titleElem.innerText || card.innerText || '').trim();
            if (!cardText) return;

            let subCode = '';
            const codeMatch = cardText.match(/-\s*([A-Za-z0-9]+) /) || cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
            if (codeMatch) {
                subCode = codeMatch[1].toUpperCase();
            }

            if (!subCode) return;

            const cached = getCachedAnswers(subCode);
            const count = cached ? cached.length : 0;
            const termStats = getSubjectTermBreakdown(subCode);
            const readyTerms = [];
            if (termStats.prelim > 0) readyTerms.push('Prelim');
            if (termStats.midterm > 0) readyTerms.push('Mid');
            if (termStats.prefi > 0) readyTerms.push('Prefi');
            if (termStats.final > 0) readyTerms.push('Final');

            const badge = document.createElement('div');
            badge.className = 'amaes-home-db-badge';
            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-top: 6px;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.15s ease, background 0.15s ease;
                user-select: none;
                z-index: 10;
                ${count >= 100 || readyTerms.length === 4
                    ? 'background: rgba(16, 185, 129, 0.2); border: 1.5px solid #10b981; color: #10b981;' 
                    : count > 0 
                    ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399;' 
                    : 'background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); color: #94a3b8;'}
            `;

            if (readyTerms.length === 4 || count >= 100) {
                badge.innerHTML = `${ICONS.checkBadge} <span><b>All Terms Ready</b> • ${count} Qs</span>`;
                badge.title = `${subCode}: Complete question bank covering Prelim, Midterm, Prefi & Final (${count} verified questions)`;
            } else if (readyTerms.length > 0) {
                badge.innerHTML = `${ICONS.database} <span><b>${readyTerms.join('/')} Ready</b> • ${count} Qs</span>`;
                badge.title = `${subCode}: ${readyTerms.join(', ')} covered (${count} questions). Click to open DB.`;
            } else if (count > 0) {
                badge.innerHTML = `${ICONS.database} <span><b>Verified DB</b> • ${count} Qs</span>`;
                badge.title = `${subCode}: ${count} questions verified in local DB. Click to view.`;
            } else {
                badge.innerHTML = `${ICONS.cloudDownload} <span>${subCode} • Check Cloud Hub</span>`;
                badge.title = `Click to auto-pull community answers for ${subCode}`;
            }

            badge.onmouseenter = () => { badge.style.transform = 'translateY(-1px)'; };
            badge.onmouseleave = () => { badge.style.transform = 'translateY(0)'; };

            badge.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const panel = document.getElementById('amaes-toolkit-panel');
                if (panel) {
                    panel.style.display = 'flex';
                    const tabBtnDb = document.querySelector('.amaes-tab-btn[data-tab="db"]');
                    if (tabBtnDb) tabBtnDb.click();
                    setLog(`Selected course <b>${subCode}</b> (${count} answers in DB).`, "var(--accent-blue)");
                    if (count === 0 && typeof autoFetchCloudAnswersIfMissing === 'function') {
                        autoFetchCloudAnswersIfMissing(subCode);
                    }
                }
            };

            const targetContainer = card.querySelector('.course-info-container, .card-body, [data-region="course-content"]') || card;
            targetContainer.appendChild(badge);
        });
    }

    // Displays an onboarding callout banner on the Moodle dashboard for new users
    function injectDashboardGuideBanner() {
        if (!isUserLoggedIn()) return;
        if (!window.location.pathname.includes('/my/') && !window.location.pathname.includes('courses.php')) return;
        if (document.getElementById('amaes-dashboard-guide-banner')) return;
        if (localStorage.getItem('amaes_guide_banner_dismissed') === 'true') return;

        const allDbs = getAllSavedSubjectDatabases();
        const totalCached = Object.values(allDbs).reduce((acc, list) => acc + (list ? list.length : 0), 0);
        if (totalCached > 50) return;

        const container = document.querySelector('#region-main, .course-wrapper, [data-region="courses-view"], .dashboard-card-deck') || document.body;
        if (!container) return;

        const dashCourses = detectDashboardCourses();
        const courseCount = dashCourses.length;

        const banner = document.createElement('div');
        banner.id = 'amaes-dashboard-guide-banner';
        banner.style.cssText = `
            margin: 12px 0;
            padding: 10px 14px;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-left: 4px solid var(--accent-blue, #3b82f6);
            border-radius: 8px;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 11.5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            z-index: 10;
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span style="display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.2); color: #60a5fa; width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;">
                    ${ICONS.cloudDownload}
                </span>
                <div>
                    <div style="font-weight: 700; color: #fff; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>Auto-Sync Database Ready</span>
                        <span style="font-size: 9.5px; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 1px 6px; border-radius: 4px; font-weight: 700;">100% Autonomous</span>
                    </div>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">
                        ${courseCount > 0
                            ? `Detected <b>${courseCount} courses</b> (${dashCourses.map(c => c.code).join(', ')}). Open any course to auto-sync answers, or click below to pull verified databases now!`
                            : 'Open any enrolled course to automatically sync verified questions and answers from the community database!'}
                    </div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                ${courseCount > 0 ? `
                    <button id="btn-banner-sync-all" class="amaes-btn amaes-btn-green" style="font-size: 10.5px; padding: 5px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        ${ICONS.zap} <span>Sync All Courses Now</span>
                    </button>
                ` : ''}
                <button id="btn-banner-dismiss-guide" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 2px 6px; line-height: 1;" title="Dismiss">&times;</button>
            </div>
        `;

        if (container === document.body) {
            banner.style.position = 'fixed';
            banner.style.top = '60px';
            banner.style.right = '20px';
            banner.style.maxWidth = '460px';
            banner.style.zIndex = '9999';
            document.body.appendChild(banner);
        } else {
            container.insertBefore(banner, container.firstChild);
        }

        const dismissBtn = banner.querySelector('#btn-banner-dismiss-guide');
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                localStorage.setItem('amaes_guide_banner_dismissed', 'true');
                banner.remove();
            };
        }

        const syncAllBtn = banner.querySelector('#btn-banner-sync-all');
        if (syncAllBtn) {
            syncAllBtn.onclick = () => {
                syncAllBtn.disabled = true;
                syncAllBtn.innerHTML = `${ICONS.rotateCcw} <span>Syncing...</span>`;
                let completed = 0;
                let totalFound = 0;
                dashCourses.forEach(c => {
                    syncAnswersFromCloud(c.code).then(res => {
                        if (res && res.count) totalFound += res.count;
                    }).finally(() => {
                        completed++;
                        if (completed === dashCourses.length) {
                            showToast(`Auto-sync complete! Loaded ${totalFound} answers across ${completed} courses.`);
                            injectDashboardCourseBadges();
                            syncAllBtn.innerHTML = `${ICONS.check} <span>Synced!</span>`;
                            setTimeout(() => {
                                banner.remove();
                            }, 2500);
                        }
                    });
                });
            };
        }
    }

    // ==========================================
    // Course & Activity Detection
    // ==========================================

    function detectCourseInfo() {
        let fullTitle = '';

        const heading = document.querySelector('.page-header-headings h1, #page-header h1, .page-header-title, .breadcrumb-item:nth-last-child(2) a');
        if (heading && heading.innerText.trim()) {
            fullTitle = heading.innerText.trim();
        }

        if (!fullTitle || !fullTitle.includes('-')) {
            const breadcrumbLinks = document.querySelectorAll('.breadcrumb-item a, nav.breadcrumb a');
            for (const link of breadcrumbLinks) {
                const text = link.innerText.trim();
                if (text.includes('-')) {
                    fullTitle = text;
                    break;
                }
            }
        }

        if (!fullTitle || !fullTitle.includes('-')) {
            fullTitle = document.title || '';
        }

        let subjectCode = '';
        let subjectName = '';

        const codeMatch = fullTitle.match(/-\s*([A-Za-z0-9]+)\b/) || fullTitle.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
        if (codeMatch) {
            subjectCode = codeMatch[1].toUpperCase();

            const codeIndex = fullTitle.indexOf(codeMatch[1]);
            if (codeIndex !== -1) {
                const remainder = fullTitle.substring(codeIndex + codeMatch[1].length).trim();
                subjectName = remainder.replace(/^[:\-–\s]+/, '').split('|')[0].trim();
            } else {
                subjectName = fullTitle.replace(codeMatch[1], '').replace(/^[:\-–\s]+/, '').trim();
            }
        }

        let currentActivityTitle = '';
        if (window.location.pathname.includes('/mod/quiz/')) {
            const quizHeader = document.querySelector('.page-header-headings h1, #region-main h2, #region-main h3');
            if (quizHeader) {
                currentActivityTitle = quizHeader.innerText.trim();
            }
        }

        return {
            fullTitle,
            subjectCode,
            subjectName,
            currentActivityTitle
        };
    }

    function checkIsCoursePage() {
        return window.location.pathname.includes('/course/view.php') ||
               window.location.pathname.includes('/mod/') ||
               Boolean(document.querySelector('.course-content, .course-section, #region-main .activity, .activity-item, .que'));
    }

    function checkIsQuizPage() {
        return window.location.pathname.includes('/mod/quiz/attempt.php') ||
               window.location.pathname.includes('/mod/quiz/summary.php') ||
               window.location.pathname.includes('/mod/quiz/review.php') ||
               Boolean(document.querySelector('.que, .quizsummarytable, #region-main .summarytable'));
    }

    function checkIsReviewPage() {
        return window.location.pathname.includes('/mod/quiz/review.php');
    }

    function checkIsQuizAttemptPage() {
        return window.location.pathname.includes('/mod/quiz/attempt.php');
    }

    function checkIsQuizSummaryPage() {
        return window.location.pathname.includes('/mod/quiz/summary.php') ||
               Boolean(document.querySelector('.quizsummarytable, #region-main .summarytable'));
    }

    // String Normalization for Question & Answer Matching
    function normalizeText(str) {
        if (!str) return '';
        // Unescape HTML entities
        const doc = new DOMParser().parseFromString(str, 'text/html');
        let text = doc.body.textContent || '';
        text = text.toLowerCase().trim();
        // Remove question numbering like "1.", "question 1:"
        text = text.replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        // Strip multiple underscores down to single placeholder
        text = text.replace(/_{2,}/g, '___');
        // Strip extra whitespace
        text = text.replace(/\s+/g, ' ');
        // Strip trailing punctuation
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    function normalizeChoice(str) {
        if (!str) return '';
        const doc = new DOMParser().parseFromString(str, 'text/html');
        let text = doc.body.textContent || '';
        text = text.toLowerCase().trim();
        // Normalize unicode dashes/minus signs to standard hyphen
        text = text.replace(/[\u2212\u2013\u2014]/g, '-');
        // Remove prefix like "select one: ", "a. ", "b) " safely without stripping negative signs
        text = text.replace(/^select one:?\s*/i, '').replace(/^[a-e][.)]\s*/i, '');
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    // Normalize and structure eliminated wrong choices with weighting & deduplication
    function normalizeWrongAnswers(rawWrong) {
        if (!rawWrong || !Array.isArray(rawWrong)) return [];
        return rawWrong.map(item => {
            if (typeof item === 'string') {
                const clean = item.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = normalizeChoice(clean);
                if (!norm) return null;
                return { text: clean, norm: norm, count: 1, sources: [] };
            }
            if (typeof item === 'object' && item) {
                const txt = (item.text || item.ansRaw || item.choice || '').replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = item.norm || normalizeChoice(txt);
                if (!norm) return null;
                return {
                    text: txt,
                    norm: norm,
                    count: typeof item.count === 'number' ? item.count : (typeof item.weight === 'number' ? item.weight : 1),
                    sources: Array.isArray(item.sources) ? item.sources : []
                };
            }
            return null;
        }).filter(Boolean);
    }

    // ==========================================
    // AMAUOED Engine (Fetch, Cache & Match)
    // ==========================================

    // Cross-origin safe HTTP fetch using GM_xmlhttpRequest
    function fetchAmauoedPage(url) {
        return new Promise((resolve, reject) => {
            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            if (gmReq) {
                gmReq({
                    method: "GET",
                    url: url,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    onload: function (res) {
                        if (res.status >= 200 && res.status < 300) {
                            resolve(res.responseText);
                        } else {
                            reject(new Error(`HTTP ${res.status}: ${res.statusText}`));
                        }
                    },
                    onerror: function (err) {
                        reject(err);
                    }
                });
            } else {
                fetch(url)
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.text();
                    })
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    // Extract questions and correct answers from AMAUOED HTML
    function parseAmauoedHtml(html) {
        const results = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const cards = doc.querySelectorAll('.card.mb-2, .card-body');
        cards.forEach(card => {
            const qElem = card.querySelector('.mb-2, h5');
            if (!qElem) return;

            const qRaw = qElem.innerText.trim();
            const qNorm = normalizeText(qRaw);
            if (!qNorm) return;

            // Correct answer element with chip "Correct"
            let ansRaw = "";
            const correctChip = card.querySelector('.chip.bg-success, span.bg-success');
            if (correctChip) {
                const li = correctChip.closest('li') || correctChip.parentElement;
                if (li) {
                    // Clone to remove chip text
                    const clone = li.cloneNode(true);
                    const ch = clone.querySelector('.chip, span');
                    if (ch) ch.remove();
                    ansRaw = clone.innerText.trim();
                }
            } else {
                // Fallback: check strong tag inside li
                const strong = card.querySelector('li strong');
                if (strong) ansRaw = strong.innerText.trim();
            }

            if (ansRaw) {
                const ansNorm = normalizeChoice(ansRaw);
                results.push({
                    qRaw,
                    qNorm,
                    ansRaw,
                    ansNorm,
                    source: 'amauoed'
                });
            }
        });

        return results;
    }

    // Crawl all pages of an AMAUOED course URL
    async function loadAllAmauoedAnswers(baseUrl, onProgress) {
        // Strip query params to get clean base URL
        const cleanBase = baseUrl.split('?')[0];
        let allQuestions = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 12) { // safety limit 12 pages
            const pageUrl = page === 1 ? cleanBase : `${cleanBase}?page=${page}`;
            if (onProgress) onProgress(page, allQuestions.length);

            try {
                logDebug(`Fetching amauoed page ${page}: ${pageUrl}`);
                const html = await fetchAmauoedPage(pageUrl);
                const questions = parseAmauoedHtml(html);

                if (questions.length === 0) {
                    hasMore = false;
                    break;
                }

                allQuestions = allQuestions.concat(questions);

                // Check if there is a next page in pagination
                const hasNextPage = html.includes(`page=${page + 1}`) || html.includes(`page=${page + 1}"`);
                if (!hasNextPage) {
                    hasMore = false;
                } else {
                    page++;
                    // Polite delay between pages
                    await new Promise(r => setTimeout(r, 400));
                }
            } catch (err) {
                console.error("Error loading page:", err);
                hasMore = false;
            }
        }

        return allQuestions;
    }

    // Automatic Subject Matcher for AMAUOED Course Links
    function checkUrlCourseMatch(url, courseInfo) {
        if (!url || !url.trim()) {
            return {
                status: 'empty',
                html: '<span style="color:var(--text-muted);">Paste the amauoed.com link for this subject above.</span>'
            };
        }

        const cleanUrl = url.trim().toLowerCase();
        if (!cleanUrl.includes('amauoed.com/courses/')) {
            return {
                status: 'invalid',
                html: '<span style="color:var(--accent-pink); font-weight:600;">Invalid link: Must start with https://amauoed.com/courses/...</span>'
            };
        }

        const currentCode = (courseInfo && courseInfo.subjectCode ? courseInfo.subjectCode.toUpperCase() : '');
        const currentCodeNum = currentCode.replace(/\D+/g, '');
        const currentCodePrefix = currentCode.replace(/\d+/g, '').trim().toLowerCase();

        // Extract department and slug from amauoed URL
        const match = cleanUrl.match(/\/courses\/([a-z0-9_-]+)\/([^/?#]+)/i);
        if (!match) {
            return {
                status: 'unknown',
                html: '<span style="color:var(--accent-amber);">Unable to parse course slug from link.</span>'
            };
        }

        const dept = match[1].toLowerCase();
        const slug = match[2].toLowerCase();
        const numMatch = slug.match(/(\d{3,4})/);
        const urlNum = numMatch ? numMatch[1] : '';
        const urlCode = (dept + urlNum).toUpperCase();

        const presetUrl = getStoredAmauoedUrl(currentCode);
        const numMatches = Boolean(currentCodeNum && urlNum && currentCodeNum === urlNum);
        const deptMatches = Boolean(currentCodePrefix && dept && (currentCodePrefix === dept || dept.includes(currentCodePrefix) || currentCodePrefix.includes(dept)));

        if (numMatches && deptMatches) {
            return {
                status: 'match',
                html: `<span style="color:var(--accent-green); font-weight:600;">Verified Match: Link belongs to ${currentCode}!</span>`
            };
        }

        let fixBtn = '';
        if (presetUrl && presetUrl !== cleanUrl) {
            fixBtn = ` <a href="#" id="btn-fix-amauoed-url" style="color:var(--accent-blue); text-decoration:underline; margin-left:4px; font-weight:700;">Switch to ${currentCode} Link</a>`;
        }

        if (numMatches && !deptMatches) {
            return {
                status: 'mismatch',
                html: `<span style="color:var(--accent-pink); font-weight:600;">Subject Mismatch: Link is for <b>${urlCode}</b>, but you are in <b>${currentCode}</b>!</span>${fixBtn}`
            };
        }

        return {
            status: 'mismatch',
            html: `<span style="color:var(--accent-pink); font-weight:600;">Subject Mismatch: Link (${urlCode || slug.substring(0, 16)}) doesn't match <b>${currentCode || 'current course'}</b>.</span>${fixBtn}`
        };
    }

    // Storage helpers & Known AMAUOED Catalog
    const KNOWN_AMAUOED_COURSES = {
        'CS6301': 'https://amauoed.com/courses/cs/logic-design-and-digital-computer-circuits-6301-cs',
        'ITE6301': 'https://amauoed.com/courses/ite/technopreneurship-6301-ite',
        'ITE6300': 'https://amauoed.com/courses/ite/cloud-computing-and-the-internet-of-things-6300-ite',
        'ITE6200': 'https://amauoed.com/courses/ite/application-development-and-emerging-technology-6200-ite',
        'ITE6201': 'https://amauoed.com/courses/ite/data-structures-and-algorithm-analysis-6201-ite',
        'ITE6100': 'https://amauoed.com/courses/ite/introduction-to-computing-6100-ite',
        'ITE6102': 'https://amauoed.com/courses/ite/computer-programming-1-6102-ite',
        'ITE6104': 'https://amauoed.com/courses/ite/computer-programming-2-6104-ite',
        'ITE6220': 'https://amauoed.com/courses/ite/information-management-6220-ite',
        'CS6202': 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs',
        'CS6204': 'https://amauoed.com/courses/cs/computer-architecture-and-organization-6204-cs',
        'CS6205': 'https://amauoed.com/courses/cs/automata-theory-and-formal-language-6205-cs',
        'CS6206': 'https://amauoed.com/courses/cs/principles-of-operating-systems-and-its-applications-6206-cs',
        'CS6209': 'https://amauoed.com/courses/cs/software-engineering-1-6209-cs',
        'CS6300': 'https://amauoed.com/courses/cs/software-engineering-2-6300-cs',
        'CS6309': 'https://amauoed.com/courses/cs/introduction-to-machine-learning-6309-cs',
        'CS6326': 'https://amauoed.com/courses/cs/mobile-application-development-6326-cs',
        'MATH6100': 'https://amauoed.com/courses/math/calculus-1-6100-math',
        'GE6107': 'https://amauoed.com/courses/ge/ethics-6107-ge',
        'GE6115': 'https://amauoed.com/courses/ge/art-appreciation-6115-ge',
        'ETHNS6101': 'https://amauoed.com/courses/ethns/euthenics-1-6101-ethns',
        'ETHNS6102': 'https://amauoed.com/courses/ethns/euthenics-2-6102-ethns'
    };

    function getStoredAmauoedUrl(code) {
        if (!code) return "";
        const clean = code.toUpperCase().trim();
        const stored = localStorage.getItem(`amaes_amauoed_url_${clean}`);
        if (stored) return stored;

        if (KNOWN_AMAUOED_COURSES[clean]) {
            return KNOWN_AMAUOED_COURSES[clean];
        }

        // Check dynamic directory cache if populated
        try {
            const dir = JSON.parse(localStorage.getItem('amaes_known_amauoed_directory') || '{}');
            if (dir[clean]) return dir[clean];
        } catch (e) {}

        const num = clean.replace(/\D+/g, '');
        for (const [k, url] of Object.entries(KNOWN_AMAUOED_COURSES)) {
            if (num && k.includes(num)) {
                if (clean.includes('CS') && k.includes('CS')) return url;
                if (clean.includes('ITE') && k.includes('ITE')) return url;
            }
        }
        return "";
    }

    function setStoredAmauoedUrl(code, url) {
        localStorage.setItem(`amaes_amauoed_url_${code}`, url);
    }

    // Auto-Search & Discover AMAUOED Link from Online Directory
    async function autoFindAmauoedLink(code, courseTitle = '') {
        if (!code) {
            setLog('No subject code detected to search', 'var(--accent-pink)', 'Plan: Open a course or quiz page first');
            return null;
        }

        const cleanCode = code.toUpperCase().trim();
        const codeNum = cleanCode.replace(/\D+/g, '');
        const codeDept = cleanCode.replace(/\d+/g, '').toLowerCase();

        setLog(`Searching amauoed.com catalog for ${cleanCode}...`, 'var(--accent-blue)', 'Plan: Crawl course directory and harvest question bank');

        // Check stored or built-in first
        const direct = getStoredAmauoedUrl(cleanCode);
        if (direct) {
            setStoredAmauoedUrl(cleanCode, direct);
            setLog(`Auto-matched known link for ${cleanCode}!`, 'var(--accent-green)', 'Plan: Ready to fetch and sync question database');
            return direct;
        }

        // Live crawl of amauoed.com/courses directory
        try {
            const html = await fetchAmauoedPage('https://amauoed.com/courses');
            const urlMatches = html.match(/https:\/\/amauoed\.com\/courses\/[a-z0-9_-]+\/[a-z0-9_-]+/gi) || [];
            const uniqueUrls = Array.from(new Set(urlMatches));

            // Populate dynamic directory
            const dir = {};
            uniqueUrls.forEach(u => {
                const parts = u.split('/');
                const dept = parts[parts.length - 2].toLowerCase();
                const slug = parts[parts.length - 1].toLowerCase();
                const m = slug.match(/(\d{3,4})/);
                if (m) {
                    const foundKey = (dept + m[1]).toUpperCase();
                    dir[foundKey] = u;
                }
            });
            localStorage.setItem('amaes_known_amauoed_directory', JSON.stringify(dir));

            let match = null;

            // 1. Strict key match in directory
            if (dir[cleanCode]) match = dir[cleanCode];

            // 2. Number + Dept match
            if (!match && codeNum) {
                for (const u of uniqueUrls) {
                    const lower = u.toLowerCase();
                    if (lower.includes(`-${codeNum}-`)) {
                        if (codeDept && (lower.includes(`/${codeDept}/`) || lower.endsWith(`-${codeDept}`))) {
                            match = u;
                            break;
                        }
                        if (!match) match = u;
                    }
                }
            }

            // 3. Title keyword match
            if (!match && courseTitle) {
                const words = courseTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
                for (const u of uniqueUrls) {
                    const slug = u.split('/').pop().toLowerCase();
                    const hits = words.filter(w => slug.includes(w));
                    if (hits.length >= 2) {
                        match = u;
                        break;
                    }
                }
            }

            if (match) {
                setStoredAmauoedUrl(cleanCode, match);
                setLog(`Found & verified link for ${cleanCode}!`, 'var(--accent-green)', 'Plan: Saved to database. Ready to fetch.');
                return match;
            } else {
                setLog(`No exact amauoed link found for ${cleanCode}`, 'var(--accent-amber)', 'Plan: Paste link manually or check Google');
                return null;
            }
        } catch (err) {
            console.error('AMAUOED auto-find error:', err);
            setLog(`Auto-search failed: Network error`, 'var(--accent-pink)', 'Plan: Check internet connection or enter link manually');
            return null;
        }
    }

    function getCachedAnswers(code) {
        const raw = localStorage.getItem(`amaes_amauoed_cache_${code}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function setCachedAnswers(code, questions) {
        localStorage.setItem(`amaes_amauoed_cache_${code}`, JSON.stringify(questions));
    }

    // ==========================================
    // Robust Quiz Navigation & Autonomous Solver Engine
    // ==========================================

    // Inspect Moodle Quiz Navigation block to detect answered vs unanswered questions
    function getQuizNavQuestionStates() {
        const navBlock = document.querySelector('#mod_quiz_navblock, .block_quiz_navigation, .qn_buttons');
        if (!navBlock) return null;

        const buttons = Array.from(navBlock.querySelectorAll('.qnbutton, a[id^="quiznavbutton"], button[id^="quiznavbutton"]'));
        if (buttons.length === 0) return null;

        const questionList = [];
        let currentIndex = -1;

        buttons.forEach((btn, idx) => {
            const isCurrent = btn.classList.contains('thispage') || btn.getAttribute('aria-current') === 'true';
            if (isCurrent) currentIndex = idx;

            // In Moodle, answered questions have class .answersaved, or title/aria-label containing "Answer saved"
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const hasAnswerSavedClass = btn.classList.contains('answersaved');
            const isAnswered = hasAnswerSavedClass || title.includes('answer saved') || ariaLabel.includes('answer saved');

            const qNum = parseInt(btn.innerText.trim(), 10) || (idx + 1);

            questionList.push({
                btn,
                qNum,
                index: idx,
                isCurrent,
                isAnswered
            });
        });

        // Find the next UNANSWERED question AFTER the current question
        let nextUnanswered = null;
        if (currentIndex >= 0) {
            for (let i = currentIndex + 1; i < questionList.length; i++) {
                if (!questionList[i].isAnswered) {
                    nextUnanswered = questionList[i];
                    break;
                }
            }
            // If none ahead, wrap around to check earlier skipped questions
            if (!nextUnanswered) {
                for (let i = 0; i < currentIndex; i++) {
                    if (!questionList[i].isAnswered) {
                        nextUnanswered = questionList[i];
                        break;
                    }
                }
            }
        }

        const totalUnanswered = questionList.filter(q => !q.isAnswered).length;
        const totalAnswered = questionList.length - totalUnanswered;

        return {
            navBlock,
            questions: questionList,
            currentIndex,
            nextUnanswered,
            totalUnanswered,
            totalAnswered,
            totalQuestions: questionList.length,
            allAnswered: totalUnanswered === 0
        };
    }

    // Helper to find the Next Page button on Moodle Quiz Attempt page
    function findQuizNextButton() {
        // 1. Primary: Next button inside Moodle's submitbtns or responseform
        let btn = document.querySelector(
            '#responseform .submitbtns input[name="next"], ' +
            '#responseform .submitbtns button[name="next"], ' +
            '#responseform .submitbtns input[type="submit"]:not([name="previous"]):not([value*="Previous"]), ' +
            '#responseform .submitbtns button:not([name="previous"]):not(.btn-secondary), ' +
            '.submitbtns input[name="next"], ' +
            '.submitbtns button[name="next"], ' +
            '.submitbtns input[value*="Next"], ' +
            '.submitbtns button[value*="Next"], ' +
            'input[name="next"].mod_quiz-next-nav, ' +
            '#mod_quiz-next-nav, ' +
            '.mod_quiz-next-nav'
        );

        // 2. If on the final question, look for "Finish attempt ..."
        if (!btn) {
            btn = document.querySelector(
                '#responseform .submitbtns input[value*="Finish attempt"], ' +
                '#responseform .submitbtns button[value*="Finish attempt"], ' +
                '.submitbtns input[value*="Finish attempt"], ' +
                '.submitbtns button[value*="Finish attempt"], ' +
                'input[value*="Finish attempt"], ' +
                'button[value*="Finish attempt"], ' +
                'input[value*="Finish"], ' +
                'button[value*="Finish"]'
            );
        }

        // 3. Fallback: Any submit button inside responseform that does not navigate backwards
        if (!btn) {
            const submits = document.querySelectorAll('#responseform input[type="submit"], #responseform button[type="submit"]');
            for (const s of submits) {
                const val = (s.value || s.innerText || '').toLowerCase();
                if (!val.includes('prev') && !val.includes('back')) {
                    btn = s;
                    break;
                }
            }
        }

        return btn;
    }

    // Check whether every question on the current attempt page has an answer selected/entered
    function areAllPageQuestionsAnswered() {
        const queList = document.querySelectorAll('.que');
        if (queList.length === 0) return false;

        for (const que of queList) {
            // 1. Radio: check if any radio in question is checked
            const radios = que.querySelectorAll('.answer input[type="radio"]');
            if (radios.length > 0) {
                const anyChecked = Array.from(radios).some(r => r.checked);
                if (!anyChecked) return false;
                continue;
            }

            // 2. Checkbox: check if any checkbox in question is checked
            const checkboxes = que.querySelectorAll('.answer input[type="checkbox"]');
            if (checkboxes.length > 0) {
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                if (!anyChecked) return false;
                continue;
            }

            // 3. Select dropdowns (matching questions)
            const selects = que.querySelectorAll('select');
            if (selects.length > 0) {
                const allSelected = Array.from(selects).every(s => s.value && s.value !== '0' && s.value !== '');
                if (!allSelected) return false;
                continue;
            }

            // 4. Text input / textarea (shortanswer questions)
            const textInputs = que.querySelectorAll('input[type="text"].form-control, input.form-control, textarea');
            if (textInputs.length > 0) {
                const allFilled = Array.from(textInputs).every(inp => inp.value && inp.value.trim().length > 0);
                if (!allFilled) return false;
                continue;
            }

            // 5. Moodle state classes
            if (que.classList.contains('answered') || que.classList.contains('complete')) {
                continue;
            }

            // Fallback: unrecognized question type with no checked answer
            return false;
        }

        return true;
    }

    // Schedule automatic advancement to next page (or summary) after question(s) on current page are answered
    function scheduleAutoNextAfterAnswer(delayMs = 800) {
        if (!autoNextQuiz) return;
        if (!checkIsQuizAttemptPage()) return;
        if (!areAllPageQuestionsAnswered()) return;

        const nextBtn = findQuizNextButton();
        if (!nextBtn) return;

        const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
        const isFinish = btnText.includes('finish') || btnText.includes('submit');

        clearTimeout(autoNextTimer);

        if (isFinish) {
            setLog("<b>All Questions Answered!</b> Advancing to summary in <b>1.0s</b>...", "var(--accent-green)");
            showToast("All questions answered! Advancing to summary in 1s...", 1500);
        } else {
            setLog("<b>Question Answered:</b> Advancing to next page in <b>0.8s</b>...", "var(--accent-blue)");
            showToast("Answer selected! Advancing to next page...", 1200);
        }

        autoNextTimer = setTimeout(() => {
            if (!autoNextQuiz) return;
            clickQuizNextButton(nextBtn, true);
        }, delayMs);
    }

    // Bind event listeners to question inputs to trigger auto-next immediately when choices are selected
    function setupQuizAnswerListeners() {
        if (!checkIsQuizAttemptPage()) return;
        const inputs = document.querySelectorAll(
            '.que .answer input[type="radio"], .que .answer input[type="checkbox"], .que select'
        );
        inputs.forEach(inp => {
            if (inp.dataset.amaesAutoNextBound) return;
            inp.dataset.amaesAutoNextBound = 'true';
            inp.addEventListener('change', () => {
                if (autoNextQuiz) {
                    scheduleAutoNextAfterAnswer(inp.type === 'checkbox' ? 1200 : 800);
                }
            });
        });

        const textInputs = document.querySelectorAll(
            '.que input[type="text"].form-control, .que input.form-control, .que textarea'
        );
        textInputs.forEach(inp => {
            if (inp.dataset.amaesAutoNextBound) return;
            inp.dataset.amaesAutoNextBound = 'true';
            inp.addEventListener('blur', () => {
                if (autoNextQuiz && inp.value && inp.value.trim().length > 0) {
                    scheduleAutoNextAfterAnswer(1000);
                }
            });
        });
    }

    // Fail-safe click & smart navigation executor (skips already-answered questions)
    function clickQuizNextButton(btn, forceAllow = false) {
        if (!autoQuizMode && !forceAllow && !autoNextQuiz) {
            logDebug("Blocked clickQuizNextButton: Auto-Quiz is PAUSED.");
            return false;
        }

        // SMART NAVIGATION: If smart skip is enabled, jump directly to next unanswered question!
        if (smartSkipQuiz) {
            const navState = getQuizNavQuestionStates();
            if (navState && navState.nextUnanswered && navState.nextUnanswered.btn) {
                const target = navState.nextUnanswered;
                logDebug(`Smart Jump: Bypassing answered questions, jumping directly to Question #${target.qNum}`);
                setLog(`[Skip] <b>Smart Skip:</b> Jumping to unanswered <b>Question #${target.qNum}</b> (${navState.totalUnanswered} remaining)...`, "var(--accent-blue)");
                showToast(`Smart Jump: Question #${target.qNum}`, 1800);

                target.btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                try {
                    target.btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    target.btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    target.btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } catch (e) {}
                target.btn.click();
                return true;
            } else if (navState && navState.allAnswered) {
                // All questions on the entire quiz are answered! Proceed to finish attempt
                const finishBtn = document.querySelector(
                    '.submitbtns input[value*="Finish attempt"], .submitbtns button[value*="Finish attempt"], input[value*="Finish attempt"], a.endtestlink, #mod_quiz_navblock a[href*="summary.php"]'
                );
                if (finishBtn) {
                    logDebug("Smart Navigation: All questions answered! Proceeding to finish attempt.");
                    setLog("<b>All Questions Answered!</b> Proceeding to summary screen...", "var(--accent-green)");
                    showToast("All questions answered! Finishing attempt...", 2500);
                    finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    finishBtn.click();
                    return true;
                }
            }
        }

        if (!btn) {
            logDebug("Cannot navigate: Next button not found on page.");
            return false;
        }
        logDebug(`Executing Quiz Next Navigation: ${btn.value || btn.innerText || btn.name}`);

        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.focus();

        // Dispatch realistic user click event
        try {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } catch (e) {
            console.warn("MouseEvent dispatch error:", e);
        }

        // Native click call
        btn.click();
        return true;
    }

    let isSolverRunning = false;

    async function runAutoQuizSolver(forceRun = false) {
        if (!checkIsQuizAttemptPage()) return;

        // STRICT PAUSE CHECK: If Auto-Quiz is not explicitly active or force-run, halt completely
        const isAutoActive = forceRun || autoQuizMode;
        if (!isAutoActive || !autoQuizMode) {
            logDebug("Auto Quiz Solver is PAUSED. Suppressing auto-clicks and auto-navigation.");
            clearTimeout(autoNextTimer);
            autoNextTimer = null;
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = null;
            isSolverRunning = false;
            return;
        }

        if (isSolverRunning) return;
        isSolverRunning = true;

        try {
            const courseInfo = detectCourseInfo();
            const subCode = courseInfo.subjectCode || 'CS6301';
            const cached = getCachedAnswers(subCode);
            const queContainers = document.querySelectorAll('.que');

            if (queContainers.length === 0) {
                isSolverRunning = false;
                return;
            }

            // 1. Highlight and Auto-Select verified answers from database (ONLY click if autoQuizMode is true)
            let res = { matched: 0, total: queContainers.length };

            // AUTO-FETCH FROM CLOUD DATABASE FALLBACK: If local cache is empty, check cloud DB automatically!
            if (!cached || cached.length === 0) {
                logDebug(`Local cache empty for ${subCode}. Checking community cloud database...`);
                setLog(`Checking community cloud database for <b>${subCode}</b>...`, "var(--accent-blue)");
                try {
                    const cloudRes = await syncAnswersFromCloud(subCode);
                    const freshCached = getCachedAnswers(subCode);
                    if (freshCached && freshCached.length > 0) {
                        cached = freshCached;
                        setLog(`Auto-loaded <b>${freshCached.length}</b> verified answers from Cloud DB!`, "var(--accent-green)");
                        showToast(`Loaded ${freshCached.length} answers from Cloud!`);
                        syncAutoQuizUI();
                    }
                } catch (e) {
                    logDebug(`Cloud Sync fallback note: ${e.message}`);
                }
            }

            if (cached && cached.length > 0) {
                res = highlightQuizAnswers(cached, autoPickQuiz && autoQuizMode);
            } else {
                setLog(`<b>No Answers in DB:</b> Open amauoed or click Cloud Sync for <b>${subCode}</b>!`, "var(--accent-amber)");
            }

            // 2. Identify questions verified by the database vs unverified/unknown questions
            const unverifiedQuestions = [];
            queContainers.forEach(que => {
                const hasVerifiedBadge = que.querySelector('.amaes-verified-badge');
                const hasShortAnsHint = que.querySelector('.amaes-shortans-hint');
                if (!hasVerifiedBadge && !hasShortAnsHint) {
                    unverifiedQuestions.push(que);
                }
            });

            const nextBtn = findQuizNextButton();

            // =====================================================================
            // PERSONALITY 1: AGGRESSIVE (Speedrun: Auto-Pick, Skip Unknown, Auto-Next)
            // =====================================================================
            if (quizPersonality === 'aggressive') {
                if (unverifiedQuestions.length > 0) {
                    setLog(`<b>Speedrun Mode:</b> Skipped ${unverifiedQuestions.length} unknown question(s).`, "var(--accent-amber)");
                    showToast(`Speedrun: Skipped ${unverifiedQuestions.length} unknown question(s)`, 1800);
                    unverifiedQuestions.forEach(que => {
                        que.style.outline = '2px dashed var(--accent-amber, #f59e0b)';
                        que.style.borderRadius = '8px';
                    });
                } else {
                    setLog(`<b>Speedrun Mode:</b> All ${res.total} question(s) verified & picked!`, "var(--accent-green)");
                }

                // In Aggressive mode, ALWAYS auto-advance even if questions were skipped
                if (nextBtn) {
                    const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
                    const isFinish = btnText.includes('finish') || btnText.includes('submit');

                    clearTimeout(autoNextTimer);
                    if (isFinish) {
                        setLog(`<b>Speedrun:</b> Finishing attempt in <b>1.0s</b>...`, "var(--accent-green)");
                        showToast("Finishing attempt...", 2500);
                    } else {
                        setLog(`<b>Speedrun:</b> Auto-Next in <b>1.0s</b>...`, "var(--accent-blue)");
                    }

                    autoNextTimer = setTimeout(() => {
                        if (!autoQuizMode) return;
                        clickQuizNextButton(nextBtn);
                    }, 1000);
                } else {
                    setLog("Next page button not found.", "var(--accent-pink)");
                }
                isSolverRunning = false;
                return;
            }

            // =====================================================================
            // PERSONALITY 2: PASSIVE (Interactive Co-Pilot: Auto-Pick & Next IF Known, WAIT if Unknown)
            // =====================================================================
            if (quizPersonality === 'passive') {
                // Case A: 100% of questions on this page were verified & answered by database!
                if (unverifiedQuestions.length === 0 && res.total > 0) {
                    setLog(`All <b>${res.total}</b> question(s) verified & picked!`, "var(--accent-green)");

                    if (autoNextQuiz && nextBtn) {
                        const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
                        const isFinish = btnText.includes('finish') || btnText.includes('submit');

                        clearTimeout(autoNextTimer);
                        if (isFinish) {
                            if (autoSubmitQuiz) {
                                setLog(`<b>All Questions Answered!</b> Advancing to summary in 1.2s...`, "var(--accent-green)");
                                showToast("Finishing attempt...", 3000);
                                autoNextTimer = setTimeout(() => {
                                    if (!autoQuizMode) return;
                                    clickQuizNextButton(nextBtn);
                                }, 1200);
                            } else {
                                setLog("<b>Last Question Answered!</b> Paused for review before final submit.", "var(--accent-green)");
                                showToast("Last question answered! Review before submitting.", 4000);
                            }
                            isSolverRunning = false;
                            return;
                        }

                        setLog(`[Auto-Next] <b>Auto-Next:</b> Advancing to next question in <b>1.0s</b>...`, "var(--accent-blue)");
                        autoNextTimer = setTimeout(() => {
                            if (!autoQuizMode) return;
                            clickQuizNextButton(nextBtn);
                        }, 1000);
                    }
                    isSolverRunning = false;
                    return;
                }

                // Case B: UNKNOWN QUESTION DETECTED (Auto-solver cannot answer it!)
                // In Passive Co-Pilot mode: DO NOT AUTO-NEXT! Wait for user to pick and click Next!
                clearTimeout(autoNextTimer);

                const firstBlockedQue = unverifiedQuestions[0];
                const qData = extractQuestionData(firstBlockedQue);
                const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                const aiPromptText = formatQuestionForAI(firstBlockedQue, aiPromptHint);

                // Auto-copy for AI
                copyToClipboard(aiPromptText).then(() => {
                    const ctxLabel = willIncludeContext ? 'with Course Context' : 'for AI';
                    showToast(`Question #${qData ? qData.qNum : ''} not in DB: Auto-copied ${ctxLabel}!`);
                }).catch(() => {});

                setLog(
                    `<b>Co-Pilot Paused:</b> Question #${qData ? qData.qNum : ''} not in DB (auto-copied ${willIncludeContext ? 'with Course Context' : 'for AI'}). ` +
                    `Select your answer and click <b>Next page</b> when ready.`,
                    "var(--accent-amber)"
                );

                firstBlockedQue.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstBlockedQue.style.outline = '2.5px solid #f59e0b';
                firstBlockedQue.style.borderRadius = '8px';

                const navState = getQuizNavQuestionStates();

                if (!firstBlockedQue.querySelector('.amaes-blockage-hud')) {
                    const hud = document.createElement('div');
                    hud.className = 'amaes-blockage-hud';
                    hud.style.cssText = `
                        margin-bottom: 14px;
                        padding: 10px 14px;
                        background: #fffbeb;
                        border: 1.5px solid #f59e0b;
                        border-radius: 8px;
                        font-size: 11.5px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        color: #78350f;
                        box-shadow: 0 2px 5px rgba(245, 158, 11, 0.08);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        line-height: 1.4;
                        box-sizing: border-box;
                    `;

                    hud.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
                            <span style="background: #f59e0b; color: #ffffff; padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px; flex-shrink: 0;">WAITING</span>
                            <div>
                                <div style="font-weight: 700; color: #92400e;">Question #${qData ? qData.qNum : ''} not in DB & auto-copied to clipboard.</div>
                                <div style="color: #b45309; font-size: 11px;">Paste in AI, select answer (or press <b>V</b> to auto-select), then press <b>N</b> or click <b>Next page</b> below.</div>
                            </div>
                        </div>
                    `;

                    const formulation = firstBlockedQue.querySelector('.formulation, .content') || firstBlockedQue;
                    formulation.insertBefore(hud, formulation.firstChild);
                }

                // Listen for user selecting a choice: show visual confirmation and auto-advance if enabled
                const inputElements = firstBlockedQue.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"]');
                const onUserPickedChoice = () => {
                    firstBlockedQue.style.outline = '2px solid #10b981';
                    const hud = firstBlockedQue.querySelector('.amaes-blockage-hud');
                    if (hud) {
                        hud.style.borderColor = '#10b981';
                        hud.style.background = '#ecfdf5';
                        hud.style.color = '#065f46';

                        hud.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
                                <span style="background: #10b981; color: #ffffff; padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 10px;">READY</span>
                                <div>
                                    <div style="font-weight: 700; color: #065f46;">Answer selected!</div>
                                    <div style="color: #047857; font-size: 11px;">${autoNextQuiz ? 'Advancing to next page automatically...' : 'Press <b>N</b> or click <b>Next page</b> below to proceed.'}</div>
                                </div>
                            </div>
                        `;
                    }
                    if (autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(800);
                    } else {
                        showToast("Answer picked! Press N or click Next page.");
                        setLog("Answer selected! Press <b>N</b> or click <b>Next page</b> below to proceed.", "var(--accent-green)");
                    }
                };

                inputElements.forEach(inp => {
                    inp.addEventListener('change', onUserPickedChoice);
                    if (inp.type === 'text') {
                        inp.addEventListener('blur', onUserPickedChoice);
                    }
                });

                isSolverRunning = false;
                return;
            }
        } catch (err) {
            logDebug(`Auto-Solver Error: ${err.message}`);
            console.error("Auto-Solver Exception:", err);
        } finally {
            setTimeout(() => { isSolverRunning = false; }, 1200);
        }
    }

    // Auto-Mark as Done / Submit Handler for Quiz Summary Page (/mod/quiz/summary.php)
    function handleQuizSummaryAutoSubmit() {
        if (!checkIsQuizSummaryPage()) return;

        // Auto-submit if autoSubmitQuiz is enabled
        if (!autoSubmitQuiz) {
            logDebug("Quiz Summary auto-submit paused because Auto-Submit Quiz is disabled.");
            return;
        }

        // Safety check: ensure questions were answered in summary table
        const summaryRows = Array.from(document.querySelectorAll('.quizsummarytable tr, #region-main .summarytable tr'));
        const incompleteRows = summaryRows.filter(tr => {
            const statusCell = tr.querySelector('.status');
            return statusCell && /not yet answered|not answered|incomplete/i.test(statusCell.innerText);
        });

        if (incompleteRows.length > 0 && quizPersonality !== 'aggressive' && !autoQuizMode) {
            setLog(`<b>Quiz Summary:</b> ${incompleteRows.length} question(s) not answered yet. Paused for review.`, "var(--accent-amber)");
            showToast(`Paused: ${incompleteRows.length} unanswered question(s). Click Submit manually if ready.`, 4000);
            return;
        }

        const submitBtn = document.querySelector(
            '.btn-finishattempt, input[value*="Submit all and finish"], button[type="submit"][name="finishattempt"], form[action*="summary.php"] button[type="submit"], #responseform button[type="submit"]'
        );

        if (submitBtn) {
            setLog("<b>Auto-Next to Review:</b> Submitting quiz attempt in <b>1.0s</b> to open review...", "var(--accent-green)");
            showToast("All answers saved! Submitting to review in 1s...", 2500);

            setTimeout(() => {
                if (!autoSubmitQuiz) return;
                submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                submitBtn.click();

                // Handle Moodle confirmation modal dialogue
                const confirmInterval = setInterval(() => {
                    if (!autoSubmitQuiz) {
                        clearInterval(confirmInterval);
                        return;
                    }
                    const modalBtn = document.querySelector(
                        '.moodle-dialogue-confirm .btn-primary, .modal.show .btn-primary, input.btn-primary[value*="Submit all"], div[role="dialog"] button.btn-primary, .modal-footer .btn-primary'
                    );
                    if (modalBtn) {
                        clearInterval(confirmInterval);
                        setLog("Confirming final submission to reach review screen...", "var(--accent-green)");
                        modalBtn.click();
                    }
                }, 300);

                setTimeout(() => clearInterval(confirmInterval), 6000);
            }, 1000);
        }
    }

    // Unified Synchronizer for UI states (Floating HUD + Panel Button)
    function syncAutoQuizUI() {
        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            btnMasterAutoQuiz.style.background = autoQuizMode
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #10b981, #059669)';
            btnMasterAutoQuiz.innerHTML = autoQuizMode
                ? `${ICONS.stop} <span>Pause Auto-Quiz</span>`
                : `${ICONS.zap} <span>Start Auto-Quiz</span>`;
        }

        const existingHud = document.getElementById('amaes-quiz-hud');
        if (existingHud) {
            existingHud.remove();
        }
        if (checkIsQuizAttemptPage()) {
            injectQuizFloatingHUD();
        }
    }

    // Master Toggle Function for Starting / Pausing Autonomous Quiz
    function toggleAutoQuizMode(desiredState = null) {
        if (desiredState !== null) {
            autoQuizMode = Boolean(desiredState);
        } else {
            autoQuizMode = !autoQuizMode;
        }
        localStorage.setItem('amaes_auto_quiz_mode', autoQuizMode ? 'true' : 'false');

        if (autoQuizMode) {
            showToast(`Auto-Quiz Started (${quizPersonality.toUpperCase()})`);
            setLog(`Auto-Quiz <b>started</b> in <b>${quizPersonality.toUpperCase()}</b> mode!`, "var(--accent-green)");
            if (checkIsQuizAttemptPage()) runAutoQuizSolver(true);
            if (checkIsQuizSummaryPage()) handleQuizSummaryAutoSubmit();
        } else {
            clearTimeout(autoNextTimer);
            autoNextTimer = null;
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = null;
            isSolverRunning = false;
            showToast("Auto-Quiz Paused");
            setLog("Auto-Quiz <b>paused</b>. Auto-answers & auto-navigation completely stopped.", "var(--accent-amber)");
        }

        syncAutoQuizUI();
    }

    // Floating HUD for Quiz Attempt Screen
    function injectQuizFloatingHUD() {
        if (!checkIsQuizAttemptPage()) return;
        if (document.getElementById('amaes-quiz-hud')) return;

        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        const detectedQuizTerm = detectTermFromText(courseInfo.currentActivityTitle || document.title || '');
        const cached = getCachedAnswers(subCode);
        const hasDb = cached && cached.length > 0;
        const verifiedCount = cached ? cached.filter(q => q.ansRaw || q.answer).length : 0;
        const eliminatedCount = cached ? cached.reduce((acc, q) => acc + (Array.isArray(q.wrongAnswers) ? q.wrongAnswers.length : 0), 0) : 0;
        const termStats = getSubjectTermBreakdown(subCode);
        const termCount = detectedQuizTerm === 'Prelim' ? termStats.prelim :
                          detectedQuizTerm === 'Midterm' ? termStats.midterm :
                          detectedQuizTerm === 'Prefi' ? termStats.prefi :
                          detectedQuizTerm === 'Final' ? termStats.final : 0;
        const navState = getQuizNavQuestionStates();

        const hud = document.createElement('div');
        hud.id = 'amaes-quiz-hud';
        hud.style.cssText = `
            position: fixed;
            bottom: 22px;
            left: 22px;
            z-index: 99998;
            background: var(--surface, #1e293b);
            border: 1.5px solid ${autoQuizMode ? (quizPersonality === 'aggressive' ? '#ec4899' : '#3b82f6') : 'var(--border, #334155)'};
            border-radius: 30px;
            padding: 6px 14px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            color: var(--text-primary, #f8fafc);
            backdrop-filter: blur(8px);
        `;

        const isAgg = quizPersonality === 'aggressive';

        hud.innerHTML = `
            <!-- Auto-Quiz Status -->
            <div style="display: flex; align-items: center; gap: 6px;">
                <span id="hud-pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${autoQuizMode ? (isAgg ? '#ec4899' : '#3b82f6') : '#64748b'}; box-shadow: 0 0 8px ${autoQuizMode ? (isAgg ? '#ec4899' : '#3b82f6') : 'transparent'};"></span>
                <span style="font-weight: 700;">Auto-Quiz:</span>
                <span id="hud-mode-text" style="color: ${autoQuizMode ? (isAgg ? 'var(--accent-pink, #ec4899)' : 'var(--accent-blue, #3b82f6)') : '#94a3b8'}; font-weight: 700;">
                    ${autoQuizMode ? (isAgg ? 'Speedrun' : 'Co-Pilot') : 'Paused'}
                </span>
            </div>

            <!-- Course Database Badge -->
            <div id="hud-db-indicator" style="
                background: ${hasDb ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                color: ${hasDb ? '#10b981' : '#f87171'};
                border: 1px solid ${hasDb ? '#10b981' : '#f87171'};
                padding: 2px 7px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 4px;
            " title="${hasDb ? `${subCode} DB: ${verifiedCount} total verified answers & ${eliminatedCount} eliminated choices stored${detectedQuizTerm ? ` (${termCount} for ${detectedQuizTerm})` : ''}` : `No database answers found for ${subCode}`}">
                <span>${hasDb ? 'DB' : 'No DB'}</span>
                <span>${subCode}${detectedQuizTerm ? ` • ${detectedQuizTerm}` : ''}</span>
                <span>(${termCount > 0 ? `${termCount} Qs` : `${verifiedCount} Qs`}${eliminatedCount > 0 ? ` • ${eliminatedCount} Elim` : ''})</span>
            </div>

            <!-- Start / Pause Button -->
            <button id="btn-hud-toggle-quiz" class="amaes-inline-btn" style="padding: 3px 10px; font-size: 10px; background: ${autoQuizMode ? 'rgba(239,68,68,0.25); color:#ef4444; border:1px solid #ef4444' : 'rgba(16,185,129,0.25); color:#10b981; border:1px solid #10b981'}; border-radius: 12px; cursor: pointer; font-weight: 600;">
                ${autoQuizMode ? 'Pause' : 'Start'}
            </button>

            <!-- Quick Keys Hint Strip -->
            <div style="display: flex; align-items: center; gap: 5px; font-size: 9.5px; color: var(--text-muted, #94a3b8); border-left: 1px solid rgba(255,255,255,0.15); padding-left: 8px;" title="Tips: [N] / [Space] Next Page • [1-4] / [A-D] Pick Choice • [C] Copy for AI • [V] Paste AI • [P] Pause">
                <span style="font-weight: 700; color: #a78bfa;">Tips:</span>
                <span style="color: #cbd5e1;"><kbd style="background: rgba(255,255,255,0.12); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 9px; font-weight: 700; color: #fff;">N</kbd> Next</span>
                <span style="color: #cbd5e1;"><kbd style="background: rgba(255,255,255,0.12); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 9px; font-weight: 700; color: #fff;">1-4</kbd> Pick</span>
                <span style="color: #cbd5e1;"><kbd style="background: rgba(255,255,255,0.12); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 9px; font-weight: 700; color: #fff;">C</kbd> AI</span>
            </div>

            <!-- Toggle Toolkit Panel -->
            <button id="btn-hud-expand-panel" class="amaes-inline-btn" style="padding: 3px 8px; font-size: 10px; background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; cursor: pointer;" title="Toggle Full Toolkit Panel">
                ${ICONS.minimize} <span>Panel</span>
            </button>
        `;

        document.body.appendChild(hud);

        const _el__btn_hud_toggle_quiz_ = document.getElementById('btn-hud-toggle-quiz');
        if (_el__btn_hud_toggle_quiz_) _el__btn_hud_toggle_quiz_.onclick = () => {;
            toggleAutoQuizMode();
        };

        const hudPanelBtn = document.getElementById('btn-hud-expand-panel');
        if (hudPanelBtn) {
            hudPanelBtn.onclick = () => {
                const bodyEl = document.getElementById('amaes-panel-body');
                const minBtn = document.getElementById('amaes-min-btn');
                if (!bodyEl) return;
                const isHidden = bodyEl.style.display === 'none';
                bodyEl.style.display = isHidden ? 'block' : 'none';
                if (minBtn) minBtn.innerHTML = isHidden ? ICONS.minimize : `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                `;
            };
        }
    }

    // Auto-select choice based on AI answer from clipboard (Shortcut: V or Button)
    async function autoSelectFromAiClipboard(explicitQue = null) {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            showToast("Clipboard reading not supported in this browser");
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                showToast("Clipboard is empty. Copy the AI answer first.");
                return;
            }
            const questions = Array.from(document.querySelectorAll('.que'));
            if (questions.length === 0) {
                showToast("No quiz question found on page");
                return;
            }

            const targetQue = explicitQue || questions.find(q => {
                const rect = q.getBoundingClientRect();
                return rect.top >= 0 && rect.top <= (window.innerHeight || 800);
            }) || questions.find(q => !q.classList.contains('answered') && !q.classList.contains('complete')) || questions[0];

            if (!targetQue) return;

            const cleanText = text.trim();
            const inputElements = Array.from(targetQue.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]'));
            if (inputElements.length === 0) {
                showToast("No multiple choice inputs found for this question");
                return;
            }

            // 1. Direct letter matching: Look for option letter (A, B, C, D)
            const matchLetter = cleanText.match(/(?:^|\b)(?:answer|option|choice|the correct answer is)?\s*[:\-–*]*\s*([a-dA-D])(?:\.|\)|:|\s|$)/i);
            if (matchLetter && matchLetter[1]) {
                const letter = matchLetter[1].toUpperCase();
                const idx = letter.charCodeAt(0) - 65;
                if (inputElements[idx]) {
                    inputElements[idx].click();
                    showToast(`Auto-selected Option ${letter} from AI clipboard`);
                    setLog(`AI Paste: Selected Option <b>${letter}</b> from clipboard`, "var(--accent-green)");
                    if (autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(800);
                    }
                    return;
                }
            }

            // 2. Fuzzy text matching: match clipboard text with choice labels
            const normClip = normalizeText(cleanText);
            let bestInput = null;
            let bestScore = 0;
            let bestLabel = '';

            inputElements.forEach((inp, idx) => {
                const container = inp.closest('div, li, label') || inp.parentElement;
                const choiceText = container ? container.innerText.trim() : '';
                const normChoice = normalizeText(choiceText);
                if (!normChoice) return;

                if (normClip.includes(normChoice) || normChoice.includes(normClip)) {
                    if (normChoice.length > bestScore) {
                        bestScore = normChoice.length;
                        bestInput = inp;
                        bestLabel = String.fromCharCode(65 + idx);
                    }
                } else {
                    const cWords = normChoice.split(/\s+/).filter(w => w.length > 2);
                    const matchedWords = cWords.filter(w => normClip.includes(w));
                    const score = matchedWords.length / Math.max(1, cWords.length);
                    if (score > 0.6 && score > bestScore) {
                        bestScore = score;
                        bestInput = inp;
                        bestLabel = String.fromCharCode(65 + idx);
                    }
                }
            });

            if (bestInput) {
                bestInput.click();
                showToast(`Auto-selected ${bestLabel} from AI text match`);
                setLog(`AI Paste: Auto-matched choice <b>${bestLabel}</b> from clipboard`, "var(--accent-green)");
                if (autoNextQuiz) {
                    scheduleAutoNextAfterAnswer(800);
                }
            } else {
                showToast("Could not match AI response to any option. Select manually.");
                setLog("AI Paste: Clipboard did not clearly match any choice.", "var(--accent-amber)");
            }
        } catch (err) {
            logDebug("Clipboard read error: " + err);
            showToast("Clipboard access denied or unavailable");
        }
    }

    // Toggleable Keyboard Navigation & Fast Shortcuts for Quiz
    function setupQuizKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (!enableKeyboardShortcuts) return;

            // Strict safety: ignore hotkeys ONLY when actively typing in text input fields
            const active = document.activeElement;
            if (active) {
                const tag = active.tagName ? active.tagName.toUpperCase() : '';
                const type = active.type ? active.type.toLowerCase() : '';
                const isTextInput = (tag === 'INPUT' && !['radio', 'checkbox', 'button', 'submit', 'reset'].includes(type)) ||
                                    tag === 'TEXTAREA' ||
                                    active.isContentEditable;
                if (isTextInput) return;
            }

            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (!checkIsQuizAttemptPage()) return;

            const key = e.key ? e.key.toUpperCase() : '';

            // 1. Next Page / Submit Navigation: 'N' or 'Space' or 'Enter'
            if (key === 'N' || key === ' ' || key === 'ENTER') {
                const nextBtn = findQuizNextButton();
                if (nextBtn) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') {
                        active.blur();
                    }
                    showToast("Shortcut: Next Page");
                    setLog("Keyboard shortcut triggered: <b>Next Page</b>", "var(--accent-blue)");
                    nextBtn.click();
                }
                return;
            }

            // 2. Copy Current Question for AI: 'C'
            if (key === 'C') {
                const btnCopy = document.getElementById('btn-copy-curr-q');
                if (btnCopy) {
                    e.preventDefault();
                    btnCopy.click();
                } else {
                    const queList = document.querySelectorAll('.que');
                    if (queList.length > 0) {
                        e.preventDefault();
                        const text = formatQuestionForAI(queList[0], aiPromptHint);
                        copyToClipboard(text);
                        showToast("Shortcut: Question copied for AI");
                    }
                }
                return;
            }

            // 3. Paste AI Answer & Auto-Select: 'V'
            if (key === 'V') {
                e.preventDefault();
                autoSelectFromAiClipboard();
                return;
            }

            // 4. Pause / Start Auto-Quiz: 'P'
            if (key === 'P') {
                e.preventDefault();
                toggleAutoQuizMode();
                return;
            }

            // 5. Highlight Database Answers: 'H'
            if (key === 'H') {
                const hlBtn = document.getElementById('btn-quick-hl') || document.getElementById('btn-hl-answers') || document.getElementById('btn-db-quick-highlight');
                if (hlBtn) {
                    e.preventDefault();
                    hlBtn.click();
                }
                return;
            }

            // 6. Select Choice Option: 1-4 or A-D
            let optIndex = -1;
            if (key >= '1' && key <= '9') {
                optIndex = parseInt(key, 10) - 1;
            } else if (['A', 'B', 'C', 'D'].includes(key)) {
                optIndex = key.charCodeAt(0) - 65;
            }

            if (optIndex >= 0) {
                const questions = Array.from(document.querySelectorAll('.que'));
                if (questions.length === 0) return;

                // Target question currently in view or first unanswered
                let targetQue = questions.find(q => {
                    const rect = q.getBoundingClientRect();
                    return rect.top >= 0 && rect.top <= (window.innerHeight || 800);
                }) || questions.find(q => !q.classList.contains('answered') && !q.classList.contains('complete')) || questions[0];

                if (targetQue) {
                    const choices = Array.from(targetQue.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]'));
                    if (choices[optIndex]) {
                        e.preventDefault();
                        choices[optIndex].click();
                        const choiceLabel = key >= '1' && key <= '9' ? String.fromCharCode(65 + optIndex) : key;
                        showToast(`Shortcut: Selected Choice ${choiceLabel}`);
                        setLog(`Keyboard shortcut: Selected choice <b>${choiceLabel}</b>`, "var(--accent-blue)");
                        if (autoNextQuiz) {
                            scheduleAutoNextAfterAnswer(800);
                        }
                    }
                }
            }
        });
    }

    // Match questions & auto-highlight / auto-select on Moodle Quiz
    function highlightQuizAnswers(questionsDb, autoSelect = false, isManualSelect = false) {
        if (!questionsDb || questionsDb.length === 0) {
            return { matched: 0, total: 0, error: "No cached questions found" };
        }

        const queContainers = document.querySelectorAll('.que');
        if (queContainers.length === 0) {
            return { matched: 0, total: 0, error: "Not on a quiz question page" };
        }

        let matchedCount = 0;

        queContainers.forEach(que => {
            const qtextElem = que.querySelector('.qtext, .formulation .qtext');
            if (!qtextElem) return;

            const moodleQRaw = qtextElem.innerText.trim();
            const moodleQNorm = normalizeText(moodleQRaw);

            // Find all matching questions from amauoed (handles multiple answers for same question)
            const candidates = questionsDb.filter(item => {
                if (item.qNorm === moodleQNorm) return true;
                // Fuzzy: check high overlap or substring
                if (item.qNorm.length > 20 && (item.qNorm.includes(moodleQNorm) || moodleQNorm.includes(item.qNorm))) return true;
                return false;
            });

            if (candidates.length === 0) return;
            // Sort candidates by verification and consensus confirmations descending
            candidates.sort((a, b) => ((b.verified ? 10 : 0) + (b.confirmations || 1)) - ((a.verified ? 10 : 0) + (a.confirmations || 1)));

            // Clean up any prior highlighting or elimination badges on this question
            que.querySelectorAll('.amaes-highlighted-choice, .amaes-eliminated-choice').forEach(el => {
                el.classList.remove('amaes-highlighted-choice');
                el.classList.remove('amaes-eliminated-choice');
                el.style.outline = '';
                el.style.backgroundColor = '';
                el.style.borderRadius = '';
                el.style.padding = '';
                el.style.margin = '';
                el.style.display = '';
                el.style.alignItems = '';
                el.style.flexWrap = '';
                el.style.gap = '';
                el.style.width = '';
                el.style.boxSizing = '';
                const lbl = el.querySelector('label') || el;
                if (lbl) {
                    lbl.style.textDecoration = '';
                    lbl.style.opacity = '';
                }
            });
            que.querySelectorAll('.amaes-verified-badge, .amaes-eliminated-badge, .amaes-probability-hint').forEach(b => b.remove());

            // Compile all eliminated wrong choices known for this question
            const allWrongList = [];
            candidates.forEach(cand => {
                if (Array.isArray(cand.wrongAnswers)) {
                    cand.wrongAnswers.forEach(w => {
                        const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                        const wCount = typeof w === 'object' && typeof w.count === 'number' ? w.count : 1;
                        if (wNorm && !allWrongList.some(item => item.norm === wNorm)) {
                            allWrongList.push({ norm: wNorm, text: typeof w === 'string' ? w : w.text, count: wCount });
                        }
                    });
                }
            });

            // Target each choice row container cleanly
            let choiceRows = que.querySelectorAll('.answer > div.r0, .answer > div.r1, .answer > div, .answer li, .answer tr');
            if (choiceRows.length === 0) {
                choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer li, .answer tr');
            }
            if (choiceRows.length === 0) {
                choiceRows = que.querySelectorAll('.answer label');
            }
            const isRadio = que.querySelector('.answer input[type="radio"]') !== null;
            let foundMatchForQuestion = false;

            choiceRows.forEach(row => {
                // If it is a single-choice radio question and we already highlighted the top verified answer, avoid double-highlighting
                if (isRadio && foundMatchForQuestion) return;

                const label = row.querySelector('label') || row;
                const input = row.querySelector('input[type="radio"], input[type="checkbox"]');
                
                // Extract clean text without badges
                let rawText = '';
                if (row.querySelector('.amaes-verified-badge, .amaes-eliminated-badge')) {
                    const clone = label.cloneNode(true);
                    clone.querySelectorAll('.amaes-verified-badge, .amaes-eliminated-badge, .amaes-probability-hint').forEach(b => b.remove());
                    rawText = clone.innerText;
                } else {
                    rawText = label.innerText;
                }
                const choiceText = normalizeChoice(rawText);

                // 1. Check against verified candidate answers
                for (const cand of candidates) {
                    const ansNorm = cand.ansNorm || normalizeChoice(cand.ansRaw || cand.answer || '');
                    if (!ansNorm) continue;
                    const isDirectMatch = choiceText === ansNorm;
                    const isMultiAnswerMatch = (ansNorm.includes(',') || ansNorm.includes(';') || ansNorm.includes('&')) &&
                        ansNorm.split(/[,;&]+/).map(s => normalizeChoice(s)).includes(choiceText);

                    if (isDirectMatch || isMultiAnswerMatch) {
                        foundMatchForQuestion = true;

                        const isAmauoed = cand.source === 'amauoed';
                        const isDeduced = cand.deduced === true;
                        const sourceColor = isDeduced ? '#10b981' : (isAmauoed ? '#0284c7' : '#10b981');
                        const sourceBg = isDeduced ? 'rgba(16, 185, 129, 0.15)' : (isAmauoed ? 'rgba(2, 132, 199, 0.12)' : 'rgba(16, 185, 129, 0.14)');
                        const sourceBadgeClass = isAmauoed ? 'amaes-badge-amauoed' : 'amaes-badge-db';
                        const sourceIcon = isDeduced ? ICONS.lightbulb : (isAmauoed ? ICONS.external : ICONS.checkCircle);
                        const confSuffix = (cand.confirmations && cand.confirmations > 1) ? ` (${cand.confirmations}x)` : '';
                        const sourceLabel = isDeduced ? `Deduced • 100% Prob${confSuffix}` : (isAmauoed ? `AMAUOED • 95% Prob${confSuffix}` : `Verified • 100% Prob${confSuffix}`);

                        // Apply full row highlight on container
                        const targetRow = row;
                        targetRow.classList.add('amaes-highlighted-choice');
                        targetRow.style.outline = `2px solid ${sourceColor}`;
                        targetRow.style.backgroundColor = sourceBg;
                        targetRow.style.boxShadow = `0 0 0 1px ${sourceColor}33`;
                        targetRow.style.borderRadius = '6px';
                        targetRow.style.padding = '6px 12px';
                        targetRow.style.margin = '4px 0';
                        targetRow.style.display = 'flex';
                        targetRow.style.alignItems = 'center';
                        targetRow.style.flexWrap = 'wrap';
                        targetRow.style.gap = '8px';
                        targetRow.style.width = '100%';
                        targetRow.style.boxSizing = 'border-box';
                        targetRow.style.transition = 'all 0.2s ease';

                        // Reset inner label so it doesn't constrain width or wrap oddly
                        if (label !== targetRow) {
                            label.style.outline = 'none';
                            label.style.backgroundColor = 'transparent';
                            label.style.padding = '0';
                            label.style.margin = '0';
                            label.style.display = 'inline-flex';
                            label.style.alignItems = 'center';
                            label.style.gap = '6px';
                            label.style.cursor = 'pointer';
                        }

                        // Prevent internal <p> tags from forcing line breaks
                        targetRow.querySelectorAll('p').forEach(p => {
                            p.style.display = 'inline';
                            p.style.margin = '0';
                            p.style.padding = '0';
                        });

                        // Add source badge if not already present
                        let badge = targetRow.querySelector('.amaes-verified-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = `amaes-verified-badge ${sourceBadgeClass}`;
                            badge.innerHTML = `${sourceIcon} <span>${sourceLabel}</span>`;
                            badge.style.cssText = `
                                background: ${sourceColor};
                                color: #ffffff;
                                font-size: 10px;
                                font-weight: 700;
                                padding: 2px 7px;
                                border-radius: 4px;
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.18);
                                white-space: nowrap;
                                flex-shrink: 0;
                            `;
                            targetRow.appendChild(badge);
                        }

                        // Auto-select radio button ONLY if autoSelect is true AND (autoQuizMode is active OR user manually clicked Auto-Pick)
                        const canSelectAnswer = autoSelect && (autoQuizMode || isManualSelect);
                        if (canSelectAnswer && input && !input.checked) {
                            input.click();
                        }

                        break;
                    }
                }

                // 2. Check if choice is confirmed WRONG (elimination)
                if (!foundMatchForQuestion && allWrongList.length > 0) {
                    const matchedWrong = allWrongList.find(w => w.norm === choiceText);
                    if (matchedWrong) {
                        const targetRow = row;
                        targetRow.classList.add('amaes-eliminated-choice');
                        targetRow.style.outline = '1.5px solid #ef4444';
                        targetRow.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                        targetRow.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.18)';
                        targetRow.style.borderRadius = '6px';
                        targetRow.style.padding = '5px 10px';
                        targetRow.style.margin = '4px 0';
                        targetRow.style.display = 'flex';
                        targetRow.style.alignItems = 'center';
                        targetRow.style.flexWrap = 'wrap';
                        targetRow.style.gap = '8px';
                        targetRow.style.width = '100%';
                        targetRow.style.boxSizing = 'border-box';
                        targetRow.style.transition = 'all 0.2s ease';

                        if (label !== targetRow) {
                            label.style.textDecoration = 'line-through';
                            label.style.opacity = '0.6';
                        }

                        let badge = targetRow.querySelector('.amaes-eliminated-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'amaes-eliminated-badge';
                            const countText = matchedWrong.count > 1 ? `Wrong (${matchedWrong.count}x) • 0% Prob` : 'Wrong • 0% Prob';
                            badge.innerHTML = `${ICONS.xCircle} <span>${countText}</span>`;
                            badge.title = `Attempt or classmate history confirmed this choice is incorrect`;
                            badge.style.cssText = `
                                background: #ef4444;
                                color: #ffffff;
                                font-size: 9.5px;
                                font-weight: 700;
                                padding: 2px 7px;
                                border-radius: 4px;
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                box-shadow: 0 1px 2px rgba(0,0,0,0.15);
                                white-space: nowrap;
                                flex-shrink: 0;
                            `;
                            targetRow.appendChild(badge);
                        }
                    }
                }
            });

            // 3. Real-Time Deduction by Elimination: If all choices except 1 are eliminated, deduce the remaining 1 as correct!
            if (!foundMatchForQuestion && choiceRows.length >= 2) {
                const uneliminated = Array.from(choiceRows).filter(r => !r.classList.contains('amaes-eliminated-choice'));
                if (uneliminated.length === 1) {
                    const deducedRow = uneliminated[0];
                    const deducedLabel = deducedRow.querySelector('label') || deducedRow;
                    const deducedInput = deducedRow.querySelector('input[type="radio"], input[type="checkbox"]');
                    foundMatchForQuestion = true;

                    deducedRow.classList.add('amaes-highlighted-choice');
                    deducedRow.style.outline = '2px solid #10b981';
                    deducedRow.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                    deducedRow.style.borderRadius = '6px';
                    deducedRow.style.padding = '6px 12px';
                    deducedRow.style.margin = '4px 0';
                    deducedRow.style.display = 'flex';
                    deducedRow.style.alignItems = 'center';
                    deducedRow.style.flexWrap = 'wrap';
                    deducedRow.style.gap = '8px';
                    deducedRow.style.width = '100%';
                    deducedRow.style.boxSizing = 'border-box';

                    let badge = deducedRow.querySelector('.amaes-verified-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'amaes-verified-badge amaes-badge-db';
                        badge.innerHTML = `${ICONS.lightbulb} <span>Deduced • 100% Prob</span>`;
                        badge.style.cssText = `
                            background: linear-gradient(135deg, #10b981, #059669);
                            color: #ffffff;
                            font-size: 10px;
                            font-weight: 700;
                            padding: 2px 7px;
                            border-radius: 4px;
                            margin-left: auto;
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
                            white-space: nowrap;
                            flex-shrink: 0;
                        `;
                        deducedRow.appendChild(badge);
                    }

                    const canSelectAnswer = autoSelect && (autoQuizMode || isManualSelect);
                    if (canSelectAnswer && deducedInput && !deducedInput.checked) {
                        deducedInput.click();
                    }

                    // Auto-save the deduced answer into course cache for permanent verification!
                    const deducedText = cleanDOMToAI(deducedLabel).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    if (deducedText) {
                        const courseInfo = detectCourseInfo();
                        const sCode = courseInfo.subjectCode || 'GENERAL';
                        mergeAnswersIntoCache(sCode, [{
                            qRaw: moodleQRaw,
                            qNorm: moodleQNorm,
                            ansRaw: deducedText,
                            ansNorm: normalizeChoice(deducedText),
                            choices: Array.from(choiceRows).map(r => cleanDOMToAI(r.querySelector('label') || r)),
                            verified: true,
                            deduced: true,
                            source: 'Elimination Deduction'
                        }], 'Elimination Deduction');
                    }
                } else if (uneliminated.length > 1 && uneliminated.length < choiceRows.length) {
                    // Partial elimination: display remaining probability
                    const remainingProb = Math.round(100 / uneliminated.length);
                    uneliminated.forEach(candRow => {
                        candRow.style.outline = '1.5px dashed #0284c7';
                        candRow.style.backgroundColor = 'rgba(2, 132, 199, 0.07)';
                        candRow.style.borderRadius = '6px';
                        if (!candRow.querySelector('.amaes-probability-hint')) {
                            const pHint = document.createElement('span');
                            pHint.className = 'amaes-probability-hint';
                            pHint.style.cssText = `
                                font-size: 9.5px;
                                color: #38bdf8;
                                background: rgba(56, 189, 248, 0.15);
                                border: 1px solid rgba(56, 189, 248, 0.35);
                                padding: 2px 6px;
                                border-radius: 4px;
                                margin-left: auto;
                                font-weight: 700;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                            `;
                            pHint.innerHTML = `${ICONS.target} <span>Candidate • ${remainingProb}% Prob</span>`;
                            candRow.appendChild(pHint);
                        }
                    });
                }
            }

            // Handle Short Answer / Text inputs
            if (!foundMatchForQuestion) {
                const textInput = que.querySelector('input[type="text"].form-control, input.form-control');
                if (textInput && candidates.length > 0) {
                    const bestCand = candidates[0];
                    const bestAnswer = bestCand.ansRaw;
                    const isAmauoed = bestCand.source === 'amauoed';
                    const sourceColor = isAmauoed ? '#0284c7' : '#10b981';
                    const sourceBg = isAmauoed ? 'rgba(2, 132, 199, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                    const sourceTitle = isAmauoed ? 'Suggested (amauoed.com):' : 'Suggested (Verified DB):';

                    textInput.style.outline = `2px solid ${sourceColor}`;
                    textInput.style.backgroundColor = sourceBg;

                    if (!que.querySelector('.amaes-shortans-hint')) {
                        const hint = document.createElement('div');
                        hint.className = 'amaes-shortans-hint';
                        hint.innerHTML = `<span style="color:${sourceColor}; font-weight:700;">${sourceTitle}</span> <b>${bestAnswer}</b>`;
                        hint.style.cssText = `font-size: 11px; margin-top: 4px; padding: 4px 8px; background: ${sourceBg}; border-left: 3px solid ${sourceColor}; border-radius: 4px;`;
                        textInput.parentElement.appendChild(hint);
                    }

                    const canSelectAnswer = autoSelect && (autoQuizMode || isManualSelect);
                    if (canSelectAnswer && !textInput.value) {
                        textInput.value = bestAnswer;
                        textInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    foundMatchForQuestion = true;
                }
            }

            if (foundMatchForQuestion) matchedCount++;
        });

        return { matched: matchedCount, total: queContainers.length };
    }

    // ==========================================
    // Activity Classifier for Course Page
    // ==========================================

    function getQuizRegex() {
        return /\b(quiz|prelim|prelims|midterm|midterms|prefinal|prefinals|final|finals|exam|examination|assessment|eval)\b/i;
    }

    function getVideoRegex() {
        return /\b(video|vid|vids|watch|recording|recordings|webinar|clip|panopto|zoom|stream)\b/i;
    }

    function getLectureRegex() {
        return /\b(lec|lecture|lectures|lesson|reading|topic|module|handout|guide|discussion|notes)\b/i;
    }

    function classifyActivity(activityElem) {
        const text = (activityElem.innerText || '').toLowerCase();
        const html = activityElem.innerHTML.toLowerCase();

        // 1. Video
        const isVideoMod = Boolean(activityElem.querySelector(
            '[data-modname*="video"], [data-modtype*="video"], a[href*="youtube"], a[href*="vimeo"], a[href*="panopto"], iframe, video'
        )) || activityElem.classList.contains('modtype_videostream') || activityElem.classList.contains('modtype_kalvidres');

        const videoRegex = getVideoRegex();
        if (isVideoMod || videoRegex.test(text) || html.includes('youtube.com') || html.includes('youtu.be') || html.includes('vimeo.com')) {
            return {
                type: 'video',
                reason: isVideoMod ? 'video-mod' : 'video-keyword',
                color: 'var(--accent-purple)',
                badge: 'Video'
            };
        }

        // 2. Quiz / Exam
        const isQuizMod = activityElem.classList.contains('modtype_quiz') ||
            Boolean(activityElem.querySelector('[data-modname="quiz"], [data-modtype="quiz"], a[href*="/mod/quiz/"], img[src*="quiz"]'));

        const iconContainer = activityElem.querySelector('.activityiconcontainer, .activity-icon');
        let hasPinkIcon = false;
        let iconBgColor = '';
        if (iconContainer) {
            iconBgColor = window.getComputedStyle(iconContainer).backgroundColor;
            if (iconContainer.classList.contains('assessment') || iconContainer.classList.contains('evaluations') || iconContainer.classList.contains('bg-pink')) {
                hasPinkIcon = true;
            } else {
                const rgb = iconBgColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const [r, g, b] = rgb.map(Number);
                    if (r > 160 && b > 100 && g < 140) hasPinkIcon = true;
                }
            }
        }

        const quizRegex = getQuizRegex();
        if (isQuizMod || hasPinkIcon || quizRegex.test(text)) {
            return {
                type: 'quiz',
                reason: isQuizMod ? 'quiz-module' : hasPinkIcon ? 'pink-icon' : 'keyword',
                color: 'var(--accent-pink)',
                badge: 'Quiz'
            };
        }

        // 3. Lecture / Reading
        const isLectureMod = Boolean(activityElem.querySelector(
            '.modtype_page, .modtype_resource, .modtype_url, .modtype_book, .modtype_folder, ' +
            '[data-modname="page"], [data-modname="resource"], [data-modname="url"], [data-modname="book"], ' +
            'a[href*="/mod/page/"], a[href*="/mod/resource/"], a[href*="/mod/url/"], a[href*="/mod/book/"]'
        )) || activityElem.classList.contains('modtype_page') || activityElem.classList.contains('modtype_resource');

        let hasBlueIcon = false;
        if (iconContainer) {
            if (iconContainer.classList.contains('content') || iconContainer.classList.contains('bg-blue') || iconContainer.classList.contains('content-blue')) {
                hasBlueIcon = true;
            } else {
                const rgb = iconBgColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const [r, g, b] = rgb.map(Number);
                    if (b > 150 && b > r + 30) hasBlueIcon = true;
                }
            }
        }

        const lectureRegex = getLectureRegex();
        if (isLectureMod || hasBlueIcon || lectureRegex.test(text)) {
            return {
                type: 'lecture',
                reason: isLectureMod ? 'resource-module' : hasBlueIcon ? 'blue-icon' : 'keyword',
                color: 'var(--accent-blue)',
                badge: 'Lecture'
            };
        }

        return { type: 'lecture', reason: 'default-non-quiz', color: 'var(--accent-blue)', badge: 'Lecture' };
    }

    function findButtons(goal = 'mark_done', category = 'lecture') {
        const results = [];
        const activityElements = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
        );

        const processedButtons = new Set();

        const scanBlock = (container) => {
            const buttons = container.querySelectorAll(
                'button[data-action="toggle-manual-completion"], ' +
                'button[data-toggletype], ' +
                'button.btn-outline-secondary, ' +
                'button.btn-outline-success, ' +
                'button.btn-success, ' +
                'button'
            );

            for (const btn of buttons) {
                if (processedButtons.has(btn)) continue;

                const text = (btn.innerText || btn.getAttribute('aria-label') || '').trim().toLowerCase();
                const toggleType = (btn.getAttribute('data-toggletype') || '').toLowerCase();

                const isCurrentlyDone =
                    toggleType === 'manual:undo' ||
                    text === 'done' ||
                    text.includes('completed') ||
                    btn.classList.contains('btn-success');

                const isCurrentlyUncompleted =
                    toggleType === 'manual:mark-done' ||
                    text === 'mark as done' ||
                    text === 'to do' ||
                    text.includes('mark as done') ||
                    (btn.dataset.action === 'toggle-manual-completion' && !isCurrentlyDone);

                let matchesGoal = false;
                if (goal === 'mark_done' && isCurrentlyUncompleted && !isCurrentlyDone) {
                    matchesGoal = true;
                } else if (goal === 'undo' && isCurrentlyDone) {
                    matchesGoal = true;
                }

                if (matchesGoal) {
                    processedButtons.add(btn);
                    const classification = classifyActivity(container);
                    const titleElem = container.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                    const title = titleElem ? titleElem.innerText.trim() : (container.innerText.split('\n')[0] || 'Activity');

                    let matchesCategory = false;
                    if (category === 'all') matchesCategory = true;
                    else if (category === 'lecture' && (classification.type === 'lecture' || classification.type === 'video')) matchesCategory = true;
                    else if (category === 'quiz' && classification.type === 'quiz') matchesCategory = true;

                    if (matchesCategory) {
                        results.push({ button: btn, container, title, classification });
                    }
                }
            }
        };

        if (activityElements.length > 0) {
            activityElements.forEach(scanBlock);
        } else {
            const rawButtons = document.querySelectorAll('button[data-action="toggle-manual-completion"], button[data-toggletype]');
            rawButtons.forEach(btn => {
                const parent = btn.closest('li, div.activity, div.row, div.card') || btn.parentElement;
                scanBlock(parent);
            });
        }

        return results;
    }

    // ==========================================
    // Visual Course Highlighter
    // ==========================================

    function clearAllHighlights() {
        const highlighted = document.querySelectorAll('.amaes-highlighted-item');
        highlighted.forEach(el => {
            el.classList.remove('amaes-highlighted-item');
            el.style.outline = '';
            el.style.boxShadow = '';
            el.style.position = '';
            const badge = el.querySelector('.amaes-type-badge');
            if (badge) badge.remove();
        });
    }

    function highlightItems(targetCategory = 'all') {
        clearAllHighlights();

        if (!checkIsCoursePage()) {
            return { count: 0, error: 'Not a course page' };
        }

        const activities = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
        );

        let count = 0;
        activities.forEach(el => {
            const classification = classifyActivity(el);
            let shouldHighlight = false;

            if (targetCategory === 'all') shouldHighlight = true;
            else if (targetCategory === classification.type) shouldHighlight = true;

            if (shouldHighlight) {
                count++;
                el.classList.add('amaes-highlighted-item');
                el.style.position = 'relative';
                el.style.outline = `2px solid ${classification.color}`;
                el.style.borderRadius = '8px';
                el.style.boxShadow = `0 0 10px ${classification.color}33`;

                const badge = document.createElement('span');
                badge.className = 'amaes-type-badge';
                badge.innerText = classification.badge;
                badge.style.cssText = `
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: ${classification.color};
                    color: #ffffff;
                    font-size: 9px;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    z-index: 10;
                    pointer-events: none;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                `;
                el.appendChild(badge);
            }
        });

        return { count, targetCategory };
    }

    // ==========================================
    // Debug Report Generator
    // ==========================================

    function generateDebugReport() {
        const isCourse = checkIsCoursePage();
        const isQuiz = checkIsQuizPage();
        const courseInfo = detectCourseInfo();
        const cachedAns = getCachedAnswers(courseInfo.subjectCode);

        const report = {
            toolkitVersion: SCRIPT_VERSION,
            timestamp: new Date().toISOString(),
            theme: currentTheme,
            courseInfo,
            isQuizPage: isQuiz,
            cachedQuestionsCount: cachedAns ? cachedAns.length : 0,
            recentLogs: debugLogs.slice(-20)
        };

        return "```json\n" + JSON.stringify(report, null, 2) + "\n```";
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            try {
                GM_setClipboard(text, 'text');
                return Promise.resolve();
            } catch (e) {
                logDebug('GM_setClipboard error:', e.message);
            }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) resolve();
                else reject(new Error('execCommand copy failed'));
            } catch (err) {
                reject(err);
            }
        });
    }

    // Floating Non-intrusive Toast Notification
    function showToast(message, duration = 2400) {
        let toast = document.getElementById('amaes-toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'amaes-toast-notification';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000000;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(8px);
                color: #f8fafc;
                border: 1px solid #334155;
                padding: 8px 14px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11.5px;
                font-weight: 600;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                gap: 7px;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.25s ease, transform 0.25s ease;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `${ICONS.sparkles} <span>${message}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
        }, duration);
    }

    // Character Maps for Mathematical / Circuit Superscripts & Subscripts
    const SUP_MAP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ','x':'ˣ','y':'ʸ','m':'ᵐ','a':'ᵃ','b':'ᵇ','c':'ᶜ'};
    const SUB_MAP = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎','a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','i':'ᵢ','j':'ⱼ','n':'ₙ','p':'ₚ'};

    // Converts DOM tree to clean formatted text preserving Superscripts, Subscripts, Math, Truth Tables, and Images
    function cleanDOMToAI(rootNode) {
        if (!rootNode) return '';
        const clone = rootNode.cloneNode(true);

        // Strip non-content scripts & toolkit buttons
        clone.querySelectorAll('script, style, noscript, .amaes-verified-badge, .amaes-shortans-hint, .amaes-copy-ai-card-btn, .amaes-copy-img-card-btn').forEach(el => el.remove());

        // Convert Superscripts (e.g. 2^3 -> 2³, x^2 -> x², or ^{complex})
        clone.querySelectorAll('sup').forEach(sup => {
            const txt = sup.innerText.trim();
            if (txt) {
                if ([...txt].every(ch => ch in SUP_MAP)) {
                    sup.replaceWith([...txt].map(ch => SUP_MAP[ch]).join(''));
                } else {
                    sup.replaceWith(`^{${txt}}`);
                }
            } else {
                sup.remove();
            }
        });

        // Convert Subscripts (e.g. 10_2 -> 10₂, A_0 -> A₀, or _{complex})
        clone.querySelectorAll('sub').forEach(sub => {
            const txt = sub.innerText.trim();
            if (txt) {
                if ([...txt].every(ch => ch in SUB_MAP)) {
                    sub.replaceWith([...txt].map(ch => SUB_MAP[ch]).join(''));
                } else {
                    sub.replaceWith(`_{${txt}}`);
                }
            } else {
                sub.remove();
            }
        });

        // Convert MathJax / LaTeX formulas
        clone.querySelectorAll('.math, .MathJax, [data-mathml]').forEach(mathElem => {
            const tex = mathElem.getAttribute('data-mathml') ||
                        (mathElem.querySelector('annotation[encoding*="tex"]') ? mathElem.querySelector('annotation[encoding*="tex"]').textContent : null) ||
                        mathElem.getAttribute('alt');
            if (tex) {
                mathElem.replaceWith(` $${tex.trim()}$ `);
            }
        });

        // Convert images into markdown links with alt text
        clone.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            const alt = (img.alt || '').trim();
            if (src) {
                const imgText = alt ? `[Image: ${alt} - ${src}]` : `[Image: ${src}]`;
                img.replaceWith(document.createTextNode(`\n${imgText}\n`));
            } else {
                img.remove();
            }
        });

        // Convert tables (Truth Tables, Logic Mappings) to markdown rows
        clone.querySelectorAll('table').forEach(table => {
            const rows = [];
            table.querySelectorAll('tr').forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map(td => td.innerText.trim());
                if (cells.length > 0) rows.push(cells.join(' | '));
            });
            if (rows.length > 0) {
                table.replaceWith(document.createTextNode('\n' + rows.join('\n') + '\n'));
            }
        });

        // Normalize spaces and clean up
        let text = clone.innerText || clone.textContent || '';
        text = text.replace(/\r\n/g, '\n');
        text = text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter((line, i, arr) => {
            return !(line === '' && arr[i - 1] === '');
        }).join('\n');

        return text.trim();
    }

    // Copy an image directly to the OS clipboard as a PNG blob
    async function copyImageBlobToClipboard(imgUrl) {
        try {
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            let pngBlob = blob;
            if (blob.type !== 'image/png') {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                    img.src = imgUrl;
                });
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            }
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
            ]);
            return { success: true };
        } catch (err) {
            logDebug('Image blob copy failed, falling back to URL copy:', err.message);
            await copyToClipboard(imgUrl);
            return { success: false, fallbackUrl: imgUrl };
        }
    }

    // Extract Question & Choices cleanly from a Moodle .que element
    function extractQuestionData(que) {
        if (!que) return null;

        // 1. Question Number (clean digits only, e.g. "4", avoiding "Question #Question 4")
        const numElem = que.querySelector('.info .no, .qno');
        let rawNum = numElem ? numElem.innerText.replace(/\s+/g, ' ').trim() : '';
        const matchDigits = rawNum.match(/\d+/);
        const qNum = matchDigits ? matchDigits[0] : (rawNum.replace(/^Question\s*/i, '').trim() || '1');

        // 2. Question Text (cleanly processed through cleanDOMToAI)
        const qtextElem = que.querySelector('.qtext, .formulation .qtext');
        let qText = '';
        if (qtextElem) {
            qText = cleanDOMToAI(qtextElem);
        } else {
            const formElem = que.querySelector('.formulation');
            if (formElem) {
                const clone = formElem.cloneNode(true);
                const ans = clone.querySelector('.answer');
                if (ans) ans.remove();
                qText = cleanDOMToAI(clone);
            }
        }

        // Clean question text of leading "Question 1" or prompt remnants
        qText = qText.replace(/^Question\s*\d+[\s:.]*/i, '').trim();
        qText = qText.replace(/\b(Select one|Select one or more|Choose one|Choose one or more)[:.]?\s*$/i, '').trim();

        // Detect all image URLs inside this question
        const questionImages = [];
        que.querySelectorAll('.formulation img, .qtext img').forEach(img => {
            if (img.src && !questionImages.includes(img.src)) questionImages.push(img.src);
        });

        // 3. Choices / Answers
        const choices = [];
        const choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li');

        if (choiceRows.length > 0) {
            choiceRows.forEach((row, idx) => {
                const label = row.querySelector('label') || row;
                let choiceText = cleanDOMToAI(label);
                // Collapse newlines inside single choice row
                choiceText = choiceText.replace(/\r?\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

                if (choiceText) {
                    // Ensure each choice starts with a clean letter prefix (a., b., c., d.)
                    const hasPrefix = /^[a-zA-Z0-9][.)]\s*/.test(choiceText);
                    if (!hasPrefix && choiceRows.length > 1) {
                        const letter = String.fromCharCode(97 + idx);
                        choiceText = `${letter}. ${choiceText}`;
                    }
                    choices.push(choiceText);
                }
            });
        }

        // 4. Short Answer check
        const textInput = que.querySelector('input[type="text"].form-control, input.form-control');
        const isShortAnswer = Boolean(textInput && choices.length === 0);

        // 5. Matching type check
        const matchRows = que.querySelectorAll('.answer table tr, .answer tr');
        const matchPairs = [];
        if (matchRows.length > 0 && choices.length === 0) {
            matchRows.forEach(tr => {
                const textCol = tr.querySelector('td.text, td:first-child');
                const selectCol = tr.querySelector('td.control select, select');
                if (textCol && selectCol) {
                    const subQ = cleanDOMToAI(textCol);
                    const options = Array.from(selectCol.querySelectorAll('option'))
                        .map(o => o.innerText.trim())
                        .filter(o => o && !o.toLowerCase().includes('choose'));
                    if (subQ && options.length > 0) {
                        matchPairs.push({ subQ, options });
                    }
                }
            });
        }

        return {
            qNum,
            qText,
            choices,
            isShortAnswer,
            matchPairs,
            questionImages
        };
    }

    // ==========================================
    // AI Context Prompt Injection (1st Question)
    // ==========================================

    function getQuizSessionKey() {
        const urlParams = new URLSearchParams(window.location.search);
        const attempt = urlParams.get('attempt');
        if (attempt) return `attempt_${attempt}`;
        const cmid = urlParams.get('cmid');
        if (cmid) return `cmid_${cmid}`;
        const courseInfo = detectCourseInfo();
        if (courseInfo.subjectCode || courseInfo.currentActivityTitle) {
            return `quiz_${courseInfo.subjectCode}_${courseInfo.currentActivityTitle}`.replace(/[^a-zA-Z0-9_]/g, '_');
        }
        return 'quiz_active_session';
    }

    function hasAiContextBeenSent() {
        return sessionStorage.getItem(`amaes_ai_context_sent_${getQuizSessionKey()}`) === 'true';
    }

    function markAiContextSent() {
        sessionStorage.setItem(`amaes_ai_context_sent_${getQuizSessionKey()}`, 'true');
    }

    function shouldInjectAiContext(qNum = null) {
        if (!checkIsQuizPage()) return false;
        if (!hasAiContextBeenSent()) return true;
        if (qNum === 1 || qNum === '1') return true;
        return false;
    }

    function buildAiContextIntro() {
        const courseInfo = detectCourseInfo();
        const details = [];
        if (courseInfo.subjectCode) details.push(`Course Code: ${courseInfo.subjectCode}`);
        if (courseInfo.subjectName) details.push(`Subject: ${courseInfo.subjectName}`);
        if (courseInfo.currentActivityTitle) details.push(`Activity: ${courseInfo.currentActivityTitle}`);

        const header = details.length > 0 ? details.join(' | ') : 'AMAES Online Course Quiz';

        return `[Context: ${header}]\n` +
               `Act as an expert academic assistant for this course. For each quiz question I provide, analyze carefully and reply ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Keep it direct with no explanations.\n\n---\n\n`;
    }

    // Format a single question and choices cleanly for AI with strict A/B/C/D direct response directive
    // Injects rich course context on the first question of a quiz session
    function formatQuestionForAI(que, withHint = true, forceContext = null) {
        const data = extractQuestionData(que);
        if (!data || !data.qText) return '';

        let output = `${data.qText}\n\n`;

        // Check if database has confirmed wrong choices for this question
        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'GENERAL';
        const cached = getCachedAnswers(subCode);
        let eliminatedWrong = [];
        if (cached && cached.length > 0) {
            const moodleQNorm = normalizeText(data.qText);
            const cand = cached.find(c => c.qNorm === moodleQNorm || (c.qNorm.length > 20 && (c.qNorm.includes(moodleQNorm) || moodleQNorm.includes(c.qNorm))));
            if (cand && Array.isArray(cand.wrongAnswers) && cand.wrongAnswers.length > 0) {
                eliminatedWrong = cand.wrongAnswers.map(w => typeof w === 'string' ? w : w.text).filter(Boolean);
            }
        }

        if (data.choices && data.choices.length > 0) {
            output += data.choices.join('\n');

            if (eliminatedWrong.length > 0) {
                output += `\n\n[CONFIRMED WRONG CHOICES - DO NOT SELECT]:\n` + eliminatedWrong.map(w => `- ${w} (Confirmed INCORRECT in previous attempt)`).join('\n');
            }

            if (withHint) {
                output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
            }
        } else if (data.matchPairs && data.matchPairs.length > 0) {
            output += `Matching items:\n`;
            data.matchPairs.forEach(p => {
                output += `- ${p.subQ}: [${p.options.join(', ')}]\n`;
            });
            if (withHint) {
                output += `\n\nInstructions: Answer ONLY with the matched pairs. No explanation.`;
            }
        } else if (data.isShortAnswer) {
            output += `[Short Answer Question]`;
            if (withHint) {
                output += `\n\nInstructions: Answer ONLY with the direct text answer. No explanation.`;
            }
        }

        const includeContext = forceContext !== null ? forceContext : shouldInjectAiContext(data.qNum);
        if (includeContext) {
            const intro = buildAiContextIntro();
            output = `${intro}${output}`;
            markAiContextSent();
        }

        return output.trim();
    }

    // Format all questions on current quiz page for AI
    function formatAllQuestionsForAI(withHint = true) {
        const queList = document.querySelectorAll('.que');
        if (queList.length === 0) return '';
        if (queList.length === 1) {
            return formatQuestionForAI(queList[0], withHint);
        }

        const formatted = [];
        queList.forEach((que, idx) => {
            const itemText = formatQuestionForAI(que, false, false);
            if (itemText) {
                formatted.push(`Question ${idx + 1}:\n${itemText}`);
            }
        });

        let res = formatted.join('\n\n---\n\n');
        if (withHint && res) {
            res += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and exact text for each question. Do NOT explain.`;
        }

        const intro = buildAiContextIntro();
        markAiContextSent();
        return `${intro}${res}`.trim();
    }

    // Inject sleek "Copy for AI" and "Copy Image" buttons on each question card in Moodle
    function injectQuestionCopyButtons() {
        if (!checkIsQuizPage()) return;
        const queElements = document.querySelectorAll('.que');

        // If user disabled in-question buttons, remove them
        if (!showInQuestionAiBtns) {
            document.querySelectorAll('.amaes-card-btn-container').forEach(el => el.remove());
            return;
        }

        queElements.forEach(que => {
            if (que.querySelector('.amaes-card-btn-container')) return;

            const btnContainer = document.createElement('div');
            btnContainer.className = 'amaes-card-btn-container';
            btnContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 6px; width: 100%; box-sizing: border-box;';

            // 1. Copy Question Text Button
            const btnText = document.createElement('button');
            btnText.type = 'button';
            btnText.className = 'amaes-copy-ai-card-btn';
            btnText.title = 'Copy question and choices (strict direct answer instruction for AI)';
            btnText.innerHTML = `${ICONS.sparkles} <span>Copy AI</span>`;

            btnText.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const qData = extractQuestionData(que);
                const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                const text = formatQuestionForAI(que, aiPromptHint);
                if (!text) return;
                try {
                    await copyToClipboard(text);
                    btnText.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    btnText.style.borderColor = 'var(--accent-green, #10b981)';
                    btnText.style.color = 'var(--accent-green, #10b981)';
                    showToast(willIncludeContext ? 'Question copied with Course AI Context!' : 'Question & choices copied for AI!');
                    if (willIncludeContext) {
                        setLog("Copied question with Course Context for AI.", "var(--accent-green)");
                    }
                    setTimeout(() => {
                        btnText.innerHTML = `${ICONS.sparkles} <span>Copy AI</span>`;
                        btnText.style.borderColor = '';
                        btnText.style.color = '';
                    }, 1800);
                } catch (err) {
                    console.error('Copy failed:', err);
                }
            };
            btnContainer.appendChild(btnText);

            // 2. Copy Image Button (if question has diagram/circuits)
            const qImages = que.querySelectorAll('.formulation img, .qtext img');
            if (qImages.length > 0) {
                const firstImgUrl = qImages[0].src;
                const btnImg = document.createElement('button');
                btnImg.type = 'button';
                btnImg.className = 'amaes-copy-ai-card-btn amaes-copy-img-card-btn';
                btnImg.title = 'Copy question diagram/image to clipboard for Gemini multimodal input';
                btnImg.innerHTML = `${ICONS.camera} <span>Copy Img</span>`;

                btnImg.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btnImg.innerHTML = `<span>Copying...</span>`;
                    const res = await copyImageBlobToClipboard(firstImgUrl);
                    if (res.success) {
                        btnImg.innerHTML = `${ICONS.check} <span>Image Copied!</span>`;
                        btnImg.style.borderColor = 'var(--accent-green, #10b981)';
                        btnImg.style.color = 'var(--accent-green, #10b981)';
                        showToast('Image copied to clipboard! Paste directly into Gemini.');
                    } else {
                        btnImg.innerHTML = `${ICONS.check} <span>URL Copied</span>`;
                        window.open(firstImgUrl, '_blank');
                        showToast('Image URL copied & opened in new tab.');
                    }
                    setTimeout(() => {
                        btnImg.innerHTML = `${ICONS.camera} <span>Copy Img</span>`;
                        btnImg.style.borderColor = '';
                        btnImg.style.color = '';
                    }, 2000);
                };
                btnContainer.appendChild(btnImg);
            }

            const infoCol = que.querySelector('.info');
            const contentCol = que.querySelector('.content');

            if (infoCol) {
                infoCol.appendChild(btnContainer);
            } else if (contentCol) {
                contentCol.insertBefore(btnContainer, contentCol.firstChild);
            } else {
                que.insertBefore(btnContainer, que.firstChild);
            }
        });
    }

    // Auto-copy question to clipboard ONLY when not auto-answering and answer is unknown
    let lastCopiedSignature = '';
    function triggerAutoCopyForAI() {
        if (!autoCopyQuizForAI) return;
        if (!checkIsQuizAttemptPage()) return;

        // LOGIC FIX: If Auto-Quiz mode is active OR questions are already verified in DB, DO NOT auto-copy!
        if (autoQuizMode) return;

        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        const cached = getCachedAnswers(subCode);
        const queElements = document.querySelectorAll('.que');
        if (queElements.length === 0) return;

        // If all questions are verified by database, suppress auto-copy
        let hasUnansweredUnknown = false;
        queElements.forEach(que => {
            if (!que.querySelector('.amaes-verified-badge')) hasUnansweredUnknown = true;
        });

        if (!hasUnansweredUnknown) {
            logDebug("All questions known in DB, suppressing auto-copy.");
            return;
        }

        const textToCopy = formatAllQuestionsForAI(aiPromptHint);
        if (!textToCopy) return;

        const signature = textToCopy.trim();
        if (signature === lastCopiedSignature) return;
        lastCopiedSignature = signature;

        copyToClipboard(textToCopy).then(() => {
            logDebug('Auto-copied unknown question for AI');
            showToast('Question & choices auto-copied for AI!');
            const statusEl = document.getElementById('amaes-status');
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--accent-green);">Auto-copied question to clipboard for AI!</span>`;
            }
        }).catch(err => {
            logDebug('Auto-copy failed:', err.message);
        });
    }

    // Observer and initializer for quiz automation
    let observerDebounceTimer = null;
    function setupQuizAutomation() {
        if (!checkIsQuizPage()) return;

        injectQuestionCopyButtons();
        injectReviewScreenBanner();

        if (checkIsQuizAttemptPage()) {
            injectQuizFloatingHUD();
            setupQuizAnswerListeners();

            // Auto-minimize toolkit panel to floating smart pill if enabled
            if (autoMinimizeQuiz) {
                const bodyEl = document.getElementById('amaes-panel-body');
                const minBtn = document.getElementById('amaes-min-btn');
                if (bodyEl && bodyEl.style.display !== 'none') {
                    bodyEl.style.display = 'none';
                    if (minBtn) {
                        minBtn.innerHTML = `
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                            </svg>
                        `;
                    }
                }
            }

            // On attempt page load: ONLY run solver if Auto-Quiz is active; otherwise just highlight visually
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = setTimeout(() => {
                if (autoQuizMode) {
                    runAutoQuizSolver(true);
                } else {
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const cached = getCachedAnswers(subCode);
                    if (cached && cached.length > 0) {
                        highlightQuizAnswers(cached, false, false); // false = strictly NO auto-selection/clicks
                    }
                }
                triggerAutoCopyForAI();
                setupQuizAnswerListeners();
            }, 400);
        }

        if (checkIsQuizSummaryPage()) {
            setTimeout(handleQuizSummaryAutoSubmit, 600);
        }

        // Debounced observer: updates buttons, answer listeners, and review banner
        const observer = new MutationObserver(() => {
            clearTimeout(observerDebounceTimer);
            observerDebounceTimer = setTimeout(() => {
                injectQuestionCopyButtons();
                injectReviewScreenBanner();
                if (checkIsQuizAttemptPage()) {
                    setupQuizAnswerListeners();
                }
            }, 300);
        });

        const target = document.querySelector('#region-main, .course-content, body');
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    // ==========================================
    // Quiz Review Harvester & Answer Sharing
    // ==========================================

    function downloadJsonFile(filename, jsonString) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Intelligent Multi-Source Answer Cross-Referencing, Elimination & Consensus Engine
    let communityShareDebounceTimer = null;
    function mergeAnswersIntoCache(subCode, newQuestions, sourceLabel = 'Imported') {
        let existing = getCachedAnswers(subCode) || [];
        let addedCount = 0;
        let confirmedCount = 0;
        let conflictCount = 0;
        let eliminatedCount = 0;

        newQuestions.forEach(newItem => {
            const qNorm = newItem.qNorm || normalizeText(newItem.qRaw || newItem.question);
            const ansRaw = newItem.ansRaw || newItem.answer || '';
            const ansNorm = newItem.ansNorm || normalizeChoice(ansRaw);
            const incomingWrong = normalizeWrongAnswers(newItem.wrongAnswers);

            // If neither correct answer nor eliminated wrong answers exist, ignore
            if (!qNorm || (!ansRaw && incomingWrong.length === 0)) return;

            const idx = existing.findIndex(ex => ex.qNorm === qNorm);

            if (idx === -1) {
                // Brand new question added to database
                const entry = {
                    qRaw: newItem.qRaw || newItem.question,
                    qNorm: qNorm,
                    ansRaw: ansRaw,
                    ansNorm: ansNorm,
                    choices: newItem.choices || [],
                    verified: Boolean(newItem.verified),
                    period: newItem.period || newItem.term || detectTermFromText(newItem.quizTitle || newItem.qRaw || '') || 'General',
                    quizTitle: newItem.quizTitle || '',
                    wrongAnswers: incomingWrong,
                    confirmations: ansRaw ? 1 : 0,
                    sources: [sourceLabel]
                };

                // Deduction check: if choices exist and all but 1 are eliminated
                if (!entry.ansRaw && Array.isArray(entry.choices) && entry.choices.length > 1) {
                    const wrongNorms = entry.wrongAnswers.map(w => w.norm);
                    const remaining = entry.choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
                    if (remaining.length === 1) {
                        entry.ansRaw = remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        entry.ansNorm = normalizeChoice(entry.ansRaw);
                        entry.verified = true;
                        entry.deduced = true;
                        entry.sources.push('Elimination Deduction');
                    }
                }

                existing.push(entry);
                if (ansRaw) addedCount++;
                if (incomingWrong.length > 0) eliminatedCount += incomingWrong.length;
            } else {
                // Question already exists: Cross-reference!
                const cur = existing[idx];
                cur.sources = cur.sources || [];
                if (!cur.sources.includes(sourceLabel)) cur.sources.push(sourceLabel);
                if ((!cur.period || cur.period === 'General') && newItem.period && newItem.period !== 'General') {
                    cur.period = newItem.period;
                }
                if (!cur.quizTitle && newItem.quizTitle) cur.quizTitle = newItem.quizTitle;

                if (!Array.isArray(cur.wrongAnswers)) {
                    cur.wrongAnswers = normalizeWrongAnswers(cur.wrongAnswers);
                }

                // Merge incoming wrong answers with weighting
                incomingWrong.forEach(inW => {
                    const existingW = cur.wrongAnswers.find(w => w.norm === inW.norm);
                    if (existingW) {
                        existingW.count = (existingW.count || 1) + (inW.count || 1);
                        if (!existingW.sources) existingW.sources = [];
                        if (!existingW.sources.includes(sourceLabel)) existingW.sources.push(sourceLabel);
                    } else {
                        cur.wrongAnswers.push(inW);
                        eliminatedCount++;
                    }
                });

                // Update choices if missing
                if (Array.isArray(newItem.choices) && newItem.choices.length > 0 && (!cur.choices || cur.choices.length === 0)) {
                    cur.choices = newItem.choices;
                }

                // Handle correct answer
                if (ansRaw) {
                    if (!cur.ansRaw) {
                        cur.ansRaw = ansRaw;
                        cur.ansNorm = ansNorm;
                        cur.verified = Boolean(newItem.verified);
                        cur.confirmations = 1;
                        addedCount++;
                    } else {
                        const isSameAnswer = (cur.ansNorm === ansNorm || cur.ansRaw.toLowerCase() === ansRaw.toLowerCase());
                        if (isSameAnswer) {
                            cur.confirmations = (cur.confirmations || 1) + 1;
                            if (newItem.verified) cur.verified = true;
                            confirmedCount++;
                        } else {
                            cur.variations = cur.variations || [];
                            const existingVar = cur.variations.find(v => v.ansNorm === ansNorm);
                            if (existingVar) {
                                existingVar.confirmations = (existingVar.confirmations || 1) + 1;
                            } else {
                                cur.variations.push({
                                    ansRaw: ansRaw,
                                    ansNorm: ansNorm,
                                    choices: newItem.choices || [],
                                    verified: Boolean(newItem.verified),
                                    confirmations: 1,
                                    source: sourceLabel
                                });
                            }

                            if (newItem.verified && !cur.verified) {
                                cur.variations.push({
                                    ansRaw: cur.ansRaw,
                                    ansNorm: cur.ansNorm,
                                    choices: cur.choices || [],
                                    verified: false,
                                    source: 'Previous'
                                });
                                cur.ansRaw = ansRaw;
                                cur.ansNorm = ansNorm;
                                cur.verified = true;
                            }
                            conflictCount++;
                        }
                    }
                }

                // Deduction check for existing item if still missing verified answer
                if (!cur.ansRaw && Array.isArray(cur.choices) && cur.choices.length > 1) {
                    const wrongNorms = cur.wrongAnswers.map(w => w.norm);
                    const remaining = cur.choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
                    if (remaining.length === 1) {
                        cur.ansRaw = remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        cur.ansNorm = normalizeChoice(cur.ansRaw);
                        cur.verified = true;
                        cur.deduced = true;
                        cur.sources.push('Elimination Deduction');
                    }
                }
            }
        });

        setCachedAnswers(subCode, existing);

        // Community Auto-Share: If user enabled auto-sharing (enabled by default),
        // and new/confirmed/eliminated data was saved to local database,
        // send anonymously to the community database relay so the world can benefit.
        // Avoid pinging if the source is already from cloud sync ('Cloud-Verified', 'Cloud-Fallback', 'Cloud-Amauoed').
        try {
            const autoShareEnabled = localStorage.getItem('amaes_auto_community_share') !== 'false';
            const isFromCloudSync = typeof sourceLabel === 'string' && sourceLabel.startsWith('Cloud-');
            if (autoShareEnabled && !isFromCloudSync && (addedCount > 0 || confirmedCount > 0 || eliminatedCount > 0)) {
                if (typeof dispatchCommunityContribution === 'function') {
                    clearTimeout(communityShareDebounceTimer);
                    communityShareDebounceTimer = setTimeout(() => {
                        dispatchCommunityContribution(subCode, existing, { source: sourceLabel }).catch(err => {
                            logDebug(`Community auto-share note: ${err.message}`);
                        });
                    }, 1500);
                }
            }
        } catch (shareErr) {
            logDebug(`Community dispatch check note: ${shareErr.message}`);
        }

        return {
            total: existing.length,
            added: addedCount,
            confirmed: confirmedCount,
            conflicts: conflictCount,
            eliminated: eliminatedCount
        };
    }

    // Direct GitHub REST API / Web Editor Answer Exporter & Contributor
    async function pushAnswersToGitHub(subCode, questionsToPush, options = {}) {
        const repoOwner = localStorage.getItem('amaes_github_owner') || 'lms-study-hub';
        const repoName = localStorage.getItem('amaes_github_repo') || 'database';
        const pat = localStorage.getItem('amaes_github_token');
        const branch = localStorage.getItem('amaes_github_branch') || 'main';
        const filePath = `data/${subCode}.json`;
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

        // Ensure questions are valid
        if (!questionsToPush || questionsToPush.length === 0) {
            throw new Error('No verified questions to push');
        }

        // If no Personal Access Token is configured, prompt user or guide to 1-click web edit
        if (!pat) {
            const fullPayload = exportAnswersAsJSON({
                subjectCode: subCode,
                quizTitle: options.quizTitle || 'Community Contribution',
                gradeText: options.gradeText || 'Verified Answers',
                totalQuestions: questionsToPush.length,
                harvestedCount: questionsToPush.length,
                questions: questionsToPush
            });

            await copyToClipboard(fullPayload);

            const userChoice = confirm(
                `PUSH TO GITHUB (Community Study Hub)\n\n` +
                `${questionsToPush.length} Verified Q&A entries have been COPIED to your clipboard!\n\n` +
                `Click OK to open the GitHub Web Editor:\n` +
                `Press Ctrl+A, Ctrl+V, and click 'Commit changes'.\n\n` +
                `Tip: To push automatically in 1 click without opening tabs, set your GitHub Token in 'Config'.`
            );

            if (userChoice) {
                const editUrl = `https://github.com/${repoOwner}/${repoName}/edit/${branch}/${filePath}`;
                window.open(editUrl, '_blank');
                return { success: true, mode: 'web_edit', count: questionsToPush.length };
            }
            return { success: false, mode: 'cancelled' };
        }

        // Direct GitHub REST API Commit (Zero traces of personal username, commits as Open LMS Contributor)
        const req = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        function doHttp(params) {
            return new Promise((resolve, reject) => {
                if (req) {
                    req({
                        ...params,
                        onload: (res) => resolve(res),
                        onerror: (err) => reject(err)
                    });
                } else {
                    fetch(params.url, {
                        method: params.method,
                        headers: params.headers,
                        body: params.data
                    }).then(async res => {
                        const text = await res.text();
                        resolve({ status: res.status, responseText: text });
                    }).catch(reject);
                }
            });
        }

        // 1. Fetch existing file to retrieve current SHA and merge contents
        let existingSha = null;
        let existingQuestions = [];

        try {
            const getRes = await doHttp({
                method: 'GET',
                url: `${apiUrl}?ref=${branch}`,
                headers: {
                    'Authorization': `token ${pat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AMAES-Moodle-Toolkit'
                }
            });

            if (getRes.status === 200) {
                const data = JSON.parse(getRes.responseText);
                existingSha = data.sha;
                if (data.content) {
                    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
                    const parsedExisting = JSON.parse(decoded);
                    existingQuestions = parseIncomingAnswerPayload(parsedExisting, subCode);
                }
            }
        } catch (e) {
            console.warn('GitHub file not found or fetch error, creating new dataset:', e);
        }

        // 2. Intelligent Merge & Consensus
        const questionMap = new Map();
        existingQuestions.forEach(q => {
            const key = q.qNorm || normalizeText(q.qRaw || q.question);
            if (key) {
                questionMap.set(key, {
                    question: q.qRaw || q.question,
                    answer: q.ansRaw || q.answer,
                    choices: q.choices || [],
                    verified: Boolean(q.verified),
                    confirmations: q.confirmations || 1,
                    source: q.source || 'community'
                });
            }
        });

        questionsToPush.forEach(q => {
            const key = q.qNorm || normalizeText(q.qRaw || q.question);
            if (!key) return;
            const text = q.qRaw || q.question;
            const ans = q.ansRaw || q.answer;
            const choices = q.choices || [];
            const isVer = Boolean(q.verified);

            if (questionMap.has(key)) {
                const cur = questionMap.get(key);
                if (normalizeChoice(cur.answer) === normalizeChoice(ans)) {
                    cur.confirmations = (cur.confirmations || 1) + 1;
                    cur.verified = true;
                } else if (isVer && !cur.verified) {
                    cur.answer = ans;
                    cur.verified = true;
                    cur.confirmations = 1;
                }
                if (!cur.choices || cur.choices.length === 0) cur.choices = choices;
            } else {
                questionMap.set(key, {
                    question: text,
                    answer: ans,
                    choices: choices,
                    verified: isVer,
                    confirmations: 1,
                    source: options.quizTitle || 'toolkit-review'
                });
            }
        });

        const mergedList = Array.from(questionMap.values());
        const finalPayload = {
            subjectCode: subCode,
            subjectName: options.courseTitle || subCode,
            updatedAt: new Date().toISOString(),
            totalQuestions: mergedList.length,
            questions: mergedList
        };

        const jsonString = JSON.stringify(finalPayload, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(jsonString)));

        const commitBody = {
            message: `Update ${subCode} verified answers database (${mergedList.length} questions) via Toolkit`,
            content: contentBase64,
            branch: branch,
            committer: {
                name: "Open LMS Contributor",
                email: "academic-contributor@users.noreply.github.com"
            },
            author: {
                name: "Open LMS Contributor",
                email: "academic-contributor@users.noreply.github.com"
            }
        };

        if (existingSha) {
            commitBody.sha = existingSha;
        }

        const putRes = await doHttp({
            method: 'PUT',
            url: apiUrl,
            headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'AMAES-Moodle-Toolkit'
            },
            data: JSON.stringify(commitBody)
        });

        if (putRes.status === 200 || putRes.status === 201) {
            // Merge into local cache too
            mergeAnswersIntoCache(subCode, mergedList, 'GitHub-Push');
            return { success: true, count: mergedList.length, mode: 'api' };
        } else {
            let errMsg = `HTTP ${putRes.status}`;
            try {
                const errData = JSON.parse(putRes.responseText);
                if (errData.message) errMsg = errData.message;
            } catch (_) {}
            throw new Error(`GitHub Commit Error: ${errMsg}`);
        }
    }

    // Multi-Tier Cloud Database Synchronization (Verified + AMAUOED Tiers)
    async function syncAnswersFromCloud(subCode, cloudUrl = null) {
        if (!subCode || subCode.toUpperCase() === 'DEFAULT' || subCode.toUpperCase() === 'GENERAL') {
            throw new Error('Please select or specify a valid subject code (e.g. CS6301, ITE6301)');
        }
        const cleanSubCode = subCode.trim().toUpperCase();

        const req = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        function fetchJsonUrl(url) {
            return new Promise((resolve, reject) => {
                if (!req) {
                    fetch(url)
                        .then(res => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.json();
                        })
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                req({
                    method: 'GET',
                    url: url,
                    headers: { 'Accept': 'application/json' },
                    onload: (resp) => {
                        if (resp.status >= 200 && resp.status < 300) {
                            try {
                                resolve(JSON.parse(resp.responseText));
                            } catch (e) {
                                reject(new Error('Invalid JSON'));
                            }
                        } else {
                            reject(new Error(`HTTP ${resp.status}`));
                        }
                    },
                    onerror: () => reject(new Error('Network error connecting to database'))
                });
            });
        }

        let verifiedCount = 0;
        let amauoedCount = 0;

        // 1. Fetch Verified Tier (Audited Gold Standard)
        try {
            const verBase = cloudUrl || cloudDbBaseUrl;
            const targetVerUrl = verBase.endsWith('/') ? `${verBase}${cleanSubCode}.json` : `${verBase}/${cleanSubCode}.json`;
            logDebug(`Syncing verified answers from: ${targetVerUrl}`);
            const verData = await fetchJsonUrl(targetVerUrl);
            const parsedVer = parseIncomingAnswerPayload(verData, cleanSubCode).map(q => ({
                ...q,
                source: q.source || 'verified_db',
                verified: true
            }));
            mergeAnswersIntoCache(cleanSubCode, parsedVer, 'Cloud-Verified');
            verifiedCount = parsedVer.length;
        } catch (e) {
            // Fallback to legacy master data/{CODE}.json
            try {
                const fbUrl = `${CLOUD_DB_FALLBACK_URL}${cleanSubCode}.json`;
                logDebug(`Falling back to master dataset: ${fbUrl}`);
                const fbData = await fetchJsonUrl(fbUrl);
                const parsedFb = parseIncomingAnswerPayload(fbData, cleanSubCode);
                mergeAnswersIntoCache(cleanSubCode, parsedFb, 'Cloud-Fallback');
                verifiedCount = parsedFb.length;
            } catch (err) {
                logDebug(`Verified tier note for ${cleanSubCode}: ${err.message}`);
            }
        }

        // 2. Fetch AMAUOED Tier (Study Guide Catalog)
        try {
            const amaUrl = `${CLOUD_DB_AMAUOED_URL}${cleanSubCode}.json`;
            logDebug(`Syncing amauoed catalog from: ${amaUrl}`);
            const amaData = await fetchJsonUrl(amaUrl);
            const parsedAma = parseIncomingAnswerPayload(amaData, cleanSubCode).map(q => ({
                ...q,
                source: 'amauoed'
            }));
            mergeAnswersIntoCache(cleanSubCode, parsedAma, 'Cloud-Amauoed');
            amauoedCount = parsedAma.length;
        } catch (e) {
            logDebug(`AMAUOED tier note for ${cleanSubCode}: ${e.message}`);
        }

        const totalSynced = verifiedCount + amauoedCount;
        if (totalSynced === 0) {
            throw new Error(`No answer databases found for ${cleanSubCode}`);
        }

        return {
            success: true,
            count: totalSynced,
            verifiedCount,
            amauoedCount
        };
    }

    async function autoFetchCloudAnswersIfMissing(code) {
        if (!code || code === 'DEFAULT' || code === 'GENERAL') return false;
        try {
            // 1. Check local cache: If answers already exist locally, avoid unnecessary scraping or network calls
            const existing = getCachedAnswers(code) || [];
            if (existing.length > 0) {
                return true;
            }

            // 2. Fetch from Cloud / GitHub community database
            const res = await syncAnswersFromCloud(code);
            if (res && res.count > 0) {
                return true;
            }

            // 3. Fallback: If no answers found in cloud DB, check if there is a known/stored static AMAUOED URL
            const amauoedUrl = getStoredAmauoedUrl(code);
            const alreadyScraped = localStorage.getItem(`amaes_amauoed_scraped_${code}`);
            if (amauoedUrl && !alreadyScraped && typeof loadAllAmauoedAnswers === 'function') {
                logDebug(`Auto-scraping static AMAUOED URL for missing course ${code}: ${amauoedUrl}`);
                const scraped = await loadAllAmauoedAnswers(amauoedUrl);
                if (scraped && scraped.length > 0) {
                    localStorage.setItem(`amaes_amauoed_scraped_${code}`, '1');
                    mergeAnswersIntoCache(code, scraped, 'AMAUOED');
                    return true;
                }
            }
            return false;
        } catch (e) {
            logDebug(`autoFetchCloudAnswersIfMissing note for ${code}: ${e.message}`);
            return false;
        }
    }

    function parseIncomingAnswerPayload(payload, defaultSubCode) {
        let list = [];
        if (Array.isArray(payload)) {
            list = payload;
        } else if (payload && Array.isArray(payload.questions)) {
            list = payload.questions;
        }
        return list.map(q => ({
            qRaw: q.question || q.qRaw,
            qNorm: normalizeText(q.question || q.qRaw),
            ansRaw: q.answer || q.ansRaw,
            ansNorm: normalizeChoice(q.answer || q.ansRaw),
            choices: q.choices || [],
            verified: q.verified !== false,
            source: q.source || 'db'
        }));
    }

    function harvestFromReviewDOM(rootDoc, subCode, quizTitle, courseTitle = '') {
        const queList = rootDoc.querySelectorAll('.que');
        if (queList.length === 0) return { success: false, error: 'No questions found on review page', questions: [] };

        let gradeText = '';
        const gradeRow = rootDoc.querySelector('.quizreviewsummary tr:last-child, .quizreviewsummary .grade');
        if (gradeRow) {
            gradeText = gradeRow.innerText.replace(/\s+/g, ' ').trim();
        }

        const harvested = [];
        let correctCount = 0;
        let eliminatedTotal = 0;

        queList.forEach((que, idx) => {
            const qData = extractQuestionData(que);
            if (!qData || !qData.qText) return;

            let rightAnswer = '';
            let isVerified = false;
            const wrongAnswers = [];

            // 1. Check for explicit Moodle .rightanswer box (handles both singular and plural answers)
            const rightElem = que.querySelector('.rightanswer, .outcome .rightanswer');
            if (rightElem) {
                let raw = cleanDOMToAI(rightElem);
                raw = raw.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
                if (raw) {
                    rightAnswer = raw;
                    isVerified = true;
                }
            }

            // 2. Fallback: Check if question scored full mark (1.00 out of 1.00) vs 0 marks
            const gradeElem = que.querySelector('.info .grade');
            const gradeStr = gradeElem ? gradeElem.innerText : '';
            const isFullMark = que.classList.contains('correct') || /1(\.0+)?\s*out of\s*1(\.0+)?/i.test(gradeStr);
            const isZeroMark = que.classList.contains('incorrect') || /0(\.0+)?\s*out of\s*1(\.0+)?/i.test(gradeStr);

            // Checked radio or checkbox in this question
            const checkedInputs = que.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
            const checkedTexts = [];
            checkedInputs.forEach(inp => {
                const label = inp.closest('label') || inp.closest('div.r0, div.r1') || inp.parentElement;
                let text = cleanDOMToAI(label);
                text = text.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                if (text) checkedTexts.push(text);
            });

            // If user got full mark, the selected choice(s) are verified correct!
            if (!rightAnswer && isFullMark && checkedTexts.length > 0) {
                rightAnswer = checkedTexts.length === 1 ? checkedTexts[0] : checkedTexts.join(', ');
                isVerified = true;
            } else if (!rightAnswer && isFullMark) {
                const textInput = que.querySelector('input[type="text"].form-control, input.form-control');
                if (textInput && textInput.value) {
                    rightAnswer = textInput.value.trim();
                    isVerified = true;
                }
            }

            // If question was marked INCORRECT (0 marks): the checked choice is confirmed WRONG!
            if (isZeroMark && checkedTexts.length > 0) {
                checkedTexts.forEach(txt => {
                    const norm = normalizeChoice(txt);
                    if (norm && !wrongAnswers.some(w => normalizeChoice(w) === norm)) {
                        wrongAnswers.push(txt);
                    }
                });
            }

            // Also check Moodle's per-choice incorrect indicators (e.g. choice has class incorrect or red cross icon)
            const incorrectChoiceElems = que.querySelectorAll('.answer div.incorrect, .answer tr.incorrect, .answer li.incorrect, .answer .fa-remove, .answer .fa-times');
            incorrectChoiceElems.forEach(el => {
                const row = el.closest('div.r0, div.r1, tr, li') || el;
                const label = row.querySelector('label') || row;
                let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = normalizeChoice(text);
                if (norm && !wrongAnswers.some(w => normalizeChoice(w) === norm) && (!rightAnswer || norm !== normalizeChoice(rightAnswer))) {
                    wrongAnswers.push(text);
                }
            });

            if (rightAnswer || wrongAnswers.length > 0) {
                if (rightAnswer) correctCount++;
                eliminatedTotal += wrongAnswers.length;
                const detectedPeriod = detectTermFromText(quizTitle) || 'General';
                harvested.push({
                    index: idx + 1,
                    qRaw: qData.qText,
                    qNorm: normalizeText(qData.qText),
                    ansRaw: rightAnswer,
                    ansNorm: normalizeChoice(rightAnswer),
                    wrongAnswers: normalizeWrongAnswers(wrongAnswers),
                    choices: qData.choices,
                    verified: isVerified,
                    period: detectedPeriod,
                    quizTitle: quizTitle
                });
            }
        });

        return {
            success: true,
            course: courseTitle || subCode,
            subjectCode: subCode,
            quizTitle,
            gradeText,
            totalQuestions: queList.length,
            harvestedCount: correctCount,
            eliminatedCount: eliminatedTotal,
            questions: harvested
        };
    }

    function harvestReviewAnswers() {
        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        let quizTitle = courseInfo.currentActivityTitle || 'Quiz Review';
        return harvestFromReviewDOM(document, subCode, quizTitle, courseInfo.fullTitle || subCode);
    }

    function exportAnswersAsJSON(data) {
        const payload = {
            tool: "AMAES Moodle Toolkit",
            version: SCRIPT_VERSION,
            exportedAt: new Date().toISOString(),
            subjectCode: data.subjectCode,
            quizTitle: data.quizTitle,
            grade: data.gradeText,
            totalQuestions: data.totalQuestions,
            answerCount: data.harvestedCount,
            eliminatedCount: data.eliminatedCount || 0,
            questions: data.questions.map(q => ({
                question: q.qRaw,
                answer: q.ansRaw,
                choices: q.choices,
                wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : w.text) : []
            }))
        };
        return JSON.stringify(payload, null, 2);
    }

    function formatAnswersAsStudyGuide(data) {
        let out = `========================================\n`;
        out += `${data.subjectCode} - ${data.quizTitle}\n`;
        if (data.gradeText) out += `Score: ${data.gradeText}\n`;
        out += `Verified Answer Key (${data.harvestedCount} Correct • ${data.eliminatedCount || 0} Eliminated Wrong Choices)\n`;
        out += `========================================\n\n`;

        data.questions.forEach((q, i) => {
            out += `${i + 1}. ${q.qRaw}\n`;
            if (q.ansRaw) {
                out += `   Correct Answer: ${q.ansRaw}\n`;
            } else {
                out += `   Correct Answer: [Pending Discovery]\n`;
            }
            if (q.wrongAnswers && q.wrongAnswers.length > 0) {
                const wTexts = q.wrongAnswers.map(w => typeof w === 'string' ? w : w.text).filter(Boolean);
                out += `   [Wrong]: ${wTexts.join(' | ')}\n`;
            }
            out += `\n`;
        });

        out += `Exported from AMAES Moodle Toolkit`;
        return out;
    }

    // Dispatch Community Contribution silently in background
    async function dispatchCommunityContribution(subCode, questions, options = {}) {
        if (!questions || questions.length === 0) return;
        const validQuestions = questions.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
        if (validQuestions.length === 0) return;

        const payload = {
            subjectCode: subCode,
            totalQuestions: validQuestions.length,
            source: options.source || "auto_harvester",
            submittedAt: new Date().toISOString(),
            questions: validQuestions.map(q => ({
                question: q.qRaw || q.question || "",
                answer: q.ansRaw || q.answer || "",
                choices: q.choices || [],
                wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : w.text) : []
            }))
        };

        logDebug(`Dispatching ${validQuestions.length} answers to community relay...`);

        if (communityRelayUrl) {
            try {
                const resp = await fetch(communityRelayUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (resp.ok) {
                    showToast(`Auto-shared ${validQuestions.length} verified answers to Community Hub!`);
                    setLog(`Auto-shared <b>${validQuestions.length}</b> verified answers to Community Hub via relay.`, "var(--accent-green)");
                    return { success: true, mode: 'relay', count: validQuestions.length };
                }
            } catch (err) {
                logDebug(`Relay background post note: ${err.message}`);
            }
        }

        // Silent local save notice
        showToast(`Saved ${validQuestions.length} verified answers to local database!`, 3000);
        return { success: true, mode: 'local', count: validQuestions.length };
    }

    // Background Grades Report Answer Harvester
    let isHarvestingInProgress = false;
    async function executeGradesHarvester(statusCallback) {
        if (isHarvestingInProgress) {
            showToast("Harvester is already running in background...", 2500);
            return { success: false, inProgress: true };
        }
        isHarvestingInProgress = true;

        try {
            let gradesDoc = document;
            const isDirectGradesPage = window.location.pathname.includes('/grade/report/user/index.php');

            if (!isDirectGradesPage) {
                const gradesLink = document.querySelector('a[href*="/grade/report/user/index.php"]');
                let gradesUrl = gradesLink ? gradesLink.href : null;

                if (!gradesUrl) {
                    const courseInfo = detectCourseInfo();
                    const courseId = courseInfo.courseId || new URLSearchParams(window.location.search).get('id');
                    if (courseId) {
                        const pathParts = window.location.pathname.split('/');
                        const basePrefix = pathParts.length > 2 && pathParts[1] ? `/${pathParts[1]}` : '';
                        gradesUrl = `${window.location.origin}${basePrefix}/grade/report/user/index.php?id=${courseId}`;
                    }
                }

                if (!gradesUrl) {
                    showToast("Open a course or Grades page first to scan completed quizzes!");
                    return { success: false, error: 'No grades URL found' };
                }

                showToast("Fetching course Grade Report in background...", 2500);
                setLog("Fetching course Grade Report in background...", "var(--accent-blue)");

                try {
                    const resp = await fetch(gradesUrl);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const html = await resp.text();
                    gradesDoc = new DOMParser().parseFromString(html, 'text/html');
                } catch (e) {
                    showToast("Could not fetch Grade Report: " + e.message);
                    return { success: false, error: e.message };
                }
            }

            // Detect course subject code from table or context
            const courseInfo = detectCourseInfo();
            let subCode = courseInfo.subjectCode;

            const table = gradesDoc.querySelector('.user-grade, table[summary="User report"], .generaltable');
            if (!table) {
                showToast("No grade report table found.");
                return { success: false, error: 'No grade table found' };
            }

            if (!subCode || subCode === 'DEFAULT' || subCode === 'GENERAL') {
                const catHeaders = table.querySelectorAll('th.category, tr.category, h2, h3, .cat_1');
                for (const h of catHeaders) {
                    const m = (h.innerText || '').match(/(?:UGRD-|UGRD_)?([A-Z]{2,6}\d{3,4}[A-Z]?)/i);
                    if (m) {
                        subCode = m[1].toUpperCase();
                        break;
                    }
                }
            }
            if (!subCode || subCode === 'DEFAULT' || subCode === 'GENERAL') {
                subCode = courseInfo.courseId ? (`COURSE_${courseInfo.courseId}`) : 'GENERAL';
            }

            // Scan all candidate rows across document or tables
            const candidateRows = Array.from(gradesDoc.querySelectorAll('.user-grade tr, .generaltable tr, table.table tr, tr'));
            const completedQuizzes = [];
            const seenUrls = new Set();

            candidateRows.forEach(r => {
                const quizLink = r.querySelector('a[href*="/mod/quiz/"], a[href*="quiz"], a.gradeitemheader')
                              || r.querySelector('.column-itemname a, th a, td:first-child a');
                if (!quizLink) return;

                const href = quizLink.getAttribute('href') || quizLink.href || '';
                const rawTitle = quizLink.innerText.trim();
                if (!rawTitle || (!href.includes('quiz') && !r.innerText.toLowerCase().includes('quiz'))) return;

                // Prevent empty or unattempted rows
                const rowText = r.innerText || '';
                if (rowText.includes('( Empty )') || rowText.includes('(Empty)') || rowText.includes('( empty )')) return;

                let fullQuizUrl = '';
                try {
                    fullQuizUrl = new URL(href, window.location.origin).href;
                } catch (e) {
                    fullQuizUrl = href;
                }
                if (!fullQuizUrl || seenUrls.has(fullQuizUrl)) return;

                // Determine if the quiz has a completed grade
                const gradeCell = r.querySelector('.column-grade, [headers*="grade"], td.grade');
                const pctCell = r.querySelector('.column-percentage, [headers*="percentage"]');

                let hasGrade = false;
                let gradeStr = '';

                if (gradeCell) {
                    const gText = gradeCell.innerText.trim();
                    if (gText && gText !== '-' && gText !== '–' && /\d/.test(gText)) {
                        hasGrade = true;
                        gradeStr = gText;
                    }
                }

                if (!hasGrade && pctCell) {
                    const pText = pctCell.innerText.trim();
                    if (pText && pText !== '-' && pText !== '–' && !pText.includes('0.00') && /\d/.test(pText)) {
                        hasGrade = true;
                        gradeStr = pText;
                    }
                }

                if (!hasGrade) {
                    const cells = Array.from(r.querySelectorAll('td, th'));
                    for (const c of cells) {
                        if (c.contains(quizLink)) continue;
                        const txt = c.innerText.trim();
                        if (txt && txt !== '-' && txt !== '–' && !txt.includes('( Empty )') && !txt.includes('0.00 %') && !txt.startsWith('0-') && !txt.startsWith('0–') && /\b\d+(\.\d+)?\b/.test(txt)) {
                            hasGrade = true;
                            gradeStr = txt;
                            break;
                        }
                    }
                }

                if (hasGrade) {
                    seenUrls.add(fullQuizUrl);
                    const cleanTitle = rawTitle.replace(/^QUIZ\s+/i, '').replace(/\s+/g, ' ').trim();
                    completedQuizzes.push({
                        title: cleanTitle || rawTitle,
                        url: fullQuizUrl,
                        grade: gradeStr
                    });
                }
            });

            if (completedQuizzes.length === 0) {
                showToast("No graded quizzes found in this report.");
                setLog("No completed quiz attempts found in Grade Report.", "var(--accent-amber)");
                return { success: false, count: 0 };
            }

            showToast(`Found ${completedQuizzes.length} completed quizzes. Harvesting answers...`, 3000);
            setLog(`Scanning <b>${completedQuizzes.length}</b> completed quizzes for <b>${subCode}</b>...`, "var(--accent-blue)");

            let totalHarvested = 0;
            let allQuestions = [];

            for (let i = 0; i < completedQuizzes.length; i++) {
                const qz = completedQuizzes[i];
                if (statusCallback) statusCallback(i + 1, completedQuizzes.length, qz.title);
                setLog(`[${i + 1}/${completedQuizzes.length}] Opening <b>${qz.title}</b> (Score: ${qz.grade})...`, "var(--accent-cyan)");

                try {
                    const viewResp = await fetch(qz.url);
                    if (!viewResp.ok) continue;
                    const viewHtml = await viewResp.text();
                    const viewDoc = new DOMParser().parseFromString(viewHtml, 'text/html');

                    const reviewLinks = Array.from(viewDoc.querySelectorAll('a[href*="review.php"], a[href*="/mod/quiz/review.php"]'));
                    if (reviewLinks.length === 0) continue;

                    const seenReviewUrls = new Set();
                    for (const rLink of reviewLinks) {
                        const rawHref = rLink.getAttribute('href') || rLink.href;
                        if (!rawHref) continue;

                        let reviewUrl = '';
                        try {
                            reviewUrl = new URL(rawHref, qz.url).href;
                        } catch (e) {
                            reviewUrl = rawHref;
                        }

                        // Append showall=1 to ensure all questions in attempt load on a single page
                        if (!reviewUrl.includes('showall=')) {
                            reviewUrl += (reviewUrl.includes('?') ? '&' : '?') + 'showall=1';
                        }

                        if (seenReviewUrls.has(reviewUrl)) continue;
                        seenReviewUrls.add(reviewUrl);

                        const reviewResp = await fetch(reviewUrl);
                        if (!reviewResp.ok) continue;
                        const reviewHtml = await reviewResp.text();
                        const reviewDoc = new DOMParser().parseFromString(reviewHtml, 'text/html');

                        const res = harvestFromReviewDOM(reviewDoc, subCode, qz.title, courseInfo.fullTitle || subCode);
                        if (res.success && res.questions.length > 0) {
                            allQuestions.push(...res.questions);
                            totalHarvested += res.harvestedCount;
                        }
                    }
                } catch (err) {
                    console.warn(`Error harvesting ${qz.title}:`, err);
                }
            }

            if (allQuestions.length > 0) {
                mergeAnswersIntoCache(subCode, allQuestions, 'Grades-Harvester');
                setLog(`Harvest Complete! Loaded <b>${totalHarvested}</b> verified answers from ${completedQuizzes.length} quizzes into <b>${subCode}</b> DB.`, "var(--accent-green)");
                showToast(`Harvested ${totalHarvested} verified answers! Saved to database.`, 4000);

                syncAutoQuizUI();
                const fresh = getCachedAnswers(subCode);
                const lbl = document.getElementById('fetch-btn-label');
                if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;

                return { success: true, count: totalHarvested, quizzes: completedQuizzes.length };
            } else {
                showToast("No reviews could be opened. Reviews might be restricted by instructor.");
                setLog("Completed quiz reviews were not accessible.", "var(--accent-amber)");
                return { success: false, count: 0 };
            }
        } finally {
            isHarvestingInProgress = false;
        }
    }



    function injectReviewScreenBanner() {
        if (!checkIsReviewPage()) return;
        if (document.getElementById('amaes-review-banner')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const attemptId = urlParams.get('attempt') || 'review';

        // Check for multi-page review pagination: expand to show all questions on one page if available
        const showAllLink = document.querySelector('a[href*="review.php"][href*="showall=1"], a[href*="showall=true"]');
        if (showAllLink && !window.location.search.includes('showall=1') && !sessionStorage.getItem(`amaes_expanded_review_${attemptId}`)) {
            sessionStorage.setItem(`amaes_expanded_review_${attemptId}`, '1');
            setLog("<b>Multi-page Review:</b> Expanding full quiz to review and harvest all questions on one page...", "var(--accent-blue)");
            showToast("Expanding full quiz review for complete answer harvest...", 2000);
            window.location.href = showAllLink.href;
            return;
        }

        const harvested = harvestReviewAnswers();
        if (!harvested || !harvested.success || (harvested.harvestedCount === 0 && (harvested.eliminatedCount || 0) === 0)) return;

        // Auto-save verified answers and eliminated wrong choices to local subject cache
        const cacheRes = mergeAnswersIntoCache(harvested.subjectCode, harvested.questions, 'Review');

        setLog(`<b>Quiz Review Checked:</b> Extracted <b>${harvested.harvestedCount}</b> verified answers & <b>${harvested.eliminatedCount || 0}</b> wrong choices for <b>${harvested.subjectCode}</b>. Database updated!`, "var(--accent-green)");
        showToast(`Review Checked: Harvested ${harvested.harvestedCount} verified answers & ${harvested.eliminatedCount || 0} wrong choices!`, 4000);

        const autoDlEnabled = localStorage.getItem('amaes_auto_dl_json') === 'true';
        const autoPushEnabled = localStorage.getItem('amaes_auto_push_github') === 'true';
        const autoShareEnabled = localStorage.getItem('amaes_auto_community_share') !== 'false';
        const hasGithubToken = Boolean(localStorage.getItem('amaes_github_token'));

        // Prevent repeated auto-actions on refresh using sessionStorage attempt keys
        const dlKey = `amaes_autodl_${attemptId}`;
        const pushKey = `amaes_autopush_${attemptId}`;
        const shareKey = `amaes_autoshare_${attemptId}`;

        // 1. Auto-Download JSON file on review screen load (opt-in)
        if (autoDlEnabled && !sessionStorage.getItem(dlKey)) {
            sessionStorage.setItem(dlKey, '1');
            const json = exportAnswersAsJSON(harvested);
            const filename = `${harvested.subjectCode}_${harvested.quizTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Answers.json`;
            setTimeout(() => {
                downloadJsonFile(filename, json);
                showToast(`Auto-downloaded ${harvested.harvestedCount} verified answers!`);
            }, 500);
        }

        // 2. Auto-Push to GitHub if configured
        if (autoPushEnabled && hasGithubToken && !sessionStorage.getItem(pushKey)) {
            sessionStorage.setItem(pushKey, '1');
            setTimeout(async () => {
                try {
                    const res = await pushAnswersToGitHub(harvested.subjectCode, harvested.questions, {
                        quizTitle: harvested.quizTitle,
                        gradeText: harvested.gradeText,
                        courseTitle: harvested.course
                    });
                    if (res && res.success && res.mode === 'api') {
                        showToast(`Auto-pushed ${harvested.harvestedCount} answers directly to GitHub database!`);
                    }
                } catch (e) {
                    console.error('Auto-push to GitHub failed:', e);
                }
            }, 1000);
        }

        // 3. Auto-Share to Community Hub (Default: ON)
        if (autoShareEnabled && harvested.harvestedCount > 0 && !sessionStorage.getItem(shareKey)) {
            sessionStorage.setItem(shareKey, '1');
            setTimeout(() => {
                dispatchCommunityContribution(harvested.subjectCode, harvested.questions, { source: 'review_screen' });
            }, 1200);
        }

        const banner = document.createElement('div');
        banner.id = 'amaes-review-banner';
        banner.style.cssText = `
            margin: 15px 0;
            padding: 12px 16px;
            background: var(--surface, #1e293b);
            border: 1.5px solid var(--accent-green, #10b981);
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: var(--text-primary, #f8fafc);
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="background: rgba(16, 185, 129, 0.2); color: var(--accent-green, #10b981); padding: 6px; border-radius: 8px; display: flex; align-items: center;">
                    ${ICONS.sparkles}
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                        <span>Quiz Review Harvested:</span>
                        <span style="color: var(--accent-green, #10b981);">${harvested.harvestedCount}/${harvested.totalQuestions} Verified • ${harvested.eliminatedCount || 0} Wrong Eliminated</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary, #94a3b8); margin-top: 1px;">
                        ${harvested.subjectCode} • ${harvested.gradeText || 'Saved to local storage for automatic elimination on retake!'}
                    </div>
                    <div style="font-size: 10px; color: #10b981; margin-top: 2px; font-weight: 600;">
                        Safe Learning: Verified answers auto-pick on retake. Known wrong choices are crossed out and eliminated!
                    </div>
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <button id="btn-banner-contribute-hub" class="amaes-banner-btn" style="background: linear-gradient(135deg, #10b981, #047857); color: #ffffff; border: none; border-radius: 6px; padding: 0 12px; height: 28px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap;" title="1-Click zero-token submission to community GitHub repository with automated anti-sabotage merge">
                    ${ICONS.upload} <span>Share to Community Hub</span>
                </button>
                <button id="btn-banner-export-json" class="amaes-banner-btn amaes-banner-btn-secondary" style="background: rgba(255,255,255,0.08); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 0 12px; height: 28px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; width: auto;" title="Download JSON file for classmates or local auto-sync">
                    ${ICONS.download} <span>Download JSON</span>
                </button>
                <button id="btn-banner-copy-text" class="amaes-banner-btn amaes-banner-btn-secondary" style="background: rgba(255,255,255,0.08); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 0 12px; height: 28px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; width: auto;" title="Copy clean Q&A study sheet to share on Messenger / Discord">
                    ${ICONS.copy} <span>Copy Study Sheet</span>
                </button>
                
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 6px; padding-left: 10px; border-left: 1px solid rgba(255,255,255,0.18);">
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: #cbd5e1; font-weight: 500; cursor: pointer;" title="Automatically download .json file whenever you open a completed review screen">
                        <input id="chk-banner-auto-dl" type="checkbox" ${autoDlEnabled ? 'checked' : ''} style="cursor: pointer;" />
                        <span>Auto-DL</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: #cbd5e1; font-weight: 500; cursor: pointer;" title="Automatically share verified answers with Community Hub in background">
                        <input id="chk-banner-auto-share" type="checkbox" ${autoShareEnabled ? 'checked' : ''} style="cursor: pointer;" />
                        <span>Auto-Share</span>
                    </label>
                </div>
            </div>
        `;

        const target = document.querySelector('#region-main .quizreviewsummary, #region-main, .course-content');
        if (target) {
            target.parentElement.insertBefore(banner, target.nextSibling);
        }

        // Banner Action Handlers
        const btnBannerHub = document.getElementById('btn-banner-contribute-hub');
        if (btnBannerHub) {
            btnBannerHub.onclick = () => {
                showCommunityContributionModal(harvested.subjectCode);
            };
        }

        const _el__btn_banner_export_json_ = document.getElementById('btn-banner-export-json');
        if (_el__btn_banner_export_json_) _el__btn_banner_export_json_.onclick = () => {;
            const json = exportAnswersAsJSON(harvested);
            const filename = `${harvested.subjectCode}_${harvested.quizTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Answers.json`;
            downloadJsonFile(filename, json);
            showToast(`Exported ${filename}`);
        };

        const _el__btn_banner_copy_text_ = document.getElementById('btn-banner-copy-text');
        if (_el__btn_banner_copy_text_) _el__btn_banner_copy_text_.onclick = async () => {;
            const text = formatAnswersAsStudyGuide(harvested);
            await copyToClipboard(text);
            showToast('Study sheet copied to clipboard! (Ready for Messenger/Discord)');
        };

        const _el__chk_banner_auto_dl_ = document.getElementById('chk-banner-auto-dl');
        if (_el__chk_banner_auto_dl_) _el__chk_banner_auto_dl_.onchange = (e) => {;
            localStorage.setItem('amaes_auto_dl_json', e.target.checked);
            showToast(`Auto-download JSON: ${e.target.checked ? 'Enabled' : 'Disabled'}`);
        };

        const _el__chk_banner_auto_share_ = document.getElementById('chk-banner-auto-share');
        if (_el__chk_banner_auto_share_) _el__chk_banner_auto_share_.onchange = (e) => {;
            const checked = e.target.checked;
            autoCommunityShare = checked;
            localStorage.setItem('amaes_auto_community_share', checked);
            showToast(`Auto-share to Community Hub: ${checked ? 'Enabled' : 'Disabled'}`);
        };
    }

    // Helper to retrieve all locally cached subject databases
    function getAllSavedSubjectDatabases() {
        const dbs = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('amaes_amauoed_cache_')) {
                const code = key.replace('amaes_amauoed_cache_', '').toUpperCase();
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (Array.isArray(data) && data.length > 0) {
                        dbs[code] = data;
                    }
                } catch (e) {}
            }
        }
        return dbs;
    }

    // Community Database Contribution & Anti-Sabotage Submission Modal
    function showCommunityContributionModal(initialSubCode) {
        const existing = document.getElementById('amaes-contribute-modal');
        if (existing) existing.remove();

        const allDbs = getAllSavedSubjectDatabases();
        const availableCodes = Object.keys(allDbs);
        // Sort availableCodes by question count descending
        availableCodes.sort((a, b) => (allDbs[b]?.length || 0) - (allDbs[a]?.length || 0));

        let targetCode = (initialSubCode && allDbs[initialSubCode.toUpperCase()]) ?
            initialSubCode.toUpperCase() :
            (availableCodes[0] || (initialSubCode ? initialSubCode.toUpperCase() : 'GENERAL'));

        const modal = document.createElement('div');
        modal.id = 'amaes-contribute-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 100003;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
        `;

        function generatePayload(code, qList) {
            // Only export questions that have a verified or deduced answer
            const validQuestions = qList.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
            return {
                subjectCode: code,
                subjectName: (typeof courseInfo !== 'undefined' && courseInfo && courseInfo.code === code) ? courseInfo.fullTitle : code,
                contributor: "community",
                timestamp: new Date().toISOString(),
                totalQuestions: validQuestions.length,
                questions: validQuestions.map(q => ({
                    question: q.qRaw || q.question || q.qText || "",
                    answer: q.ansRaw || q.answer || q.correctAnswer || "",
                    choices: q.choices || [],
                    wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : (w && w.text ? w.text : w)) : [],
                    confidence: typeof q.confidence === 'number' ? q.confidence : 1.0,
                    period: q.period || q.term || 'General',
                    quizTitle: q.quizTitle || '',
                    source: q.source || "community_contribute"
                }))
            };
        }

        function renderModal() {
            const questions = allDbs[targetCode] || [];
            const payload = generatePayload(targetCode, questions);
            const payloadStr = JSON.stringify(payload, null, 2);
            const verifiedCount = questions.filter(q => q.ansRaw || q.answer || q.correctAnswer).length;
            const eliminatedCount = questions.reduce((acc, q) => acc + (Array.isArray(q.wrongAnswers) ? q.wrongAnswers.length : 0), 0);
            const hasPatToken = Boolean(localStorage.getItem('amaes_github_token'));

            modal.innerHTML = `
                <div style="
                    background: var(--surface, #1e293b);
                    border: 1px solid var(--border, #334155);
                    border-radius: 14px;
                    max-width: 580px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                    overflow: hidden;
                    color: var(--text-primary, #f8fafc);
                    display: flex;
                    flex-direction: column;
                    max-height: 90vh;
                ">
                    <!-- Header with Motto -->
                    <div style="
                        padding: 12px 18px;
                        background: linear-gradient(135deg, #10b981, #047857);
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${ICONS.upload}
                                <span style="font-weight: 800; font-size: 14px;">Share Database to Community Hub</span>
                            </div>
                            <div style="font-size: 10px; color: #d1fae5; margin-top: 2px; font-style: italic;">
                                "Solve once, share together, never guess twice."
                            </div>
                        </div>
                        <button id="amaes-contribute-close-btn" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: #fff;
                            width: 26px; height: 26px;
                            border-radius: 50%;
                            cursor: pointer;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 15px; font-weight: bold;
                        ">&times;</button>
                    </div>

                    <!-- Body Content -->
                    <div style="padding: 14px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; font-size: 12px; line-height: 1.5;">
                        <!-- Motto Callout & Anti-Sabotage Notice -->
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 12px;">
                            <div style="font-weight: 700; color: #34d399; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                                ${ICONS.shieldCheck} <span>A community where each student answers what's missing</span>
                            </div>
                            <div style="color: var(--text-secondary, #cbd5e1); font-size: 11px;">
                                Submissions are processed automatically by GitHub Actions CI. Teacher keys and consensus answers are strictly protected from overwrites. Zero tokens or accounts required!
                            </div>
                        </div>

                        ${availableCodes.length === 0 ? `
                            <!-- Empty Local Storage State -->
                            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; text-align: center;">
                                <div style="font-weight: 700; color: var(--accent-pink, #f43f5e); font-size: 13px; margin-bottom: 4px;">No Saved Answers in Local Storage Yet</div>
                                <div style="font-size: 11px; color: var(--text-secondary, #cbd5e1); line-height: 1.5;">
                                    Complete or review a quiz in Moodle to harvest verified answers, or scrape answers from amauoed.com. Once answers are saved in your local storage, you can share them here with 1 click!
                                </div>
                            </div>
                        ` : `
                            <!-- Subject Selection -->
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface-subtle, #0f172a); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                                <div>
                                    <span style="font-weight: 700;">Subject Database:</span>
                                    ${availableCodes.length > 1 ? `
                                        <select id="amaes-contribute-sub-select" style="margin-left: 6px; background: var(--surface, #1e293b); color: var(--text-primary, #f8fafc); border: 1px solid var(--border, #334155); border-radius: 4px; padding: 3px 6px; font-weight: 600;">
                                            ${availableCodes.map(c => `<option value="${c}" ${c === targetCode ? 'selected' : ''}>${c} (${allDbs[c].length} Qs)</option>`).join('')}
                                        </select>
                                    ` : `<b style="color: var(--accent-blue, #38bdf8); margin-left: 4px;">${targetCode}</b>`}
                                </div>
                                <span style="background: ${questions.length > 0 ? '#10b981' : '#f43f5e'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px;">
                                    ${verifiedCount} Verified • ${eliminatedCount} Eliminated
                                </span>
                            </div>

                            <!-- Payload Preview -->
                            <div>
                                <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-secondary, #94a3b8); font-size: 11px;">Contribution Payload Preview (${questions.length} questions):</div>
                                <pre style="background: #020617; color: #a5f3fc; padding: 8px; border-radius: 6px; font-size: 10px; font-family: monospace; max-height: 120px; overflow: auto; border: 1px solid #1e293b; white-space: pre-wrap; word-break: break-all;">${payloadStr.length > 1000 ? payloadStr.slice(0, 1000) + '\n... (truncated for display)' : payloadStr}</pre>
                            </div>

                            <!-- Guide Steps -->
                            <div style="font-size: 11px; color: var(--text-secondary, #94a3b8);">
                                <b>How it works:</b> Clicking <b>"Submit via 1-Click Issue"</b> opens a pre-filled GitHub issue in the open community repository. Click "Submit new issue" on GitHub and the automated merger bot incorporates the new questions within 60 seconds!
                            </div>

                            <!-- Dynamic Feedback Area -->
                            <div id="amaes-contribute-feedback-area" style="display: none;"></div>
                        `}
                    </div>

                    <!-- Footer Actions -->
                    <div style="
                        padding: 10px 18px;
                        background: var(--surface-subtle, #0f172a);
                        border-top: 1px solid var(--border, #334155);
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                        flex-wrap: wrap;
                        align-items: center;
                    ">
                        <button id="amaes-contribute-copy-btn" class="amaes-btn amaes-btn-outline" style="padding: 5px 10px; font-size: 10.5px; cursor: pointer;">
                            ${ICONS.copy} <span>Copy JSON</span>
                        </button>
                        ${hasPatToken ? `
                            <button id="amaes-contribute-token-push-btn" class="amaes-btn amaes-btn-blue" style="padding: 5px 12px; font-size: 10.5px; font-weight: 700; cursor: pointer; border-radius: 6px;" ${questions.length === 0 ? 'disabled' : ''}>
                                ${ICONS.github} <span>Direct Push (via Token)</span>
                            </button>
                        ` : ''}
                        <button id="amaes-contribute-submit-btn" class="amaes-btn" style="padding: 5px 14px; background: linear-gradient(135deg, #10b981, #047857); color: #fff; border: none; font-weight: 700; font-size: 11px; cursor: pointer; border-radius: 6px;" ${questions.length === 0 ? 'disabled' : ''}>
                            ${ICONS.upload} <span>Submit via 1-Click Issue</span>
                        </button>
                    </div>
                </div>
            `;

            const closeBtn = modal.querySelector('#amaes-contribute-close-btn');
            if (closeBtn) closeBtn.onclick = () => modal.remove();

            const selectEl = modal.querySelector('#amaes-contribute-sub-select');
            if (selectEl) {
                selectEl.onchange = (e) => {
                    targetCode = e.target.value;
                    renderModal();
                };
            }

            const copyBtn = modal.querySelector('#amaes-contribute-copy-btn');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    copyToClipboard(payloadStr).then(() => {
                        showToast("Payload JSON copied to clipboard!");
                        copyBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                        setTimeout(() => {
                            copyBtn.innerHTML = `${ICONS.copy} <span>Copy JSON</span>`;
                        }, 2000);
                    }).catch(() => {
                        showToast("Failed to copy JSON");
                    });
                };
            }

            const tokenPushBtn = modal.querySelector('#amaes-contribute-token-push-btn');
            if (tokenPushBtn) {
                tokenPushBtn.onclick = async () => {
                    tokenPushBtn.disabled = true;
                    tokenPushBtn.innerHTML = `${ICONS.rotateCcw} <span>Pushing...</span>`;
                    try {
                        await pushAnswersToGitHub(targetCode, questions, {
                            quizTitle: 'Community Contribution'
                        });
                        showToast(`Successfully pushed ${questions.length} answers directly to GitHub!`);
                        setLog(`Successfully pushed <b>${questions.length}</b> answers directly to GitHub for <b>${targetCode}</b>!`, "var(--accent-green)");
                        const feedbackContainer = modal.querySelector('#amaes-contribute-feedback-area');
                        if (feedbackContainer) {
                            feedbackContainer.style.display = 'block';
                            feedbackContainer.innerHTML = `
                                <div style="background: rgba(16, 185, 129, 0.2); border: 1.5px solid #10b981; border-radius: 8px; padding: 10px 12px; margin-top: 6px;">
                                    <div style="font-weight: 700; color: #34d399; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                        ${ICONS.checkCircle} <span>Successfully Pushed to Cloud Database!</span>
                                    </div>
                                    <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px;">
                                        <b>${questions.length}</b> answers were committed directly to the official community repository.
                                    </div>
                                </div>
                            `;
                        }
                    } catch (err) {
                        alert(`Push failed: ${err.message}`);
                        tokenPushBtn.disabled = false;
                        tokenPushBtn.innerHTML = `${ICONS.github} <span>Direct Push (via Token)</span>`;
                    }
                };
            }

            const submitBtn = modal.querySelector('#amaes-contribute-submit-btn');
            if (submitBtn) {
                submitBtn.onclick = () => {
                    if (!questions || questions.length === 0) {
                        alert("No questions found for this subject to submit.");
                        return;
                    }

                    const issueTitle = `[Contribution] ${targetCode} (${questions.length} questions)`;
                    let issueBody = `### Community Answer Contribution\n\n**Subject**: ${targetCode}\n**Total Questions**: ${questions.length}\n**Submitted At**: ${new Date().toISOString()}\n\n\`\`\`json\n${payloadStr}\n\`\`\`\n`;
                    let autoCopied = false;

                    // If URL query string exceeds safe browser/HTTP limits (~3500 chars), auto-copy full JSON and provide clean paste prompt
                    if (encodeURIComponent(issueBody).length > 3500) {
                        copyToClipboard(payloadStr);
                        autoCopied = true;
                        issueBody = `### Community Answer Contribution\n\n**Subject**: ${targetCode}\n**Total Questions**: ${questions.length}\n**Submitted At**: ${new Date().toISOString()}\n\n> [!NOTE]\n> The JSON payload (${questions.length} questions) was automatically copied to your clipboard!\n> Simply press **Ctrl + V** (or Cmd + V) below inside this text box to paste it, then click **"Submit new issue"**.\n\n\`\`\`json\nPASTE_HERE\n\`\`\`\n`;
                    }

                    const ghUrl = `https://github.com/lms-study-hub/database/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels=community-contribution`;
                    
                    window.open(ghUrl, '_blank');

                    // Provide immediate, unmissable in-modal feedback
                    const feedbackContainer = modal.querySelector('#amaes-contribute-feedback-area');
                    if (feedbackContainer) {
                        feedbackContainer.style.display = 'block';
                        feedbackContainer.innerHTML = `
                            <div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid var(--accent-green, #10b981); border-radius: 8px; padding: 10px 12px; margin-top: 6px;">
                                <div style="font-weight: 700; color: #34d399; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                    ${ICONS.checkCircle} <span>Submission Page Opened in New Tab!</span>
                                </div>
                                <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px; line-height: 1.45;">
                                    ${autoCopied ? `<b>Payload Copied!</b> Your ${questions.length} questions were auto-copied to your clipboard. Go to the new GitHub tab, press <b>Ctrl + V</b> in the box, and click <b>"Submit new issue"</b>!` : `<b>Final Step:</b> Go to the newly opened GitHub tab and click the green <b>"Submit new issue"</b> button. The automated bot will merge your answers into the cloud database within 60 seconds!`}
                                </div>
                                <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
                                    <a href="${ghUrl}" target="_blank" rel="noopener noreferrer" class="amaes-btn amaes-btn-blue" style="font-size: 10px; padding: 4px 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                                        ${ICONS.external} <span>Open GitHub Tab (If Blocked by Browser)</span>
                                    </a>
                                </div>
                            </div>
                        `;
                    }
                    showToast(autoCopied ? "JSON auto-copied! GitHub opened." : "GitHub submission page opened!");
                    setLog(`Opened GitHub community submission page for <b>${targetCode}</b>`, "var(--accent-green)");
                };
            }
        }

        document.body.appendChild(modal);
        renderModal();
    }

    // ==========================================
    // ==========================================
    // Welcome & Quick-Start Onboarding Modal
    // ==========================================

    function showWelcomeOnboardingModal(force = false) {
        if (!force && (!isUserLoggedIn() || localStorage.getItem('amaes_welcome_dismissed') === 'true')) {
            return;
        }

        const existing = document.getElementById('amaes-welcome-modal');
        if (existing) existing.remove();

        const courseInfo = detectCourseInfo();
        const currentSubCode = (courseInfo && courseInfo.subjectCode && courseInfo.subjectCode !== 'GENERAL' && courseInfo.subjectCode !== 'DEFAULT') ? courseInfo.subjectCode : null;
        const dashCourses = detectDashboardCourses();

        let statusHtml = '';
        if (currentSubCode) {
            statusHtml = `
                <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 6px 10px; font-size: 10.5px; display: flex; align-items: center; justify-content: space-between;">
                    <span>Current Subject: <b style="color: #34d399;">${currentSubCode}</b></span>
                    <span style="font-size: 9.5px; color: #a7f3d0; font-weight: 600;">Ready to auto-sync</span>
                </div>
            `;
        } else if (dashCourses.length > 0) {
            statusHtml = `
                <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 7px 10px; font-size: 10.5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: #93c5fd;">Detected ${dashCourses.length} Dashboard Course${dashCourses.length > 1 ? 's' : ''}:</span>
                        <span style="font-size: 9.5px; color: #34d399; font-weight: 700;">1-Click Auto-Sync</span>
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${dashCourses.map(c => `<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 1px 6px; border-radius: 3px; font-size: 9.5px; font-weight: 700; font-family: monospace;">${c.code}</span>`).join('')}
                    </div>
                </div>
            `;
        } else {
            statusHtml = `
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 6px 10px; font-size: 10.5px; color: #fcd34d;">
                    <b>Next Step:</b> Open any course from your dashboard — the toolkit will auto-sync verified answers immediately!
                </div>
            `;
        }

        const modal = document.createElement('div');
        modal.id = 'amaes-welcome-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--surface, #1e293b);
                border: 1px solid var(--border, #334155);
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                overflow: hidden;
                color: var(--text-primary, #f8fafc);
                display: flex;
                flex-direction: column;
                max-height: 90vh;
            ">
                <!-- Header with AMAES + ACLC Logo -->
                <div style="
                    padding: 12px 18px;
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    border-bottom: 1px solid var(--border, #334155);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 800; font-size: 14px; color: #fff;">AMAES</span>
                        <img class="amaes-aclc-logo" src="${getAclcLogoSrc()}" alt="ACLC" title="ACLC College" style="height: 17px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));" />
                        <span style="font-weight: 800; font-size: 14px; color: #fff;">Moodle Toolkit</span>
                        <span style="font-size: 10px; background: rgba(16, 185, 129, 0.2); color: var(--accent-green, #10b981); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${SCRIPT_VERSION}</span>
                    </div>
                    <button id="btn-close-welcome" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer; padding: 2px 6px; line-height: 1;" title="Close">&times;</button>
                </div>

                <!-- Body Scrollable -->
                <div style="padding: 14px 18px; overflow-y: auto; font-size: 11.5px; line-height: 1.5; display: flex; flex-direction: column; gap: 10px;">
                    
                    <!-- 1. Quick Start Guide (How To Use & Auto-Sync) -->
                    <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 700; color: #60a5fa; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                ${ICONS.zap} <span>Quick Start: How To Use (Zero Setup)</span>
                            </div>
                            <span style="font-size: 9.5px; color: var(--text-muted);">Autonomous & Hands-Free</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: var(--text-secondary, #cbd5e1);">
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <span style="background: rgba(59, 130, 246, 0.25); color: #93c5fd; font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-top: 1px;">STEP 1</span>
                                <span><b>Open Any Course Page:</b> Click into any subject. The toolkit automatically detects your subject code (e.g. <code>CS6301</code>) and <b>auto-syncs the verified database</b> in the background — no manual importing needed!</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <span style="background: rgba(16, 185, 129, 0.25); color: #34d399; font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-top: 1px;">STEP 2</span>
                                <span><b>Take Quizzes Hands-Free:</b> Verified answers highlight in green automatically. Eliminates wrong options during retakes so you never guess the same wrong choice twice.</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <span style="background: rgba(167, 139, 250, 0.25); color: #c4b5fd; font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-top: 1px;">STEP 3</span>
                                <span><b>Auto-Harvest & Share:</b> Completed past quizzes and reviews are harvested and anonymously shared so everyone always has up-to-date answers.</span>
                            </div>
                        </div>
                        ${statusHtml}
                    </div>

                    <!-- 2. Community-Driven Auto-Share Card (Anonymous & Autonomous) -->
                    <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 700; color: #34d399; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                ${ICONS.upload} <span>Community-Driven Auto-Share</span>
                            </div>
                            <span style="font-size: 9.5px; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 1px 6px; border-radius: 4px; font-weight: 700;">100% Anonymous</span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary, #cbd5e1); line-height: 1.45;">
                            This toolkit is completely student-driven! As you complete quizzes using your account, verified answers are <b>automatically shared to the global student database</b> so question banks stay up to date for you and your classmates.
                        </div>
                        <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 6px; padding: 7px 9px; font-size: 10px; color: #cbd5e1; line-height: 1.45;">
                            <div style="font-weight: 700; color: #e2e8f0; margin-bottom: 2px;">Safe & 100% Anonymous Guarantee:</div>
                            • <b>Zero Personal Data:</b> Your student ID, name, email, account password, and Moodle tokens are <b>NEVER</b> transmitted or saved.<br/>
                            • <b>Only Question & Answer Texts:</b> Only the question prompt and verified teacher-marked answers are contributed.<br/>
                            • <b>Autonomous:</b> Runs seamlessly in the background as you study — no files or GitHub setup needed.
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 2px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-primary); cursor: pointer;" title="Automatically pull and sync verified community answers when opening any course page">
                                <input id="welcome-chk-sync" type="checkbox" ${autoCloudSync ? 'checked' : ''} style="cursor: pointer;" />
                                <span style="font-weight: 600;">Auto-sync verified questions when opening courses</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-primary); cursor: pointer;" title="Automatically & anonymously share verified answers to the community hub on quiz review">
                                <input id="welcome-chk-share" type="checkbox" ${autoCommunityShare ? 'checked' : ''} style="cursor: pointer;" />
                                <span style="font-weight: 600; color: #34d399;">Automatically & anonymously share verified answers to the world</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-primary); cursor: pointer;" title="Automatically scan and harvest answers from completed quizzes on course or grade report load">
                                <input id="welcome-chk-harvest" type="checkbox" ${autoHarvestGrades ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Auto-harvest confirmed answers from past quizzes in Grade Report</span>
                            </label>
                        </div>
                    </div>

                    <!-- 3. Zero-Friction Study (Quick Keys) -->
                    <div id="welcome-shortcuts-section" style="background: rgba(167, 139, 250, 0.08); border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 700; color: #c4b5fd; font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
                                ${ICONS.zap} <span>Instant Solvers & Shortcuts</span>
                            </div>
                            <span style="font-size: 9.5px; color: var(--text-muted);">Fully Automatic</span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary, #cbd5e1); line-height: 1.45;">
                            Open any course or quiz. The toolkit <b>automatically highlights verified answers in green</b> (100% confidence) and marks known wrong choices in red.
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text-secondary, #cbd5e1); background: rgba(0,0,0,0.25); padding: 5px 8px; border-radius: 5px; flex-wrap: wrap;">
                            <span style="color: #cbd5e1;"><kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">N</kbd> / <kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">Space</kbd> Next</span>
                            <span style="color: #cbd5e1;"><kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">1-4</kbd> Pick Choice</span>
                            <span style="color: #cbd5e1;"><kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">C</kbd> Copy AI</span>
                            <span style="color: #cbd5e1;"><kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">V</kbd> Paste AI</span>
                            <span style="color: #cbd5e1;"><kbd style="background: var(--surface, #334155); color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5px; font-weight: 700;">P</kbd> Pause</span>
                        </div>
                    </div>

                    <!-- 4. Share with Classmates / Browser Setup (Collapsible) -->
                    <details style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 10px;">
                        <summary style="font-size: 11px; font-weight: 600; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                ${ICONS.share} <span>Share with Classmates / Setup Guide</span>
                            </span>
                            <span style="font-size: 9px; color: var(--text-muted);">Expand</span>
                        </summary>
                        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; font-size: 11px; color: var(--text-secondary);">
                            <div>Need to help a classmate install this toolkit? Violentmonkey + Developer Mode is all that's required:</div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button id="btn-copy-install-guide" class="amaes-btn amaes-btn-outline" style="font-size: 10px; padding: 4px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                    ${ICONS.copy} <span>Copy Classmate Guide to Clipboard</span>
                                </button>
                                <button id="btn-welcome-share-hub" class="amaes-btn amaes-btn-green" style="font-size: 10px; padding: 4px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                    ${ICONS.upload} <span>Share Database to Hub</span>
                                </button>
                            </div>
                        </div>
                    </details>

                </div>

                <!-- Footer Actions -->
                <div style="
                    padding: 10px 18px;
                    border-top: 1px solid var(--border, #334155);
                    background: rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                ">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button id="btn-welcome-check-update" class="amaes-btn amaes-btn-outline" style="font-size: 10.5px; padding: 5px 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            ${ICONS.rotateCcw} <span id="welcome-update-label">Check Updates</span>
                        </button>
                        <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" style="
                            color: #93c5fd;
                            text-decoration: none;
                            font-size: 10.5px;
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            padding: 5px 8px;
                        ">
                            ${ICONS.github} <span>Repo</span>
                        </a>
                    </div>
                    ${dashCourses.length > 0 ? `
                        <button id="btn-got-it-welcome" class="amaes-btn amaes-btn-green" style="padding: 6px 16px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            ${ICONS.zap} <span>Got It & Auto-Sync My Courses</span>
                        </button>
                    ` : currentSubCode ? `
                        <button id="btn-got-it-welcome" class="amaes-btn amaes-btn-green" style="padding: 6px 16px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            ${ICONS.zap} <span>Got It & Auto-Sync ${currentSubCode}</span>
                        </button>
                    ` : `
                        <button id="btn-got-it-welcome" class="amaes-btn amaes-btn-green" style="padding: 6px 16px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            ${ICONS.checkCircle} <span>Got It, Let's Start!</span>
                        </button>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind interactive settings checkboxes
        const bindWelcomeToggle = (id, storageKey, onToggle) => {
            const el = document.getElementById(id);
            if (el) {
                el.onchange = (e) => {
                    localStorage.setItem(storageKey, e.target.checked);
                    if (onToggle) onToggle(e.target.checked);
                };
            }
        };

        bindWelcomeToggle('welcome-chk-sync', 'amaes_auto_cloud_sync', (v) => {
            autoCloudSync = v;
            const p = document.getElementById('chk-auto-cloud-sync');
            if (p) p.checked = v;
        });
        bindWelcomeToggle('welcome-chk-share', 'amaes_auto_community_share', (v) => {
            autoCommunityShare = v;
            const p = document.getElementById('chk-auto-community-share');
            if (p) p.checked = v;
        });
        bindWelcomeToggle('welcome-chk-harvest', 'amaes_auto_harvest_grades', (v) => {
            autoHarvestGrades = v;
            const p = document.getElementById('chk-auto-harvest-grades');
            if (p) p.checked = v;
        });

        const btnWelcomeShareHub = document.getElementById('btn-welcome-share-hub');
        if (btnWelcomeShareHub) {
            btnWelcomeShareHub.onclick = () => {
                showCommunityContributionModal(currentSubCode);
            };
        }

        const btnWelcomeUpdate = document.getElementById('btn-welcome-check-update');
        const welcomeUpdateLabel = document.getElementById('welcome-update-label');
        if (btnWelcomeUpdate) {
            btnWelcomeUpdate.onclick = () => {
                if (welcomeUpdateLabel) welcomeUpdateLabel.textContent = "Checking...";
                checkForScriptUpdates(true, (res) => {
                    if (res && res.status === 'update_available') {
                        if (welcomeUpdateLabel) welcomeUpdateLabel.textContent = `v${res.version} Available!`;
                    } else if (res && res.status === 'up_to_date') {
                        if (welcomeUpdateLabel) welcomeUpdateLabel.textContent = "Up to date!";
                    } else {
                        if (welcomeUpdateLabel) welcomeUpdateLabel.textContent = "Check Updates";
                    }
                });
            };
        }

        const btnCopyInstallGuide = document.getElementById('btn-copy-install-guide');
        if (btnCopyInstallGuide) {
            btnCopyInstallGuide.onclick = () => {
                const guideText = `AMAES & ACLC Moodle Toolkit - Setup & Installation Guide\n\n` +
                    `Step 1: Install Violentmonkey (Recommended Userscript Manager):\n` +
                    `• Chrome / Brave: https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag\n` +
                    `• Firefox: https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/\n` +
                    `• Edge: https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjfgddacbcigncyclcoaebeent\n\n` +
                    `Step 2 (CRITICAL for Chrome / Brave / Edge / Opera):\n` +
                    `• Open chrome://extensions (or edge://extensions) in your browser.\n` +
                    `• Turn ON "Developer mode" in the top-right corner.\n` +
                    `(Without Developer mode, modern Chromium browsers block all userscripts from running!)\n\n` +
                    `Step 3: Install the Script:\n` +
                    `• Open this raw link: ${SCRIPT_RAW_URL}\n` +
                    `• Violentmonkey will open a tab — click "Confirm installation".\n\n` +
                    `Step 4: Go to https://semestral.amaes.com/ and log in!\n` +
                    `The toolkit panel will automatically appear in the bottom-right corner!`;

                if (typeof GM_setClipboard !== 'undefined') {
                    GM_setClipboard(guideText);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(guideText);
                }
                showToast("Setup & install guide copied to clipboard!");
            };
        }

        const dismiss = () => {
            localStorage.setItem('amaes_welcome_dismissed', 'true');
            modal.remove();

            // Trigger auto-sync immediately if enabled
            if (autoCloudSync) {
                if (dashCourses.length > 0) {
                    showToast(`Auto-syncing answers for ${dashCourses.length} courses...`, 3000);
                    setLog(`Auto-syncing ${dashCourses.length} courses from community database...`, "var(--accent-blue)");
                    dashCourses.forEach(c => {
                        sessionStorage.setItem(`amaes_cloud_synced_${c.code}`, '1');
                        syncAnswersFromCloud(c.code).then(res => {
                            if (res && res.count > 0) {
                                injectDashboardCourseBadges();
                            }
                        }).catch(e => {
                            logDebug(`Auto-sync error for ${c.code}: ${e.message}`);
                        });
                    });
                } else if (currentSubCode) {
                    if (!sessionStorage.getItem(`amaes_cloud_synced_${currentSubCode}`)) {
                        sessionStorage.setItem(`amaes_cloud_synced_${currentSubCode}`, '1');
                        setLog(`Auto-syncing community database for <b>${currentSubCode}</b>...`, "var(--accent-blue)");
                        syncAnswersFromCloud(currentSubCode).then(res => {
                            if (res && res.count > 0) {
                                showToast(`Auto-synced ${res.count} community answers for ${currentSubCode}!`);
                                setLog(`Auto-synced <b>${res.count}</b> answers for <b>${currentSubCode}</b> from Cloud Hub.`, "var(--accent-green)");
                                const fresh = getCachedAnswers(currentSubCode);
                                const lbl = document.getElementById('fetch-btn-label');
                                if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;
                                if (checkIsQuizPage()) {
                                    highlightQuizAnswers(fresh, false);
                                }
                            }
                        });
                    }
                } else {
                    showToast("Open any course to automatically sync verified answers!", 4000);
                }
            }
        };

        const _el__btn_close_welcome_ = document.getElementById('btn-close-welcome');
        if (_el__btn_close_welcome_) _el__btn_close_welcome_.onclick = dismiss;
        const _el__btn_got_it_welcome_ = document.getElementById('btn-got-it-welcome');
        if (_el__btn_got_it_welcome_) _el__btn_got_it_welcome_.onclick = dismiss;
        modal.onclick = (e) => {
            if (e.target === modal) dismiss();
        };
    }

    // UI Panel Construction
    // ==========================================

    function createPanel() {
        if (document.getElementById('amaes-toolkit-panel')) return;

        const courseInfo = detectCourseInfo();
        const allLocalDbs = getAllSavedSubjectDatabases();
        const cachedCodes = Object.keys(allLocalDbs);
        const cardCodes = [];
        document.querySelectorAll('.coursebox, .dashboard-card, [data-course-id], .course-info-container').forEach(card => {
            const txt = card.innerText || '';
            const m = txt.match(/\b([A-Za-z]{2,4}\d{4})\b/);
            if (m && !cardCodes.includes(m[1].toUpperCase())) {
                cardCodes.push(m[1].toUpperCase());
            }
        });
        const detectedCodes = Array.from(new Set([...(courseInfo.subjectCode ? [courseInfo.subjectCode] : []), ...cachedCodes, ...cardCodes]));
        let subCode = courseInfo.subjectCode || detectedCodes[0] || '';
        const defaultAmauoedUrl = subCode ? getStoredAmauoedUrl(subCode) : '';
        const cachedQuestions = subCode ? getCachedAnswers(subCode) : null;
        const isQuiz = checkIsQuizPage();

        let initialKeyword = "";
        if (courseInfo.subjectCode) {
            initialKeyword = courseInfo.currentActivityTitle
                ? `${courseInfo.subjectCode} ${courseInfo.currentActivityTitle} answer key`
                : `${courseInfo.subjectCode} answer key`;
        }

        const panel = document.createElement('div');
        panel.id = 'amaes-toolkit-panel';

        panel.innerHTML = `
            <!-- Top App Bar (Overflow-Proof) -->
            <div id="amaes-header">
                <div id="amaes-brand">
                    <div id="amaes-title-group" style="display: flex; align-items: center; gap: 4px;">
                        <span id="amaes-title">AMAES</span>
                        <img class="amaes-aclc-logo" src="${getAclcLogoSrc()}" alt="ACLC" title="ACLC College" style="height: 18px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); margin: 0 2px;" />
                        <span id="amaes-version-pill" title="${SCRIPT_VERSION} • Click to check for updates" style="font-size: 9px; font-weight: 700; color: var(--accent-blue, #3b82f6); background: rgba(59,130,246,0.12); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(59,130,246,0.25); cursor: pointer; user-select: none;">${SCRIPT_VERSION}</span>
                    </div>
                </div>
                
                <div id="amaes-actions">
                    <button id="amaes-reset-btn" class="amaes-icon-btn" title="Reset All Settings to Safe Defaults">
                        ${ICONS.rotateCcw}
                    </button>

                    <button id="amaes-help-btn" class="amaes-icon-btn" title="Quick Start Guide & Documentation">
                        ${ICONS.help}
                    </button>

                    <a id="amaes-home-btn" class="amaes-icon-btn" href="${HOME_URL}" title="Dashboard (My Courses)">
                        ${ICONS.home}
                    </a>

                    <button id="amaes-theme-btn" class="amaes-icon-btn" title="Toggle Dark / Light Theme">
                        ${currentTheme === 'dark' ? ICONS.sun : ICONS.moon}
                    </button>

                    ${DEBUG_MODE ? `
                    <button id="amaes-debug-btn" class="amaes-icon-btn amaes-debug-btn" title="Copy AI Diagnostic Report">
                        ${ICONS.debug}
                    </button>` : ''}

                    <button id="amaes-min-btn" class="amaes-icon-btn" title="Minimize / Expand">
                        ${ICONS.minimize}
                    </button>
                </div>
            </div>

            <!-- Main Panel Body -->
            <div id="amaes-panel-body">

                <!-- Dynamic Update Notification Container -->
                <div id="amaes-update-container"></div>

                <!-- Course Database Status Banner (Single-Line Compact) -->
                <div id="amaes-course-db-badge" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 5px 8px;
                    background: ${cachedQuestions && cachedQuestions.length > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'};
                    border: 1px solid ${cachedQuestions && cachedQuestions.length > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
                    border-radius: 6px;
                    margin-bottom: 6px;
                    font-size: 11px;
                ">
                    <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; white-space: nowrap;">
                        <span style="font-weight: 800; color: var(--text-primary);">
                            ${subCode}
                        </span>
                        <span style="color: ${cachedQuestions && cachedQuestions.length > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}; font-weight: 600; text-overflow: ellipsis; overflow: hidden;">
                            • ${cachedQuestions && cachedQuestions.length > 0 ? `${cachedQuestions.length} Answers` : '0 Answers in DB'}
                        </span>
                    </div>
                    <span style="font-size: 9px; background: ${cachedQuestions && cachedQuestions.length > 0 ? '#10b981' : '#ef4444'}; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700; white-space: nowrap; flex-shrink: 0;">
                        ${cachedQuestions && cachedQuestions.length > 0 ? 'READY' : 'NO DB'}
                    </span>
                </div>

                <!-- Categorized Persona Navigation Tabs -->
                <div id="amaes-nav-tabs">
                    <button class="amaes-tab-btn" data-tab="quiz" title="Autonomous Quiz Solver, AI Prompts & In-Quiz Assistance">
                        ${ICONS.target} <span>Quiz Solver</span>
                    </button>
                    <button class="amaes-tab-btn" data-tab="db" title="Cloud Database Sync, Verification & Sharing">
                        ${ICONS.database} <span>Answer DB</span>
                    </button>
                    <button class="amaes-tab-btn" data-tab="course" title="Batch Lecture Auto-Marker, Highlighters & Search">
                        ${ICONS.tools} <span>Course Tools</span>
                    </button>
                </div>

                <!-- TAB PANE 1: Quiz Solver -->
                <div id="tab-pane-quiz" class="amaes-tab-pane" style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                    <!-- Master Run / Pause Button -->
                    <button id="btn-master-auto-quiz" class="amaes-btn" style="justify-content: center; padding: 7px; font-weight: 700; font-size: 11px; border: none; background: ${autoQuizMode ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'}; color: #fff; cursor: pointer;" title="Toggle hands-free Autonomous Quiz Solver (Shortcut: P)">
                        ${autoQuizMode ? ICONS.stop + ' <span>Pause Auto-Quiz</span>' : ICONS.play + ' <span>Start Auto-Quiz</span>'}
                    </button>

                    <!-- Personality Selector (Speedrun vs Co-Pilot) -->
                    <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 2px;">
                        <label style="font-size: 10px; color: var(--text-muted); font-weight: 600;" title="Choose how the solver behaves when encountering questions">Solver Personality:</label>
                        <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 6px;">
                            <button id="btn-personality-passive" class="amaes-btn ${quizPersonality === 'passive' ? 'amaes-btn-blue' : 'amaes-btn-outline'}" style="flex: 1; justify-content: center; font-size: 10px; padding: 4px 2px; cursor: pointer;" title="Co-Pilot: Automatically answers known questions from database. When an unknown question is reached, safely pauses, auto-copies for AI, and waits for your input.">
                                ${ICONS.shieldCheck} <span>Co-Pilot</span>
                            </button>
                            <button id="btn-personality-aggressive" class="amaes-btn ${quizPersonality === 'aggressive' ? 'amaes-btn-pink' : 'amaes-btn-outline'}" style="flex: 1; justify-content: center; font-size: 10px; padding: 4px 2px; cursor: pointer;" title="Speedrun: Auto-picks known answers and skips unknown questions immediately without pausing.">
                                ${ICONS.fastForward} <span>Speedrun (Fast)</span>
                            </button>
                        </div>
                        <div id="personality-desc" style="font-size: 9.5px; color: var(--text-secondary); line-height: 1.3; margin-top: 1px;">
                            ${quizPersonality === 'aggressive'
                                ? '<b>Speedrun:</b> Auto-picks answers, skips unknown questions immediately, and auto-submits when done.'
                                : '<b>Co-Pilot:</b> Auto-picks answers. On unknown question: safely pauses, auto-copies for AI, and waits for your input.'}
                        </div>
                    </div>

                    <!-- Action Buttons: Quick Highlight & Copy for AI & Paste AI -->
                    <div style="display: flex; gap: 4px; margin-top: 2px;">
                        <button id="btn-quick-hl" class="amaes-btn amaes-btn-green" style="flex: 1; justify-content: center; padding: 4px 4px; cursor: pointer; font-size: 10px;" title="Highlight confirmed answers from database on current quiz questions (Shortcut: H)">
                            ${ICONS.lightbulb} <span>Highlight (H)</span>
                        </button>
                        <button id="btn-copy-curr-q" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 4px 4px; cursor: pointer; font-size: 10px;" title="Copy current question & choices formatted for AI (Shortcut: C)">
                            ${ICONS.copy} <span>Copy (C)</span>
                        </button>
                        <button id="btn-paste-ai-ans" class="amaes-btn amaes-btn-blue" style="flex: 1.1; justify-content: center; padding: 4px 4px; cursor: pointer; font-size: 10px;" title="Read AI answer from clipboard and auto-select matching choice (Shortcut: V)">
                            ${ICONS.clipboard} <span>Paste AI (V)</span>
                        </button>
                    </div>

                    <!-- Solver & AI Toggles -->
                    <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 2px; border-top: 1px solid var(--border-subtle); padding-top: 4px;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent-green); cursor: pointer; font-weight: 600;" title="When checked, automatically selects the radio button / checkbox of verified answers found in database">
                            <input id="chk-auto-pick" type="checkbox" ${autoPickQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Auto-Pick verified answers from DB</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent-blue); cursor: pointer; font-weight: 600;" title="When checked, automatically advances to next page after all questions on this page are answered">
                            <input id="chk-auto-next" type="checkbox" ${autoNextQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Auto-Next page (after answering)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent-blue); cursor: pointer; font-weight: 600;" title="Smart Navigation: Bypass questions already answered by auto-answer and jump straight to unanswered questions">
                            <input id="chk-smart-skip" type="checkbox" ${smartSkipQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Smart Skip: Jump directly to unanswered questions</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent-pink); cursor: pointer; font-weight: 600;" title="Automatically click 'Submit all and finish' on quiz summary to load review and harvest answers">
                            <input id="chk-auto-submit" type="checkbox" ${autoSubmitQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Auto-Submit to Review (Check & Harvest Answers)</span>
                        </label>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #a78bfa; cursor: pointer; font-weight: 600;" title="Keyboard shortcuts: Space / N for Next page, C for Copy AI, V for Paste AI, P for Pause/Start, 1-4 / A-D to pick choices">
                                <input id="chk-keyboard-shortcuts" type="checkbox" ${enableKeyboardShortcuts ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Keyboard Shortcuts (N, C, V, P, 1-4)</span>
                            </label>
                            <button id="btn-show-shortcuts-guide" type="button" class="amaes-inline-btn" style="padding: 1px 6px; font-size: 9.5px; background: rgba(167, 139, 250, 0.15); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 4px; cursor: pointer; font-weight: 700;" title="View Keyboard Shortcuts Cheatsheet">
                                [Keys]
                            </button>
                        </div>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-muted); cursor: pointer;" title="Auto-minimize toolkit panel to floating smart pill during quiz attempts to avoid blocking questions">
                            <input id="chk-auto-min-quiz" type="checkbox" ${autoMinimizeQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Auto-minimize panel during quiz attempts</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-muted); cursor: pointer;" title="Inject convenient 'Copy AI' and 'Copy Image' buttons directly above question cards in the Moodle page">
                            <input id="chk-show-in-q-btns" type="checkbox" ${showInQuestionAiBtns ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Show "Copy for AI" buttons inside questions</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-muted); cursor: pointer;" title="Appends strict directive 'Answer ONLY with option letter and exact text' to AI prompt">
                            <input id="chk-ai-prompt-hint" type="checkbox" ${aiPromptHint ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Strict AI prompt (a, b, c, d only)</span>
                        </label>
                    </div>

                    <!-- Clean Zero-Setup Status Strip -->
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 5px 8px; border-radius: 5px; margin-top: 2px;">
                        <span style="display: flex; align-items: center; gap: 5px; color: #34d399; font-weight: 600;">${ICONS.checkCircle} <span>Answers highlight automatically</span></span>
                        <span style="color: var(--text-secondary);">Press <kbd style="background: var(--surface, #334155); color:#fff; padding:1px 4px; border-radius:3px; font-family:monospace; font-size:9px;">[Keys]</kbd> for shortcuts</span>
                    </div>
                </div>

                <!-- TAB PANE 2: Verified Answer Database -->
                <div id="tab-pane-db" class="amaes-tab-pane" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                    <!-- Course Selector for Dashboard / Non-Course Pages -->
                    ${!courseInfo.subjectCode && detectedCodes.length > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: var(--surface-subtle); padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11px;">
                            <span style="font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">${ICONS.book} Active Course:</span>
                            <select id="amaes-select-active-course" style="background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-weight: 700; font-size: 11px; cursor: pointer;">
                                ${detectedCodes.map(c => `<option value="${c}" ${c === subCode ? 'selected' : ''}>${c} (${(allLocalDbs[c] || []).length} Qs)</option>`).join('')}
                                <option value="_custom">+ Enter Custom Code...</option>
                            </select>
                        </div>
                    ` : ''}

                    <!-- Term Coverage Breakdown Card -->
                    <div id="amaes-term-coverage-card" style="background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700;">
                            <span style="color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                                ${ICONS.target} <span>Term Coverage:</span>
                            </span>
                            <span id="amaes-term-summary" style="font-size: 9.5px; color: var(--accent-green);">Loading...</span>
                        </div>
                        <div id="amaes-term-pills" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                            <!-- Populated dynamically by updateTermCoverageUI -->
                        </div>
                    </div>

                    <!-- Primary 1-Click Actions: Pull, Harvest & Share -->
                    <div style="display: flex; gap: 5px;">
                        <button id="btn-cloud-sync" class="amaes-btn amaes-btn-blue" style="flex: 1; justify-content: center; padding: 6px; font-size: 10.5px; font-weight: 700;" title="Pull verified answers directly from free GitHub community database">
                            ${ICONS.cloudDownload} <span>Cloud Sync</span>
                        </button>
                        <button id="btn-harvest-grades-db" class="amaes-btn amaes-btn-green" style="flex: 1.15; justify-content: center; padding: 6px; font-size: 10.5px; font-weight: 700;" title="Scan course Grade Report to harvest and sync all completed past quizzes">
                            ${ICONS.download} <span>Harvest Quizzes</span>
                        </button>
                        <button id="btn-contribute-db" class="amaes-btn amaes-btn-outline" style="padding: 6px 8px; justify-content: center; font-size: 10px; font-weight: 700;" title="Share collected verified answers to the community GitHub hub">
                            ${ICONS.upload} <span>Share</span>
                        </button>
                    </div>

                    <!-- Consolidated Import / Export & Files Accordion -->
                    <details style="border: 1px solid var(--border-subtle); border-radius: 6px; padding: 5px 7px; background: rgba(0,0,0,0.15);">
                        <summary style="font-size: 10px; font-weight: 700; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span>Import / Export & Files</span>
                            <span style="font-size: 9px; color: var(--text-muted);">Expand</span>
                        </summary>
                        <div style="display: flex; gap: 4px; margin-top: 6px;">
                            <button id="btn-export-json" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 4px 4px; font-size: 10px;" title="Download cached verified answers as a JSON file">
                                ${ICONS.download} <span>Export</span>
                            </button>
                            <button id="btn-import-json" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 4px 4px; font-size: 10px;" title="Import & cross-reference JSON files with consensus conflict resolution">
                                ${ICONS.upload} <span>Import</span>
                            </button>
                            <button id="btn-share-guide" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 4px 4px; font-size: 10px;" title="Copy clean study guide text to clipboard to share on Messenger or Discord">
                                ${ICONS.share} <span>Share</span>
                            </button>
                            <input id="file-import-json" type="file" multiple accept=".json" style="display: none;" />
                        </div>
                    </details>

                    <!-- Advanced AMAUOED Study Guide Scraper -->
                    <details style="border: 1px solid var(--border-subtle); border-radius: 6px; padding: 5px 7px; background: rgba(0,0,0,0.15);">
                        <summary style="font-size: 10px; font-weight: 700; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span>AMAUOED Study Guide Scraper</span>
                            <span style="font-size: 9px; color: var(--text-muted);">Expand</span>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                            <!-- AMAUOED Scraper -->
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input id="amauoed-url-input" type="text" value="${defaultAmauoedUrl}" placeholder="Paste or auto-find amauoed.com link..." title="AMAUOED course answer key URL" style="
                                    flex: 1;
                                    min-width: 0;
                                    background: var(--bg);
                                    color: var(--text-primary);
                                    border: 1px solid var(--border);
                                    padding: 4px 6px;
                                    border-radius: 5px;
                                    font-size: 10.5px;
                                    box-sizing: border-box;
                                    outline: none;
                                " />
                                <button id="btn-autofind-amauoed" type="button" class="amaes-btn amaes-btn-blue" style="width: auto; padding: 4px 6px; font-size: 9.5px; font-weight: 600; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;" title="Auto-find & link amauoed.com study guide for ${subCode}">
                                    ${ICONS.search} <span>Auto-Find</span>
                                </button>
                            </div>
                            <div id="amauoed-url-match-badge" style="display: none; font-size: 10px; padding: 3px 5px; border-radius: 4px; line-height: 1.35; box-sizing: border-box;"></div>
                            <button id="btn-fetch-amauoed" class="amaes-btn amaes-btn-outline" style="justify-content: center; padding: 4px; font-size: 10px;" title="Scrape and cache questions from the linked AMAUOED course URL">
                                ${ICONS.download} <span id="fetch-btn-label">${cachedQuestions ? `Scrape & Cache (${cachedQuestions.length} in DB)` : 'Scrape & Cache'}</span>
                            </button>

                            <!-- Advanced review triggers -->
                            <div style="display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--border-subtle); padding-top: 4px;">
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically download JSON backup when viewing a quiz review page">
                                    <input id="chk-auto-dl-json" type="checkbox" ${localStorage.getItem('amaes_auto_dl_json') === 'true' ? 'checked' : ''} style="cursor: pointer;" />
                                    <span>Auto-download JSON on Review</span>
                                </label>
                            </div>
                        </div>
                    </details>

                    <!-- Auto Settings for Sync & Sharing -->
                    <div style="display: flex; flex-direction: column; gap: 4px; background: var(--surface-subtle); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically scan and harvest answers from completed quizzes on course or grade report load (Default: ON)">
                            <input id="chk-auto-harvest-grades" type="checkbox" ${autoHarvestGrades ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--accent-green);">Auto-harvest past quizzes from Grades</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically pull and sync verified community answers when opening a course page">
                            <input id="chk-auto-cloud-sync" type="checkbox" ${autoCloudSync ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--text-primary);">Auto-pull community answers on course open</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically queue / share verified answers to Community Hub on quiz review (Default: ON)">
                            <input id="chk-auto-community-share" type="checkbox" ${autoCommunityShare ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--accent-green);">Auto-share verified answers on Review</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically highlight verified answers whenever you navigate to a quiz page">
                            <input id="chk-auto-hl-quiz" type="checkbox" ${autoHighlightQuiz ? 'checked' : ''} style="cursor: pointer;" />
                            <span>Auto-highlight on quiz open</span>
                        </label>
                    </div>
                </div>

                <!-- TAB PANE 3: Course Automation Tools -->
                <div id="tab-pane-course" class="amaes-tab-pane" style="display: none;">
                    <!-- MODULE 1: Auto-Marker & Undo -->
                <div id="mod-marker-card" class="amaes-card">
                    <div id="mod-marker-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.check}
                            <span class="header-label">Activity Auto-Marker</span>
                        </div>
                        <span id="mod-marker-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-marker-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div class="amaes-subcard">
                            <div id="sub-done-header" class="amaes-subcard-header">
                                <span class="sub-label" style="color: var(--accent-green);">${ICONS.check} Mark as Done</span>
                                <span id="sub-done-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                            </div>
                            <div id="sub-done-body" style="display: none; padding: 6px; flex-direction: column; gap: 5px;">
                                <button id="btn-mark-lec" class="amaes-btn amaes-btn-blue">
                                    ${ICONS.book} <span>Mark Lectures & Vids</span>
                                </button>
                                <button id="btn-mark-quiz" class="amaes-btn amaes-btn-pink">
                                    ${ICONS.edit} <span>Mark Quizzes / Exams Only</span>
                                </button>
                                <button id="btn-mark-all" class="amaes-btn amaes-btn-gray">
                                    ${ICONS.zap} <span>Mark ALL as Done</span>
                                </button>
                            </div>
                        </div>

                        <div class="amaes-subcard">
                            <div id="sub-undo-header" class="amaes-subcard-header">
                                <span class="sub-label" style="color: var(--accent-amber);">${ICONS.undo} Undo / Reset</span>
                                <span id="sub-undo-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                            </div>
                            <div id="sub-undo-body" style="display: none; padding: 6px; flex-direction: column; gap: 5px;">
                                <button id="btn-undo-lec" class="amaes-btn amaes-btn-outline amaes-text-blue">
                                    ${ICONS.book} <span>Undo Lectures & Vids</span>
                                </button>
                                <button id="btn-undo-quiz" class="amaes-btn amaes-btn-outline amaes-text-pink">
                                    ${ICONS.edit} <span>Undo Quizzes / Exams</span>
                                </button>
                                <button id="btn-undo-all" class="amaes-btn amaes-btn-outline">
                                    ${ICONS.zap} <span>Undo ALL</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
                    <!-- MODULE 2: Activity Highlighter (Quiz / Lec / Vid) -->
                <div id="mod-highlighter-card" class="amaes-card">
                    <div id="mod-highlighter-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.preview}
                            <span class="header-label">Activity Highlighter</span>
                        </div>
                        <span id="mod-highlighter-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-highlighter-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div style="display: flex; gap: 5px;">
                            <button id="btn-hl-quiz" class="amaes-btn amaes-btn-outline amaes-text-pink" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Quizzes & Exams">
                                ${ICONS.edit} <span>Quiz</span>
                            </button>
                            <button id="btn-hl-lec" class="amaes-btn amaes-btn-outline amaes-text-blue" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Lectures & Lessons">
                                ${ICONS.book} <span>Lec</span>
                            </button>
                            <button id="btn-hl-vid" class="amaes-btn amaes-btn-outline amaes-text-purple" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Video Lectures">
                                ${ICONS.video} <span>Vid</span>
                            </button>
                        </div>

                        <div style="display: flex; gap: 5px;">
                            <button id="btn-hl-all" class="amaes-btn amaes-btn-preview" style="flex: 2; justify-content: center; padding: 5px 6px;">
                                <span>Highlight All</span>
                            </button>
                            <button id="btn-hl-clear" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 5px 6px;">
                                ${ICONS.clear} <span>Clear</span>
                            </button>
                        </div>
                    </div>
                </div>
                    <!-- MODULE 3: Quick Search Helper -->
                <div id="mod-search-card" class="amaes-card">
                    <div id="mod-search-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.search}
                            <span class="header-label">Search Helper</span>
                        </div>
                        <span id="mod-search-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-search-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: var(--bg); border-radius: 5px; border: 1px solid var(--border);">
                            <span style="color: var(--text-muted);">Subject Code:</span>
                            <span id="detected-code-badge" style="font-weight: 700; color: var(--accent-blue); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border);">
                                ${courseInfo.subjectCode || "None"}
                            </span>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <input id="search-keyword-input" type="text" value="${initialKeyword}" placeholder="Search query" style="
                                width: 100%;
                                background: var(--bg);
                                color: var(--text-primary);
                                border: 1px solid var(--border);
                                padding: 5px 8px;
                                border-radius: 5px;
                                font-size: 11px;
                                box-sizing: border-box;
                                outline: none;
                            " />
                        </div>

                        <div style="display: flex; gap: 6px;">
                            <button id="btn-copy-keyword" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center;">
                                ${ICONS.copy} <span>Copy</span>
                            </button>
                            <button id="btn-open-google" class="amaes-btn amaes-btn-blue" style="flex: 1; justify-content: center;">
                                ${ICONS.external} <span>Google</span>
                            </button>
                        </div>
                    </div>
                </div>
                <!-- Stop Button -->
                <button id="amaes-stop-btn" class="amaes-btn amaes-btn-stop" style="display: none; margin-bottom: 6px;">
                    ${ICONS.stop} <span>Stop Execution</span>
                </button>

                <!-- Live Monitor & Activity Logger (Doing / Plan / Done) -->
                <div id="amaes-monitor" class="amaes-monitor-card" style="
                    background: var(--surface-subtle);
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    padding: 7px 9px;
                    margin-top: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 11px;
                ">
                    <!-- Doing (Current Action) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; overflow: hidden;">
                            <span id="amaes-status-dot" style="width: 7px; height: 7px; border-radius: 50%; background: ${cachedQuestions ? '#10b981' : 'var(--text-muted)'}; flex-shrink: 0; box-shadow: 0 0 5px rgba(16,185,129,0.5);"></span>
                            <span id="amaes-status" style="font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;" title="Current Status">
                                ${cachedQuestions ? `Ready. Cached ${cachedQuestions.length} verified Q&A.` : 'Ready. Select a tool above.'}
                            </span>
                        </div>
                        <button id="amaes-btn-toggle-logs" type="button" style="background: var(--surface, #1e293b); border: 1px solid var(--border, #334155); color: var(--text-secondary); font-size: 9.5px; cursor: pointer; display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; z-index: 2; box-shadow: 0 1px 3px rgba(0,0,0,0.25);" title="Toggle Activity History Log">
                            ${ICONS.clock} <span id="amaes-log-count-badge">Log</span>
                        </button>
                    </div>

                    <!-- Plan (Next Planned Step) -->
                    <div id="amaes-status-plan" style="font-size: 10px; display: flex; align-items: center; gap: 5px;">
                        <span style="font-weight: 700; color: var(--accent-blue, #3b82f6); opacity: 0.9;">Plan:</span>
                        <span id="amaes-plan-text" style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${isQuiz ? 'Ready to highlight or solve questions' : 'Browse courses or review answers'}
                        </span>
                    </div>

                    <!-- Done (Expandable Activity History Feed) -->
                    <div id="amaes-activity-feed" style="
                        display: none;
                        flex-direction: column;
                        gap: 3px;
                        max-height: 120px;
                        overflow-y: auto;
                        border-top: 1px solid var(--border-subtle);
                        padding-top: 5px;
                        margin-top: 2px;
                    ">
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
                            <span>Recent Activity ("Done"):</span>
                            <button id="amaes-btn-clear-logs" type="button" style="background: none; border: none; color: var(--text-muted); text-decoration: underline; font-size: 9px; cursor: pointer; padding: 0;">Clear</button>
                        </div>
                        <div id="amaes-logs-list" style="display: flex; flex-direction: column; gap: 2px; font-family: -apple-system, BlinkMacSystemFont, monospace; font-size: 9.5px;">
                            <span style="color: var(--text-muted); font-style: italic;">No recorded events yet.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Inject Dynamic CSS Stylesheet
        const styleSheet = document.createElement('style');
        styleSheet.id = 'amaes-toolkit-styles';
        document.head.appendChild(styleSheet);

        function applyTheme(themeKey) {
            const t = THEMES[themeKey] || THEMES.dark;
            currentTheme = themeKey;
            localStorage.setItem('amaes_toolkit_theme', themeKey);

            styleSheet.textContent = `
                :root {
                    --bg: ${t.bg};
                    --surface: ${t.surface};
                    --surface-subtle: ${t.surfaceSubtle};
                    --border: ${t.border};
                    --border-subtle: ${t.borderSubtle};
                    --text-primary: ${t.textPrimary};
                    --text-secondary: ${t.textSecondary};
                    --text-muted: ${t.textMuted};
                    --accent-blue: ${t.accentBlue};
                    --accent-blue-hover: ${t.accentBlueHover};
                    --accent-pink: ${t.accentPink};
                    --accent-pink-hover: ${t.accentPinkHover};
                    --accent-purple: ${t.accentPurple};
                    --accent-purple-hover: ${t.accentPurpleHover};
                    --accent-green: ${t.accentGreen};
                    --accent-green-hover: ${t.accentGreenHover};
                    --accent-amber: ${t.accentAmber};
                    --accent-gray: ${t.accentGray};
                    --shadow: ${t.shadow};
                    --status-bg: ${t.statusBg};
                }

                #amaes-toolkit-panel {
                    position: fixed;
                    top: auto;
                    bottom: 20px;
                    right: 20px;
                    z-index: 999999;
                    background: var(--bg);
                    color: var(--text-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
                    font-size: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    box-shadow: var(--shadow);
                    border: 1px solid var(--border);
                    width: 335px;
                    max-height: calc(100vh - 40px);
                    box-sizing: border-box;
                    user-select: none;
                    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                
                #amaes-nav-tabs {
                    display: flex;
                    gap: 3px;
                    background: rgba(0,0,0,0.25);
                    padding: 3px;
                    border-radius: 8px;
                    margin-bottom: 6px;
                    border: 1px solid var(--border-subtle);
                    flex-shrink: 0;
                }

                .amaes-tab-btn {
                    flex: 1;
                    padding: 5px 2px;
                    font-size: 10.5px;
                    font-weight: 700;
                    border: 1px solid transparent;
                    border-radius: 6px;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-align: center;
                    white-space: nowrap;
                    user-select: none;
                }

                .amaes-tab-btn:hover {
                    color: var(--text-primary);
                    background: rgba(255,255,255,0.05);
                }

                .amaes-tab-btn.active {
                    background: var(--surface);
                    color: var(--text-primary);
                    border-color: var(--border);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                }

                .amaes-tab-pane {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                #amaes-panel-body {
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    flex: 1 1 auto;
                    min-height: 0;
                    padding-right: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: 6px;
                }

                #amaes-panel-body::-webkit-scrollbar {
                    width: 5px;
                }
                #amaes-panel-body::-webkit-scrollbar-track {
                    background: transparent;
                }
                #amaes-panel-body::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 4px;
                }
                #amaes-panel-body::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }

                #amaes-status {
                    flex: 1 1 0%;
                    min-width: 0;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                }
                #amaes-btn-toggle-logs {
                    flex-shrink: 0;
                    margin-left: auto;
                    z-index: 2;
                }

                .amaes-inline-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 5px !important;
                    width: auto !important;
                    max-width: max-content !important;
                    flex-shrink: 0 !important;
                    padding: 4px 10px !important;
                    border-radius: 6px !important;
                    border: none !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                    box-sizing: border-box !important;
                    text-align: center !important;
                }

                .amaes-copy-ai-card-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 4px !important;
                    background: #eff6ff !important;
                    color: #1d4ed8 !important;
                    border: 1px solid #bfdbfe !important;
                    padding: 4px 4px !important;
                    border-radius: 6px !important;
                    font-size: 10px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    user-select: none !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
                    margin-top: 4px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    white-space: nowrap !important;
                    text-align: center !important;
                }

                .amaes-copy-ai-card-btn:hover {
                    background: #dbeafe !important;
                    border-color: #3b82f6 !important;
                    color: #1e40af !important;
                    box-shadow: 0 2px 4px rgba(37,99,235,0.12) !important;
                }

                .amaes-copy-ai-card-btn svg {
                    width: 12px !important;
                    height: 12px !important;
                    flex-shrink: 0 !important;
                }

                /* Choice Row Highlight Styling */
                .amaes-highlighted-choice {
                    border-radius: 6px !important;
                    transition: all 0.2s ease !important;
                    box-sizing: border-box !important;
                }
                .amaes-highlighted-choice p {
                    display: inline !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .amaes-highlighted-choice label {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                    background: transparent !important;
                    outline: none !important;
                    padding: 0 !important;
                }

                /* Review Banner Action Buttons */
                .amaes-banner-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    width: auto !important;
                    height: 28px !important;
                    padding: 0 12px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                    box-sizing: border-box !important;
                    transition: all 0.15s ease !important;
                    line-height: 1 !important;
                    text-decoration: none !important;
                }
                .amaes-banner-btn svg {
                    width: 13px !important;
                    height: 13px !important;
                    flex-shrink: 0 !important;
                }
                .amaes-banner-btn-primary {
                    background: #2563eb !important;
                    color: #ffffff !important;
                    border: 1px solid #3b82f6 !important;
                    box-shadow: 0 1px 3px rgba(37,99,235,0.3) !important;
                }
                .amaes-banner-btn-primary:hover {
                    background: #1d4ed8 !important;
                    border-color: #2563eb !important;
                }
                .amaes-banner-btn-secondary {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: #f1f5f9 !important;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                }
                .amaes-banner-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.16) !important;
                    border-color: rgba(255, 255, 255, 0.35) !important;
                    color: #ffffff !important;
                }

                #amaes-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border-subtle);
                    gap: 8px;
                }

                #amaes-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    flex-shrink: 1;
                }

                #amaes-logo-img {
                    height: 24px;
                    width: auto;
                    display: block;
                    flex-shrink: 0;
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
                }

                #amaes-title-group {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                }

                #amaes-title {
                    font-weight: 700;
                    font-size: 13px;
                    letter-spacing: -0.2px;
                    color: var(--text-primary);
                    white-space: nowrap;
                }

                #amaes-version-pill {
                    font-size: 9px;
                    font-weight: 600;
                    padding: 1px 4px;
                    border-radius: 4px;
                    background: var(--surface);
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                    white-space: nowrap;
                }

                #amaes-actions {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .amaes-icon-btn {
                    width: 26px;
                    height: 26px;
                    background: var(--surface);
                    color: var(--text-secondary);
                    text-decoration: none;
                    border-radius: 6px;
                    font-size: 11px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-sizing: border-box;
                    padding: 0;
                    flex-shrink: 0;
                }

                .amaes-icon-btn:hover {
                    color: var(--text-primary);
                    border-color: var(--text-muted);
                }

                .amaes-debug-btn {
                    color: var(--accent-amber);
                    border-color: rgba(245, 158, 11, 0.4);
                }

                .amaes-card {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    margin-top: 8px;
                    margin-bottom: 8px;
                    overflow: hidden;
                    background: var(--surface-subtle);
                }

                .amaes-card-header {
                    padding: 8px 10px;
                    background: var(--surface);
                    font-weight: 600;
                    color: var(--text-primary);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .amaes-subcard {
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    overflow: hidden;
                    background: var(--bg);
                }

                .amaes-subcard-header {
                    padding: 6px 8px;
                    background: var(--surface);
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .sub-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    white-space: nowrap;
                }

                .arrow-container {
                    display: inline-flex;
                    align-items: center;
                    color: var(--text-muted);
                    transition: transform 0.15s ease;
                    flex-shrink: 0;
                }

                .amaes-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 9px;
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: filter 0.15s ease, background 0.15s ease;
                    text-align: left;
                    width: 100%;
                    box-sizing: border-box;
                }

                .amaes-btn-preview {
                    background: var(--surface);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    font-weight: 600;
                    justify-content: center;
                }
                .amaes-btn-preview:hover {
                    border-color: var(--text-muted);
                }

                .amaes-btn-blue {
                    background: var(--accent-blue);
                    color: #ffffff;
                }
                .amaes-btn-blue:hover {
                    background: var(--accent-blue-hover);
                }

                .amaes-btn-green {
                    background: var(--accent-green);
                    color: #ffffff;
                }
                .amaes-btn-green:hover {
                    background: var(--accent-green-hover);
                }

                .amaes-btn-pink {
                    background: var(--accent-pink);
                    color: #ffffff;
                }
                .amaes-btn-pink:hover {
                    background: var(--accent-pink-hover);
                }

                .amaes-btn-gray {
                    background: var(--surface);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                }
                .amaes-btn-gray:hover {
                    color: var(--text-primary);
                }

                .amaes-btn-outline {
                    background: var(--surface);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                }
                .amaes-btn-outline:hover {
                    color: var(--text-primary);
                }

                .amaes-text-blue { color: var(--accent-blue) !important; }
                .amaes-text-pink { color: var(--accent-pink) !important; }
                .amaes-text-purple { color: var(--accent-purple) !important; }

                .amaes-btn-stop {
                    background: var(--accent-pink);
                    color: #ffffff;
                    font-weight: 600;
                    justify-content: center;
                }

                .amaes-status-box {
                    padding: 8px;
                    background: var(--status-bg);
                    border-radius: 6px;
                    font-size: 11px;
                    line-height: 1.4;
                    color: var(--text-secondary);
                    max-height: 80px;
                    overflow-y: auto;
                    border: 1px solid var(--border-subtle);
                }
            `;

            const themeBtn = document.getElementById('amaes-theme-btn');
            if (themeBtn) {
                themeBtn.innerHTML = currentTheme === 'dark' ? ICONS.sun : ICONS.moon;
            }
        }

        applyTheme(currentTheme);

        // UI References
        const statusEl = document.getElementById('amaes-status');
        const stopBtn = document.getElementById('amaes-stop-btn');
        const minBtn = document.getElementById('amaes-min-btn');
        const bodyEl = document.getElementById('amaes-panel-body');
        const debugBtn = document.getElementById('amaes-debug-btn');
        const themeBtn = document.getElementById('amaes-theme-btn');

// Global setLog used

        // Helper: Accordion with automatic state persistence in localStorage
        function setupPersistentAccordion(headerId, bodyId, arrowId, storageKey, defaultOpen = false) {
            const header = document.getElementById(headerId);
            const body = document.getElementById(bodyId);
            const arrow = document.getElementById(arrowId);
            if (!header || !body) return;

            const saved = localStorage.getItem(storageKey);
            const isOpen = saved !== null ? (saved === 'open') : defaultOpen;
            body.style.display = isOpen ? 'flex' : 'none';
            if (arrow) arrow.innerHTML = isOpen ? ICONS.chevronDown : ICONS.chevronRight;

            header.onclick = () => {
                const isCurrentlyHidden = body.style.display === 'none';
                body.style.display = isCurrentlyHidden ? 'flex' : 'none';
                if (arrow) arrow.innerHTML = isCurrentlyHidden ? ICONS.chevronDown : ICONS.chevronRight;
                localStorage.setItem(storageKey, isCurrentlyHidden ? 'open' : 'closed');
            };
        }

        
        // Tab Navigation Logic
        const tabBtns = document.querySelectorAll('.amaes-tab-btn');
        const tabPanes = {
            quiz: document.getElementById('tab-pane-quiz'),
            db: document.getElementById('tab-pane-db'),
            course: document.getElementById('tab-pane-course')
        };

        function switchTab(tabName) {
            tabBtns.forEach(btn => {
                if (btn.dataset.tab === tabName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            Object.keys(tabPanes).forEach(name => {
                if (tabPanes[name]) {
                    tabPanes[name].style.display = (name === tabName) ? 'flex' : 'none';
                }
            });
            localStorage.setItem('amaes_active_tab', tabName);
        }

        tabBtns.forEach(btn => {
            btn.onclick = () => switchTab(btn.dataset.tab);
        });

        // Smart Initial Tab Selection:
        // If on quiz page, open Quiz Solver. If on course dashboard, open Course Tools.
        let initialTab = localStorage.getItem('amaes_active_tab') || (isQuiz ? 'quiz' : 'course');
        if (isQuiz) {
            initialTab = 'quiz';
        } else if (!isQuiz && initialTab === 'quiz') {
            initialTab = 'course';
        }
        switchTab(initialTab);

        // Quick Highlight button in Quiz Solver tab
        const btnQuickHl = document.getElementById('btn-quick-hl');
        if (btnQuickHl) {
            btnQuickHl.onclick = () => {
                const cached = getCachedAnswers(subCode);
                if (!cached || cached.length === 0) {
                    setLog("No answers cached in DB yet! Fetching from cloud...", "var(--accent-amber)");
                    if (typeof autoFetchCloudAnswersIfMissing === 'function') {
                        autoFetchCloudAnswersIfMissing(subCode).then(ok => {
                            if (ok) {
                                const newCached = getCachedAnswers(subCode);
                                highlightQuizAnswers(newCached, false, true);
                            } else {
                                setLog("No database found for " + subCode, "var(--accent-pink)");
                            }
                        });
                    }
                    return;
                }
                const res = highlightQuizAnswers(cached, false, true);
                if (res.error) {
                    setLog(res.error, "var(--accent-pink)");
                } else {
                    setLog(`Highlighted <b>${res.matched}/${res.total}</b> answers from database!`, "var(--accent-green)");
                }
            };
        }

        // --- MODULE 1: Autonomous Quiz Solver Controls ---
        const isAttemptPage = checkIsQuizAttemptPage();

        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        const btnPersonalityPassive = document.getElementById('btn-personality-passive');
        const btnPersonalityAggressive = document.getElementById('btn-personality-aggressive');
        const personalityDesc = document.getElementById('personality-desc');
        const btnCopyCurrQ = document.getElementById('btn-copy-curr-q');
        const btnCopyAllQ = document.getElementById('btn-copy-all-q');
        const chkAutoPick = document.getElementById('chk-auto-pick');
        const chkAutoNext = document.getElementById('chk-auto-next');
        const chkAutoSubmit = document.getElementById('chk-auto-submit');
        const chkAiPromptHint = document.getElementById('chk-ai-prompt-hint');

        if (btnMasterAutoQuiz) {
            if (btnMasterAutoQuiz) btnMasterAutoQuiz.onclick = () => {
                toggleAutoQuizMode();
            };
        }

        if (btnPersonalityPassive) {
            if (btnPersonalityPassive) btnPersonalityPassive.onclick = () => {
                quizPersonality = 'passive';
                localStorage.setItem('amaes_quiz_personality', 'passive');
                btnPersonalityPassive.className = 'amaes-btn amaes-btn-blue';
                btnPersonalityAggressive.className = 'amaes-btn amaes-btn-outline';
                if (personalityDesc) {
                    personalityDesc.innerHTML = '<b>Co-Pilot:</b> Auto-picks answers. On unknown question: safely pauses, auto-copies for AI, and waits.';
                }
                showToast("Personality: Co-Pilot (Safe)");
                setLog(`Quiz Solver personality set to <b>${ICONS.shieldCheck} <span>Co-Pilot (Safe)</span></b>.`, "var(--accent-blue)");
                syncAutoQuizUI();
            };
        }

        if (btnPersonalityAggressive) {
            if (btnPersonalityAggressive) btnPersonalityAggressive.onclick = () => {
                quizPersonality = 'aggressive';
                localStorage.setItem('amaes_quiz_personality', 'aggressive');
                btnPersonalityAggressive.className = 'amaes-btn amaes-btn-pink';
                btnPersonalityPassive.className = 'amaes-btn amaes-btn-outline';
                if (personalityDesc) {
                    personalityDesc.innerHTML = '<b>Speedrun:</b> Auto-picks answers, skips unknown questions immediately, and auto-submits when done.';
                }
                showToast("Personality: Speedrun (Fast)");
                setLog(`Quiz Solver personality set to <b>${ICONS.fastForward} <span>Speedrun (Fast)</span></b>.`, "var(--accent-pink)");
                syncAutoQuizUI();
            };
        }

        const chkShowInQBtns = document.getElementById('chk-show-in-q-btns');
        if (chkShowInQBtns) {
            if (chkShowInQBtns) chkShowInQBtns.onchange = (e) => {
                showInQuestionAiBtns = e.target.checked;
                localStorage.setItem('amaes_show_in_question_ai_btns', showInQuestionAiBtns);
                injectQuestionCopyButtons();
                showToast(`In-question AI buttons: ${showInQuestionAiBtns ? 'Shown' : 'Hidden'}`);
            };
        }

        if (chkAutoPick) {
            if (chkAutoPick) chkAutoPick.onchange = () => {
                autoPickQuiz = chkAutoPick.checked;
                localStorage.setItem('amaes_auto_pick_quiz', autoPickQuiz);
                showToast(`Auto-Pick: ${autoPickQuiz ? 'Enabled' : 'Disabled'}`);
                if (autoPickQuiz && checkIsQuizAttemptPage()) runAutoQuizSolver();
            };
        }

        if (chkAutoNext) {
            if (chkAutoNext) chkAutoNext.onchange = () => {
                autoNextQuiz = chkAutoNext.checked;
                localStorage.setItem('amaes_auto_next_quiz', autoNextQuiz);
                showToast(`Auto-Next: ${autoNextQuiz ? 'Enabled' : 'Disabled'}`);
                if (autoNextQuiz && checkIsQuizAttemptPage()) runAutoQuizSolver();
            };
        }

        const chkSmartSkip = document.getElementById('chk-smart-skip');
        if (chkSmartSkip) {
            if (chkSmartSkip) chkSmartSkip.onchange = () => {
                smartSkipQuiz = chkSmartSkip.checked;
                localStorage.setItem('amaes_smart_skip_quiz', smartSkipQuiz);
                showToast(`Smart Skip: ${smartSkipQuiz ? 'Enabled' : 'Disabled'}`);
            };
        }

        const chkAutoMinQuiz = document.getElementById('chk-auto-min-quiz');
        if (chkAutoMinQuiz) {
            chkAutoMinQuiz.onchange = () => {
                autoMinimizeQuiz = chkAutoMinQuiz.checked;
                localStorage.setItem('amaes_auto_min_quiz', autoMinimizeQuiz);
                showToast(`Auto-minimize during quizzes: ${autoMinimizeQuiz ? 'Enabled' : 'Disabled'}`);
            };
        }

        const chkKeyboardShortcuts = document.getElementById('chk-keyboard-shortcuts');
        if (chkKeyboardShortcuts) {
            chkKeyboardShortcuts.onchange = () => {
                enableKeyboardShortcuts = chkKeyboardShortcuts.checked;
                localStorage.setItem('amaes_enable_hotkeys', enableKeyboardShortcuts);
                showToast(`Keyboard Navigation: ${enableKeyboardShortcuts ? 'Enabled' : 'Disabled'}`);
                setLog(`Keyboard shortcuts ${enableKeyboardShortcuts ? '<b>enabled</b> (N, Space, 1-4, C, P, H)' : '<b>disabled</b>'}`, "var(--accent-blue)");
            };
        }

        if (chkAutoSubmit) {
            if (chkAutoSubmit) chkAutoSubmit.onchange = () => {
                autoSubmitQuiz = chkAutoSubmit.checked;
                localStorage.setItem('amaes_auto_submit_quiz', autoSubmitQuiz);
                showToast(`Auto-Submit Quiz: ${autoSubmitQuiz ? 'Enabled' : 'Disabled'}`);
                if (autoSubmitQuiz && checkIsQuizSummaryPage()) handleQuizSummaryAutoSubmit();
            };
        }

        if (chkAiPromptHint) {
            if (chkAiPromptHint) chkAiPromptHint.onchange = () => {
                aiPromptHint = chkAiPromptHint.checked;
                localStorage.setItem('amaes_ai_prompt_hint', aiPromptHint);
            };
        }

        if (btnCopyCurrQ) {
            if (btnCopyCurrQ) btnCopyCurrQ.onclick = async () => {
                const queList = document.querySelectorAll('.que');
                if (queList.length === 0) {
                    setLog("<b>No questions found</b> on this page.", "var(--accent-pink)");
                    return;
                }
                const qData = extractQuestionData(queList[0]);
                const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                const text = formatQuestionForAI(queList[0], aiPromptHint);
                try {
                    await copyToClipboard(text);
                    btnCopyCurrQ.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    showToast(willIncludeContext ? 'Question copied with Course AI Context!' : 'Question & choices copied for AI!');
                    setLog(willIncludeContext ? 'Copied current question with Course AI Context!' : 'Copied current question & choices for AI!', "var(--accent-green)");
                    setTimeout(() => {
                        btnCopyCurrQ.innerHTML = `${ICONS.copy} <span>Copy (C)</span>`;
                    }, 1800);
                } catch (err) {
                    setLog("Failed to copy to clipboard.", "var(--accent-pink)");
                }
            };
        }

        const btnPasteAiAns = document.getElementById('btn-paste-ai-ans');
        if (btnPasteAiAns) {
            btnPasteAiAns.onclick = () => {
                autoSelectFromAiClipboard();
            };
        }

        const btnShowShortcutsGuide = document.getElementById('btn-show-shortcuts-guide');
        if (btnShowShortcutsGuide) {
            btnShowShortcutsGuide.onclick = () => {
                showWelcomeOnboardingModal(true);
                setTimeout(() => {
                    const sec = document.getElementById('welcome-shortcuts-section');
                    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            };
        }

        if (btnCopyAllQ) {
            if (btnCopyAllQ) btnCopyAllQ.onclick = async () => {
                const queList = document.querySelectorAll('.que');
                if (queList.length === 0) {
                    setLog("<b>No questions found</b> on this page.", "var(--accent-pink)");
                    return;
                }
                const text = formatAllQuestionsForAI(aiPromptHint);
                try {
                    await copyToClipboard(text);
                    btnCopyAllQ.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    showToast(`All ${queList.length} questions copied for AI!`);
                    setLog(`Copied all <b>${queList.length}</b> questions for AI!`, "var(--accent-green)");
                    setTimeout(() => {
                        btnCopyAllQ.innerHTML = `${ICONS.copy} <span>Copy All</span>`;
                    }, 1800);
                } catch (err) {
                    setLog("Failed to copy to clipboard.", "var(--accent-pink)");
                }
            };
        }

        // --- MODULE 1: AMAUOED Answer Highlighter Controls ---
        const modQuizHeader = document.getElementById('mod-quiz-header');
        const modQuizBody = document.getElementById('mod-quiz-body');
        const modQuizArrow = document.getElementById('mod-quiz-arrow');
        const amauoedUrlInput = document.getElementById('amauoed-url-input');
        const urlMatchBadge = document.getElementById('amauoed-url-match-badge');
        const fetchBtn = document.getElementById('btn-fetch-amauoed');
        const fetchBtnLabel = document.getElementById('fetch-btn-label');
        const hlAnswersBtn = document.getElementById('btn-hl-answers');
        const selectAnswersBtn = document.getElementById('btn-select-answers');
        const chkAutoHlQuiz = document.getElementById('chk-auto-hl-quiz');

        function updateUrlMatchBadge() {
            if (!urlMatchBadge || !amauoedUrlInput) return;
            const url = amauoedUrlInput.value.trim();
            const res = checkUrlCourseMatch(url, courseInfo);
            urlMatchBadge.style.display = 'block';
            urlMatchBadge.innerHTML = res.html;

            if (res.status === 'match') {
                urlMatchBadge.style.background = 'rgba(16, 185, 129, 0.12)';
                urlMatchBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                urlMatchBadge.style.color = 'var(--accent-green)';
            } else if (res.status === 'mismatch' || res.status === 'invalid') {
                urlMatchBadge.style.background = 'rgba(244, 63, 94, 0.12)';
                urlMatchBadge.style.border = '1px solid rgba(244, 63, 94, 0.3)';
                urlMatchBadge.style.color = 'var(--accent-pink)';

                const fixBtn = document.getElementById('btn-fix-amauoed-url');
                if (fixBtn) {
                    fixBtn.onclick = (e) => {
                        e.preventDefault();
                        const correctUrl = getStoredAmauoedUrl(subCode);
                        if (correctUrl) {
                            amauoedUrlInput.value = correctUrl;
                            setStoredAmauoedUrl(subCode, correctUrl);
                            updateUrlMatchBadge();
                            setLog(`Switched to detected <b>${subCode}</b> URL!`, 'var(--accent-green)');
                        }
                    };
                }
            } else {
                urlMatchBadge.style.background = 'var(--surface-subtle)';
                urlMatchBadge.style.border = '1px solid var(--border-subtle)';
                urlMatchBadge.style.color = 'var(--text-secondary)';
            }
        }

        function updateTermCoverageUI(code) {
            const targetCode = code || subCode;
            const summaryEl = document.getElementById('amaes-term-summary');
            const pillsEl = document.getElementById('amaes-term-pills');
            if (!pillsEl || !summaryEl) return;

            const stats = getSubjectTermBreakdown(targetCode);
            const total = stats.total;

            if (total === 0) {
                summaryEl.innerText = "No Qs Saved";
                summaryEl.style.color = "var(--text-muted)";
            } else {
                const covered = [stats.prelim > 0, stats.midterm > 0, stats.prefi > 0, stats.final > 0].filter(Boolean).length;
                summaryEl.innerText = `${total} Qs • ${covered}/4 Terms Ready`;
                summaryEl.style.color = covered === 4 ? "var(--accent-green)" : covered > 0 ? "var(--accent-blue)" : "var(--text-secondary)";
            }

            const terms = [
                { name: 'Prelim', count: stats.prelim },
                { name: 'Midterm', count: stats.midterm },
                { name: 'Prefi', count: stats.prefi },
                { name: 'Final', count: stats.final }
            ];

            pillsEl.innerHTML = terms.map(t => {
                if (t.count > 0) {
                    return `
                        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid #10b981; border-radius: 4px; padding: 3px 2px; text-align: center;" title="${t.name}: ${t.count} verified questions available">
                            <div style="font-size: 8.5px; font-weight: 700; color: #10b981;">${t.name}</div>
                            <div style="font-size: 10px; font-weight: 800; color: #34d399;">${t.count} Qs</div>
                        </div>
                    `;
                } else {
                    return `
                        <div style="background: rgba(148, 163, 184, 0.05); border: 1px dashed rgba(148, 163, 184, 0.3); border-radius: 4px; padding: 3px 2px; text-align: center; opacity: 0.65;" title="${t.name}: No questions stored yet">
                            <div style="font-size: 8.5px; font-weight: 600; color: var(--text-secondary);">${t.name}</div>
                            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted);">0 Qs</div>
                        </div>
                    `;
                }
            }).join('');
        }

        if (amauoedUrlInput) {
            amauoedUrlInput.addEventListener('input', updateUrlMatchBadge);
            amauoedUrlInput.addEventListener('change', updateUrlMatchBadge);
            updateUrlMatchBadge();
        }

        updateTermCoverageUI(subCode);

        const selectActiveCourse = document.getElementById('amaes-select-active-course');
        if (selectActiveCourse) {
            selectActiveCourse.onchange = () => {
                let val = selectActiveCourse.value;
                if (val === '_custom') {
                    const custom = prompt("Enter Subject Code (e.g. CS6301, ITE6301):", "");
                    if (custom && custom.trim()) {
                        val = custom.trim().toUpperCase();
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = `${val} (0 Qs)`;
                        opt.selected = true;
                        selectActiveCourse.insertBefore(opt, selectActiveCourse.lastElementChild);
                    } else {
                        selectActiveCourse.value = subCode;
                        return;
                    }
                }
                subCode = val;
                if (amauoedUrlInput) {
                    amauoedUrlInput.value = getStoredAmauoedUrl(subCode);
                    updateUrlMatchBadge();
                }
                const curAnswers = getCachedAnswers(subCode);
                if (fetchBtnLabel) {
                    fetchBtnLabel.innerText = curAnswers ? `Refresh Database (${curAnswers.length} in DB)` : 'Fetch & Sync Database';
                }
                updateTermCoverageUI(subCode);
                setLog(`Active subject switched to <b>${subCode}</b> (${(curAnswers || []).length} cached answers).`, "var(--accent-blue)");
            };
        }

        const btnAutofindAmauoed = document.getElementById('btn-autofind-amauoed');
        if (btnAutofindAmauoed) {
            btnAutofindAmauoed.onclick = async () => {
                let targetCode = subCode;
                if (!targetCode || targetCode === 'DEFAULT' || targetCode === 'GENERAL') {
                    const entered = prompt("Enter Subject Code to search AMAUOED for (e.g. CS6301, ITE6301):", (detectedCodes && detectedCodes[0]) || "");
                    if (!entered || !entered.trim()) {
                        setLog("Auto-find cancelled (no subject code specified).", "var(--accent-amber)");
                        return;
                    }
                    targetCode = entered.trim().toUpperCase();
                    subCode = targetCode;
                }
                btnAutofindAmauoed.disabled = true;
                btnAutofindAmauoed.innerHTML = `<span>Searching...</span>`;
                setLog(`Searching amauoed.com for <b>${targetCode}</b>...`, 'var(--accent-blue)', 'Plan: Crawl course directory and link question bank');
                try {
                    const foundUrl = await autoFindAmauoedLink(targetCode, courseInfo.subjectName || courseInfo.currentActivityTitle || '');
                    if (foundUrl) {
                        amauoedUrlInput.value = foundUrl;
                        updateUrlMatchBadge();
                        showToast(`Found link for ${targetCode}! Auto-fetching answers...`);
                        setLog(`Found AMAUOED link for <b>${targetCode}</b>! Auto-fetching answers... Tip: Switch personality to <b>Co-Pilot</b> for guided solving.`, 'var(--accent-green)', 'Plan: Auto-parse Q&A into database');
                        if (fetchBtn) fetchBtn.click();
                    } else {
                        showToast(`No exact amauoed.com link found for ${targetCode}.`);
                        setLog(`No direct AMAUOED guide found for <b>${targetCode}</b>. Tip: Try <b>Cloud Sync</b> or use <b>'C' hotkey</b> to get instant AI answers.`, 'var(--accent-amber)', 'Plan: Paste link manually or sync cloud DB');
                    }
                } catch (err) {
                    console.error('Auto-find failed:', err);
                    showToast('Failed to auto-find amauoed link.');
                    setLog('Error searching amauoed: ' + err.message, 'var(--accent-pink)', 'Plan: Enter link manually');
                } finally {
                    btnAutofindAmauoed.disabled = false;
                    btnAutofindAmauoed.innerHTML = `${ICONS.search} <span>Auto-Find</span>`;
                }
            };
        }

setupPersistentAccordion('mod-quiz-header', 'mod-quiz-body', 'mod-quiz-arrow', 'amaes_pref_mod_amauoed', true);

        if (chkAutoHlQuiz) chkAutoHlQuiz.onchange = () => {
            autoHighlightQuiz = chkAutoHlQuiz.checked;
            localStorage.setItem('amaes_auto_highlight_quiz', autoHighlightQuiz);
        };

        // Fetch & Cache AMAUOED Answers
        if (fetchBtn) fetchBtn.onclick = async () => {
            const url = amauoedUrlInput.value.trim();
            if (!url) {
                setLog("Please enter a valid amauoed.com course URL.", "var(--accent-pink)");
                return;
            }

            const matchCheck = checkUrlCourseMatch(url, courseInfo);
            if (matchCheck.status === 'mismatch') {
                const proceed = confirm(`Warning: The URL you entered appears to be for a DIFFERENT subject than your current course (${subCode}).\n\nAre you sure you want to scrape this URL?`);
                if (!proceed) {
                    setLog("Fetch cancelled due to course subject mismatch.", "var(--accent-amber)");
                    return;
                }
            }

            setStoredAmauoedUrl(subCode, url);
            fetchBtn.disabled = true;
            fetchBtnLabel.innerText = "Connecting to amauoed.com...";
            setLog(`Connecting to: <b>${url}</b>`);

            try {
                const questions = await loadAllAmauoedAnswers(url, (p, count) => {
                    fetchBtnLabel.innerText = `Fetching page ${p}... (${count} parsed)`;
                    setLog(`Crawling amauoed page <b>${p}</b> (${count} answers cached)...`);
                });

                if (questions.length > 0) {
                    localStorage.setItem(`amaes_amauoed_scraped_${subCode}`, '1');
                    const mergeResult = mergeAnswersIntoCache(subCode, questions, 'AMAUOED');
                    fetchBtnLabel.innerText = `Refresh Answers (${mergeResult.total} cached)`;
                    updateTermCoverageUI(subCode);
                    setLog(`Successfully cached <b>${questions.length}</b> questions from amauoed!`, "var(--accent-green)");

                    // If currently on a quiz, trigger highlight immediately!
                    if (checkIsQuizPage()) {
                        const updatedCache = getCachedAnswers(subCode);
                        const res = highlightQuizAnswers(updatedCache, false);
                        setLog(`Matched & highlighted <b>${res.matched}/${res.total}</b> questions!`, "var(--accent-green)");
                    }
                } else {
                    fetchBtnLabel.innerText = "Fetch All Pages & Cache";
                    setLog("No questions could be parsed from that URL. Check link or permissions.", "var(--accent-pink)");
                }
            } catch (err) {
                console.error("Fetch error:", err);
                fetchBtnLabel.innerText = "Fetch Failed (Try Again)";
                setLog(`Error connecting to amauoed.com: ${err.message}`, "var(--accent-pink)");
            } finally {
                fetchBtn.disabled = false;
            }
        };

        // Highlight Button
        if (hlAnswersBtn) hlAnswersBtn.onclick = () => {
            const cached = getCachedAnswers(subCode);
            if (!cached) {
                setLog("No answers cached yet! Click <b>'Fetch All Pages & Cache'</b> first.", "var(--accent-pink)");
                return;
            }
            const res = highlightQuizAnswers(cached, false);
            if (res.error) {
                setLog(res.error, "var(--accent-pink)");
            } else {
                setLog(`Matched & highlighted <b>${res.matched}/${res.total}</b> questions!`, "var(--accent-green)");
            }
        };

        // Auto-Select Button
        if (selectAnswersBtn) selectAnswersBtn.onclick = () => {
            const cached = getCachedAnswers(subCode);
            if (!cached) {
                setLog("No answers cached yet! Click <b>'Fetch All Pages & Cache'</b> first.", "var(--accent-pink)");
                return;
            }
            const res = highlightQuizAnswers(cached, true, true);
            if (res.error) {
                setLog(res.error, "var(--accent-pink)");
            } else {
                setLog(`Auto-selected <b>${res.matched}/${res.total}</b> answers!`, "var(--accent-green)");
            }
        };

        // --- Answer Key Sharing & Import Handlers ---
        const btnShareGuide = document.getElementById('btn-share-guide');
        const btnExportJson = document.getElementById('btn-export-json');
        const btnImportJson = document.getElementById('btn-import-json');
        const fileImportJson = document.getElementById('file-import-json');

        if (btnShareGuide) {
            if (btnShareGuide) btnShareGuide.onclick = async () => {
                const cached = getCachedAnswers(subCode);
                if (!cached || cached.length === 0) {
                    setLog("No answers cached yet! Scrape from amauoed or review a quiz first.", "var(--accent-pink)");
                    return;
                }
                const data = {
                    subjectCode: subCode,
                    quizTitle: courseInfo.currentActivityTitle || 'Answer Key',
                    gradeText: '',
                    harvestedCount: cached.length,
                    questions: cached
                };
                const text = formatAnswersAsStudyGuide(data);
                await copyToClipboard(text);
                showToast(`Copied study guide for ${cached.length} questions! (Ready to paste in Messenger/Discord)`);
                setLog(`Copied study guide for <b>${cached.length}</b> questions!`, "var(--accent-green)");
            };
        }

        if (btnExportJson) {
            if (btnExportJson) btnExportJson.onclick = () => {
                const cached = getCachedAnswers(subCode);
                if (!cached || cached.length === 0) {
                    setLog("No answers cached to export!", "var(--accent-pink)");
                    return;
                }
                const data = {
                    subjectCode: subCode,
                    quizTitle: courseInfo.currentActivityTitle || 'Database',
                    gradeText: '',
                    totalQuestions: cached.length,
                    harvestedCount: cached.length,
                    questions: cached
                };
                const json = exportAnswersAsJSON(data);
                const filename = `${subCode}_Answers_Database.json`;
                downloadJsonFile(filename, json);
                showToast(`Exported ${filename}!`);
                setLog(`Exported <b>${cached.length}</b> answers to ${filename}.`, "var(--accent-green)");
            };
        }

        // Multi-File Import with Intelligent Cross-Referencing & Consensus
        if (btnImportJson && fileImportJson) {
            if (btnImportJson) btnImportJson.onclick = () => {
                fileImportJson.click();
            };

            if (fileImportJson) fileImportJson.onchange = async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                setLog(`Reading & cross-referencing <b>${files.length}</b> file(s)...`);
                let totalAdded = 0;
                let totalConfirmed = 0;
                let totalConflicts = 0;
                let processedFiles = 0;

                for (const file of files) {
                    try {
                        const text = await file.text();
                        const parsed = JSON.parse(text);
                        const questionsToImport = parseIncomingAnswerPayload(parsed, subCode);

                        if (questionsToImport.length > 0) {
                            const targetCode = (parsed.subjectCode || subCode).toUpperCase();
                            const res = mergeAnswersIntoCache(targetCode, questionsToImport, file.name);
                            totalAdded += res.added;
                            totalConfirmed += res.confirmed;
                            totalConflicts += res.conflicts;
                            processedFiles++;
                        }
                    } catch (err) {
                        console.error("Error importing file " + file.name, err);
                    }
                }

                const finalDb = getCachedAnswers(subCode) || [];
                showToast(`Cross-referenced ${processedFiles} file(s)! (${totalConfirmed} consensus verified)`);
                setLog(`Cross-referenced <b>${processedFiles}</b> file(s)! Added: <b>${totalAdded}</b> new, Confirmed: <b>${totalConfirmed}</b> consensus matches. (Total in DB: <b>${finalDb.length}</b>)`, "var(--accent-green)");

                if (fetchBtnLabel) {
                    fetchBtnLabel.innerText = `Refresh Answers (${finalDb.length} cached)`;
                }

                updateTermCoverageUI(subCode);

                if (checkIsQuizPage()) {
                    highlightQuizAnswers(finalDb, false);
                }

                fileImportJson.value = ''; // Reset file input
            };
        }

        // Cloud Database Sync & Push Handlers
        const btnCloudSync = document.getElementById('btn-cloud-sync');
        const btnCloudPush = document.getElementById('btn-cloud-push');
        const btnConfigCloud = document.getElementById('btn-config-cloud');
        const chkAutoDlJson = document.getElementById('chk-auto-dl-json');
        const chkAutoPushGithub = document.getElementById('chk-auto-push-github');

        if (btnCloudSync) {
            btnCloudSync.onclick = async () => {
                let targetCode = subCode;
                if (!targetCode || targetCode === 'DEFAULT' || targetCode === 'GENERAL') {
                    const entered = prompt("Enter Subject Code to sync from Cloud (e.g. CS6301, ITE6301):", (detectedCodes && detectedCodes[0]) || "");
                    if (!entered || !entered.trim()) {
                        setLog("Cloud sync cancelled (no subject code specified).", "var(--accent-amber)");
                        return;
                    }
                    targetCode = entered.trim().toUpperCase();
                    subCode = targetCode;
                }
                btnCloudSync.disabled = true;
                btnCloudSync.innerHTML = `${ICONS.cloud} <span>Syncing...</span>`;
                setLog(`Connecting to community cloud database for <b>${targetCode}</b>...`);

                try {
                    const res = await syncAnswersFromCloud(targetCode);
                    const finalDb = getCachedAnswers(targetCode) || [];
                    showToast(`Cloud Sync Success! (${res.count} community answers loaded)`);
                    setLog(`Synced <b>${res.count}</b> answers for <b>${targetCode}</b>! (Total: <b>${finalDb.length}</b>)`, "var(--accent-green)");

                    if (fetchBtnLabel) {
                        fetchBtnLabel.innerText = `Refresh Answers (${finalDb.length} cached)`;
                    }

                    updateTermCoverageUI(targetCode);

                    if (checkIsQuizPage()) {
                        highlightQuizAnswers(finalDb, false);
                    }
                } catch (err) {
                    setLog(`Cloud Sync Note: ${err.message}. You can set your GitHub repository link via <b>Config</b>.`, "var(--accent-amber)");
                } finally {
                    btnCloudSync.disabled = false;
                    btnCloudSync.innerHTML = `${ICONS.cloudDownload} <span>Cloud Sync</span>`;
                }
            };
        }

        const btnHarvestGradesDb = document.getElementById('btn-harvest-grades-db');
        if (btnHarvestGradesDb) {
            btnHarvestGradesDb.onclick = () => {
                btnHarvestGradesDb.disabled = true;
                btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>Scanning Quizzes...</span>`;
                executeGradesHarvester((curr, total, name) => {
                    btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>[${curr}/${total}] ${name}...</span>`;
                }).then(res => {
                    if (res && res.success && res.count > 0) {
                        btnHarvestGradesDb.innerHTML = `${ICONS.check} <span>Harvested ${res.count} Qs!</span>`;
                    } else if (res && res.inProgress) {
                        btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>In Progress</span>`;
                    } else {
                        btnHarvestGradesDb.innerHTML = `<span>Finished</span>`;
                    }
                    setTimeout(() => {
                        btnHarvestGradesDb.disabled = false;
                        btnHarvestGradesDb.innerHTML = `${ICONS.download} <span>Harvest Quizzes</span>`;
                    }, 4000);
                });
            };
        }

        if (btnConfigCloud) {
            btnConfigCloud.onclick = () => {
                const currentUrl = localStorage.getItem('amaes_cloud_db_url') || cloudDbBaseUrl;
                const currentToken = localStorage.getItem('amaes_github_token') || '';
                const choice = prompt(
                    `CLOUD DATABASE & GITHUB CONFIGURATION\n\n` +
                    `1. Base URL for Cloud Sync:\n${currentUrl}\n\n` +
                    `2. GitHub Token (PAT) for 1-Click Push:\n${currentToken ? '••••••••' + currentToken.slice(-4) : '(Not set - Web editor fallback)'}\n\n` +
                    `Commands:\n` +
                    `• 'token <YOUR_PAT>' -> Set GitHub Personal Access Token\n` +
                    `• 'url <NEW_URL>' -> Set raw database URL\n` +
                    `• 'clear' -> Remove GitHub Token\n\n` +
                    `Enter command or leave blank:`,
                    currentToken ? `token ${currentToken}` : `url ${currentUrl}`
                );

                if (choice) {
                    const trimmed = choice.trim();
                    if (trimmed.startsWith('token ')) {
                        const token = trimmed.replace(/^token\s+/, '').trim();
                        localStorage.setItem('amaes_github_token', token);
                        showToast("GitHub Token saved!");
                        setLog("GitHub Token configured for 1-click commits!", "var(--accent-green)");
                    } else if (trimmed.startsWith('url ')) {
                        const url = trimmed.replace(/^url\s+/, '').trim();
                        localStorage.setItem('amaes_cloud_db_url', url);
                        cloudDbBaseUrl = url;
                        showToast("Cloud DB URL updated!");
                        setLog(`Cloud Database URL updated to <b>${url}</b>`, "var(--accent-blue)");
                    } else if (trimmed === 'clear') {
                        localStorage.removeItem('amaes_github_token');
                        showToast("GitHub Token cleared!");
                        setLog("GitHub Token cleared.", "var(--text-muted)");
                    }
                }
            };
        }

        const btnContributeDb = document.getElementById('btn-contribute-db');
        if (btnContributeDb) {
            btnContributeDb.onclick = () => {
                showCommunityContributionModal(subCode);
            };
        }

        const chkAutoHarvestGrades = document.getElementById('chk-auto-harvest-grades');
        if (chkAutoHarvestGrades) {
            chkAutoHarvestGrades.onchange = (e) => {
                autoHarvestGrades = e.target.checked;
                localStorage.setItem('amaes_auto_harvest_grades', autoHarvestGrades);
                showToast(`Auto-harvest past quizzes: ${autoHarvestGrades ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-harvest past quizzes from Grades: <b>${autoHarvestGrades ? 'ON' : 'OFF'}</b>`, autoHarvestGrades ? "var(--accent-green)" : "var(--accent-amber)");
            };
        }

        const chkAutoCloudSync = document.getElementById('chk-auto-cloud-sync');
        if (chkAutoCloudSync) {
            chkAutoCloudSync.onchange = (e) => {
                autoCloudSync = e.target.checked;
                localStorage.setItem('amaes_auto_cloud_sync', autoCloudSync);
                showToast(`Auto-pull community answers: ${autoCloudSync ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-pull community answers on course open: <b>${autoCloudSync ? 'ON' : 'OFF'}</b>`, autoCloudSync ? "var(--accent-green)" : "var(--accent-amber)");
            };
        }

        const chkAutoCommunityShare = document.getElementById('chk-auto-community-share');
        if (chkAutoCommunityShare) {
            chkAutoCommunityShare.onchange = (e) => {
                autoCommunityShare = e.target.checked;
                localStorage.setItem('amaes_auto_community_share', autoCommunityShare);
                showToast(`Auto-share to Community Hub: ${autoCommunityShare ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-share verified answers on Review: <b>${autoCommunityShare ? 'ON' : 'OFF'}</b>`, autoCommunityShare ? "var(--accent-green)" : "var(--accent-amber)");
            };
        }

        if (chkAutoDlJson) {
            chkAutoDlJson.onchange = (e) => {
                localStorage.setItem('amaes_auto_dl_json', e.target.checked);
                showToast(`Auto-download JSON: ${e.target.checked ? 'Enabled' : 'Disabled'}`);
            };
        }



        // If on quiz attempt page, the unified runAutoQuizSolver handles highlighting, auto-picking & auto-next.
        // On review page or other pages, highlight visually without auto-select.
        if (autoHighlightQuiz && isQuiz && cachedQuestions && !checkIsQuizAttemptPage()) {
            setTimeout(() => {
                const res = highlightQuizAnswers(cachedQuestions, false);
                if (res.matched > 0) {
                    setLog(`Auto-highlighted <b>${res.matched}/${res.total}</b> answers from database.`, "var(--accent-green)");
                }
            }, 600);
        }

        // --- MODULE 2: Highlighter Module Elements ---
        const modHlHeader = document.getElementById('mod-highlighter-header');
        const modHlBody = document.getElementById('mod-highlighter-body');
        const modHlArrow = document.getElementById('mod-highlighter-arrow');

setupPersistentAccordion('mod-highlighter-header', 'mod-highlighter-body', 'mod-highlighter-arrow', 'amaes_pref_mod_hl', false);

        const triggerHighlight = (cat, label) => {
            const res = highlightItems(cat);
            if (res.error) {
                setLog("<b>Action Blocked:</b> Open a course subject first.", "var(--accent-pink)");
            } else {
                setLog(`Highlighted <b>${res.count}</b> ${label} items on page.`, "var(--accent-green)");
            }
        };

        const _el__btn_hl_quiz_ = document.getElementById('btn-hl-quiz');
        if (_el__btn_hl_quiz_) _el__btn_hl_quiz_.onclick = () => triggerHighlight('quiz', 'Quiz/Exam');
        const _el__btn_hl_lec_ = document.getElementById('btn-hl-lec');
        if (_el__btn_hl_lec_) _el__btn_hl_lec_.onclick = () => triggerHighlight('lecture', 'Lecture');
        const _el__btn_hl_vid_ = document.getElementById('btn-hl-vid');
        if (_el__btn_hl_vid_) _el__btn_hl_vid_.onclick = () => triggerHighlight('video', 'Video');
        const _el__btn_hl_all_ = document.getElementById('btn-hl-all');
        if (_el__btn_hl_all_) _el__btn_hl_all_.onclick = () => triggerHighlight('all', 'total');
        const _el__btn_hl_clear_ = document.getElementById('btn-hl-clear');
        if (_el__btn_hl_clear_) _el__btn_hl_clear_.onclick = () => {;
            clearAllHighlights();
            setLog("Cleared all highlights.", "var(--text-muted)");
        };

        // --- MODULE 3: Search Module Elements ---
        const modSearchHeader = document.getElementById('mod-search-header');
        const modSearchBody = document.getElementById('mod-search-body');
        const modSearchArrow = document.getElementById('mod-search-arrow');
        const keywordInput = document.getElementById('search-keyword-input');
        const copyKeywordBtn = document.getElementById('btn-copy-keyword');
        const openGoogleBtn = document.getElementById('btn-open-google');

setupPersistentAccordion('mod-search-header', 'mod-search-body', 'mod-search-arrow', 'amaes_pref_mod_search', false);

        if (copyKeywordBtn) copyKeywordBtn.onclick = async () => {
            const query = keywordInput.value.trim();
            if (!query) return;
            try {
                await copyToClipboard(query);
                setLog(`Copied: "<b>${query}</b>"`, "var(--accent-green)");
                copyKeywordBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                setTimeout(() => {
                    copyKeywordBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
                }, 2000);
            } catch (e) {
                setLog("Failed to copy search keyword.", "var(--accent-pink)");
            }
        };

        if (openGoogleBtn) openGoogleBtn.onclick = async () => {
            const query = keywordInput.value.trim();
            if (!query) return;
            try {
                await copyToClipboard(query);
            } catch (e) {}

            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            window.open(url, '_blank');
            setLog(`Opened Google search for: "<b>${query}</b>"`, "var(--accent-blue)");
        };

        // Theme Toggle Handler
        if (themeBtn) themeBtn.onclick = () => {
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
        };

        // Header Version Pill Click -> Check for Updates
        const versionPill = document.getElementById('amaes-version-pill');
        if (versionPill) {
            versionPill.onclick = () => {
                checkForScriptUpdates(true);
            };
        }

        // --- MODULE 4: Marker Module Collapse ---
        const modMarkerHeader = document.getElementById('mod-marker-header');
        const modMarkerBody = document.getElementById('mod-marker-body');
        const modMarkerArrow = document.getElementById('mod-marker-arrow');

setupPersistentAccordion('mod-marker-header', 'mod-marker-body', 'mod-marker-arrow', 'amaes_pref_mod_marker', !isQuiz);

        setupPersistentAccordion('sub-done-header', 'sub-done-body', 'sub-done-arrow', 'amaes_pref_sub_done', false);
        setupPersistentAccordion('sub-undo-header', 'sub-undo-body', 'sub-undo-arrow', 'amaes_pref_sub_undo', false);

        // Panel Minimize State Persistence
        const savedMinimized = localStorage.getItem('amaes_pref_minimized') === 'true';
        if (savedMinimized) {
            bodyEl.style.display = 'none';
            minBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
            `;
        }

        if (minBtn) minBtn.onclick = () => {
            if (bodyEl.style.display === 'none') {
                bodyEl.style.display = 'block';
                minBtn.innerHTML = ICONS.minimize;
                localStorage.setItem('amaes_pref_minimized', 'false');
            } else {
                bodyEl.style.display = 'none';
                minBtn.innerHTML = `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                `;
                localStorage.setItem('amaes_pref_minimized', 'true');
            }
        };

        const helpBtn = document.getElementById('amaes-help-btn');
        if (helpBtn) {
            if (helpBtn) helpBtn.onclick = () => {
                showWelcomeOnboardingModal(true);
            };
        }

        // Debug Copy Handler
        if (debugBtn) {
            if (debugBtn) debugBtn.onclick = async () => {
                logDebug("Exporting debug diagnostic report...");
                const report = generateDebugReport();
                try {
                    await copyToClipboard(report);
                    debugBtn.innerHTML = ICONS.check;
                    setLog("Debug report copied to clipboard. You can paste it directly to AI.", "var(--accent-green)");
                    setTimeout(() => {
                        debugBtn.innerHTML = ICONS.debug;
                    }, 2500);
                } catch (err) {
                    console.error("Clipboard write error:", err);
                    setLog("Failed to copy automatically. Check browser console.", "var(--accent-pink)");
                }
            };
        }

        // Activity Log Feed Toggle & Clear Handlers
        const btnToggleLogs = document.getElementById('amaes-btn-toggle-logs');
        const activityFeed = document.getElementById('amaes-activity-feed');
        if (btnToggleLogs && activityFeed) {
            btnToggleLogs.onclick = (e) => {
                e.preventDefault();
                const isHidden = activityFeed.style.display === 'none';
                activityFeed.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) renderActivityLogs();
                localStorage.setItem('amaes_pref_show_logs', isHidden ? 'true' : 'false');
            };

            const savedShowLogs = localStorage.getItem('amaes_pref_show_logs') === 'true';
            if (savedShowLogs) {
                activityFeed.style.display = 'flex';
                renderActivityLogs();
            }
        }

        const btnClearLogs = document.getElementById('amaes-btn-clear-logs');
        if (btnClearLogs) {
            btnClearLogs.onclick = (e) => {
                e.preventDefault();
                activityHistory.length = 0;
                renderActivityLogs();
                const countBadge = document.getElementById('amaes-log-count-badge');
                if (countBadge) countBadge.innerText = 'Log (0)';
            };
        }

        // Batch Execution Engine for Auto-Marker
        const runBatch = async (goal, category) => {
            if (isRunning) return;

            if (!checkIsCoursePage()) {
                setLog("<b>Action Blocked:</b> You are not on a course page. Open a course subject first.", "var(--accent-pink)");
                return;
            }

            isRunning = true;
            shouldStop = false;
            stopBtn.style.display = 'flex';

            const actionLabel = goal === 'mark_done' ? 'Marking' : 'Undoing';
            setLog(`Searching for ${category} items to ${goal === 'mark_done' ? 'complete' : 'undo'}...`);

            const items = findButtons(goal, category);
            if (items.length === 0) {
                setLog(`No matching items found for: <b>${category}</b> (${goal})!`, "var(--accent-green)");
                finish();
                return;
            }

            setLog(`Found ${items.length} items. Starting...`);

            let processedCount = 0;
            for (let i = 0; i < items.length; i++) {
                if (shouldStop) {
                    setLog(`Stopped. Processed ${processedCount} items.`, "var(--accent-amber)");
                    break;
                }

                const item = items[i];
                setLog(`[${i + 1}/${items.length}] ${actionLabel}: <b>${item.title.substring(0, 22)}...</b>`);

                item.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.button.click();
                processedCount++;

                await new Promise(r => setTimeout(r, 450));
            }

            if (!shouldStop) {
                setLog(`Successfully finished ${actionLabel.toLowerCase()} ${processedCount} items!`, "var(--accent-green)");
            }

            finish();
        };

        const finish = () => {
            isRunning = false;
            stopBtn.style.display = 'none';
        };

        if (stopBtn) stopBtn.onclick = () => {
            shouldStop = true;
            setLog('Stopping after current item...', "var(--accent-amber)");
        };

        // Attach Clicks
        const _el__btn_mark_lec_ = document.getElementById('btn-mark-lec');
        if (_el__btn_mark_lec_) _el__btn_mark_lec_.onclick = () => runBatch('mark_done', 'lecture');
        const _el__btn_mark_quiz_ = document.getElementById('btn-mark-quiz');
        if (_el__btn_mark_quiz_) _el__btn_mark_quiz_.onclick = () => runBatch('mark_done', 'quiz');
        const _el__btn_mark_all_ = document.getElementById('btn-mark-all');
        if (_el__btn_mark_all_) _el__btn_mark_all_.onclick = () => runBatch('mark_done', 'all');

        const _el__btn_undo_lec_ = document.getElementById('btn-undo-lec');
        if (_el__btn_undo_lec_) _el__btn_undo_lec_.onclick = () => runBatch('undo', 'lecture');
        const _el__btn_undo_quiz_ = document.getElementById('btn-undo-quiz');
        if (_el__btn_undo_quiz_) _el__btn_undo_quiz_.onclick = () => runBatch('undo', 'quiz');
        const _el__btn_undo_all_ = document.getElementById('btn-undo-all');
        if (_el__btn_undo_all_) _el__btn_undo_all_.onclick = () => runBatch('undo', 'all');

        // Quiz Automation will be initialized once when document is ready
    }

    function initializeToolkit() {
        if (!isUserLoggedIn()) {
            logDebug("User not logged in; skipping UI mounting.");
            return;
        }

        fetchAndCacheAclcLogo();
        createPanel();
        setupQuizAutomation();
        setupQuizKeyboardShortcuts();
        showWelcomeOnboardingModal(false);
        injectDashboardCourseBadges();
        injectDashboardGuideBanner();
        checkForScriptUpdates(false);

        // Auto-Harvest past quizzes: scan Grade Report once per session per course
        if (autoHarvestGrades) {
            try {
                const isGradesPage = window.location.pathname.includes('/grade/report/user/index.php');
                const isCoursePage = window.location.pathname.includes('/course/view.php');
                if (isGradesPage || isCoursePage) {
                    const cInfo = detectCourseInfo();
                    const courseKey = (cInfo && cInfo.subjectCode && cInfo.subjectCode !== 'DEFAULT' && cInfo.subjectCode !== 'GENERAL')
                        ? cInfo.subjectCode
                        : (new URLSearchParams(window.location.search).get('id') || 'grades');
                    const sessKey = `amaes_grades_harvested_${courseKey}`;
                    if (!sessionStorage.getItem(sessKey)) {
                        sessionStorage.setItem(sessKey, '1');
                        setTimeout(() => {
                            executeGradesHarvester();
                        }, 1800);
                    }
                }
            } catch (e) {
                logDebug(`Auto grades harvest error: ${e.message}`);
            }
        }

        // Auto Cloud Sync: sync answers from community repository once per session in background
        if (autoCloudSync) {
            try {
                const cInfo = detectCourseInfo();
                const sc = cInfo ? cInfo.subjectCode : null;
                if (sc && sc !== 'GENERAL' && sc !== 'DEFAULT' && !sessionStorage.getItem(`amaes_cloud_synced_${sc}`)) {
                    sessionStorage.setItem(`amaes_cloud_synced_${sc}`, '1');
                    setLog(`Auto-syncing community database for <b>${sc}</b>...`, "var(--accent-blue)");
                    syncAnswersFromCloud(sc).then(res => {
                        if (res && res.count > 0) {
                            showToast(`Auto-synced ${res.count} community answers for ${sc}!`);
                            setLog(`Auto-synced <b>${res.count}</b> answers for <b>${sc}</b> from Cloud Hub.`, "var(--accent-green)");
                            const fresh = getCachedAnswers(sc);
                            const lbl = document.getElementById('fetch-btn-label');
                            if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;
                            if (checkIsQuizPage()) {
                                highlightQuizAnswers(fresh, false);
                            }
                        }
                    }).catch(err => {
                        logDebug(`Auto cloud sync note for ${sc}: ${err.message}`);
                    });
                }
            } catch (e) {
                logDebug(`Auto cloud sync error: ${e.message}`);
            }

            // Dashboard Auto-Sync: automatically sync all detected courses visible on dashboard
            try {
                const isDashboard = window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php') || window.location.pathname === '/' || window.location.pathname.endsWith('/index.php');
                if (isDashboard) {
                    setTimeout(() => {
                        const dashCourses = detectDashboardCourses();
                        dashCourses.forEach(c => {
                            if (c.code && !sessionStorage.getItem(`amaes_cloud_synced_${c.code}`)) {
                                sessionStorage.setItem(`amaes_cloud_synced_${c.code}`, '1');
                                syncAnswersFromCloud(c.code).then(res => {
                                    if (res && res.count > 0) {
                                        injectDashboardCourseBadges();
                                    }
                                }).catch(e => {
                                    logDebug(`Dashboard auto-sync note for ${c.code}: ${e.message}`);
                                });
                            }
                        });
                    }, 1200);
                }
            } catch (e) {
                logDebug(`Dashboard auto-sync error: ${e.message}`);
            }
        }

        // Observe DOM mutations on dashboard to tag dynamically loaded course cards & auto-sync
        if (window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php')) {
            let debounceTimer = null;
            const obs = new MutationObserver(() => {
                injectDashboardCourseBadges();
                injectDashboardGuideBanner();
                if (autoCloudSync) {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        const dashCourses = detectDashboardCourses();
                        dashCourses.forEach(c => {
                            if (c.code && !sessionStorage.getItem(`amaes_cloud_synced_${c.code}`)) {
                                sessionStorage.setItem(`amaes_cloud_synced_${c.code}`, '1');
                                syncAnswersFromCloud(c.code).then(res => {
                                    if (res && res.count > 0) {
                                        injectDashboardCourseBadges();
                                    }
                                }).catch(e => {
                                    logDebug(`Dashboard observer auto-sync note for ${c.code}: ${e.message}`);
                                });
                            }
                        });
                    }, 1500);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeToolkit);
    } else {
        initializeToolkit();
    }

})();
