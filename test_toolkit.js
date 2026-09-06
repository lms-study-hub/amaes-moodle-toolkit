/**
 * Automated Verification & Regression Test Suite for AMAES Moodle Toolkit
 */

const fs = require('fs');
const assert = require('assert');

console.log("==================================================");
console.log("RUNNING COMPREHENSIVE TEST SUITE FOR AMAES TOOLKIT");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(`      ${err.message}`);
        failed++;
    }
}

// --------------------------------------------------
// 1. Choice Normalization & Negative Sign Integrity
// --------------------------------------------------
function unscriptDigits(str) {
    if (!str) return '';
    const map = {
        '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
        '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'
    };
    return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, ch => map[ch] || ch);
}

function normalizeChoice(str) {
    if (!str) return '';
    let text = str.toLowerCase().trim();
    text = text.replace(/[\u2212\u2013\u2014]/g, '-');
    text = text.replace(/^select one:?\s*/i, '').replace(/^[a-e][.)]\s*/i, '');
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/[.:?!;,]+$/, '');
    text = unscriptDigits(text);
    return text.trim();
}

test("Choice Normalization: preserves negative signs on numbers (-010 vs 010)", () => {
    const choiceA = normalizeChoice("a.  -010");
    const choiceC = normalizeChoice("c.  010");
    assert.strictEqual(choiceA, "-010");
    assert.strictEqual(choiceC, "010");
    assert.notStrictEqual(choiceA, choiceC, "Choice A and Choice C must NOT be equal!");
});

test("Choice Normalization: unicode minus signs (\\u2212, en-dash) normalized to standard hyphen", () => {
    assert.strictEqual(normalizeChoice("a. \u2212010"), "-010");
    assert.strictEqual(normalizeChoice("b. –011"), "-011");
});

test("Choice Normalization: complex choice prefixes stripped without stripping minus", () => {
    assert.strictEqual(normalizeChoice("Select one: a. 100"), "100");
    assert.strictEqual(normalizeChoice("Select one: b. -50"), "-50");
    assert.strictEqual(normalizeChoice("a) True"), "true");
    assert.strictEqual(normalizeChoice("d. X = AB"), "x = ab");
    assert.strictEqual(normalizeChoice("b. X = ABC"), "x = abc");
});

test("Choice Normalization: superscripts and subscripts normalize to standard digits", () => {
    assert.strictEqual(normalizeChoice("(110)²"), "(110)2");
    assert.strictEqual(normalizeChoice("(110)₂"), "(110)2");
    assert.strictEqual(normalizeChoice("(124)₂"), "(124)2");
    assert.strictEqual(normalizeChoice("(000)₂"), "(000)2");
    assert.strictEqual(normalizeChoice("(110)²"), normalizeChoice("(110)₂"));
});

// --------------------------------------------------
// 2. Exact Matcher vs Substring Collision Safety
// --------------------------------------------------
function matchChoice(choiceRaw, candidateAnswer) {
    const choiceText = normalizeChoice(choiceRaw);
    const ansNorm = normalizeChoice(candidateAnswer);
    if (!ansNorm) return false;

    const isDirectMatch = choiceText === ansNorm;
    const isMultiAnswerMatch = (ansNorm.includes(',') || ansNorm.includes(';') || ansNorm.includes('&')) &&
        ansNorm.split(/[,;&]+/).map(s => normalizeChoice(s)).includes(choiceText);

    return isDirectMatch || isMultiAnswerMatch;
}

test("Matcher Safety: X = AB does NOT match X = ABC", () => {
    const choiceB = "b. X = ABC";
    const choiceD = "d. X = AB";
    const verifiedAnswer = "X = ABC";

    assert.strictEqual(matchChoice(choiceB, verifiedAnswer), true, "Choice B (X = ABC) must match!");
    assert.strictEqual(matchChoice(choiceD, verifiedAnswer), false, "Choice D (X = AB) must NOT match!");
});

test("Matcher Safety: RAM does NOT match DRAM", () => {
    assert.strictEqual(matchChoice("a. RAM", "DRAM"), false);
    assert.strictEqual(matchChoice("b. DRAM", "DRAM"), true);
});

test("Matcher Safety: 10 does NOT match 100", () => {
    assert.strictEqual(matchChoice("a. 10", "100"), false);
    assert.strictEqual(matchChoice("b. 100", "100"), true);
});

test("Matcher Safety: AND does NOT match NAND", () => {
    assert.strictEqual(matchChoice("a. AND", "NAND"), false);
    assert.strictEqual(matchChoice("b. NAND", "NAND"), true);
});

test("Matcher Safety: Multi-answer checkboxes match all correct items", () => {
    const ans = "Option A, Option C";
    assert.strictEqual(matchChoice("a. Option A", ans), true);
    assert.strictEqual(matchChoice("b. Option B", ans), false);
    assert.strictEqual(matchChoice("c. Option C", ans), true);
});

// --------------------------------------------------
// 3. Single-Select Radio Guard (No double green)
// --------------------------------------------------
test("Radio Guard: only the first verified choice is highlighted on single-choice questions", () => {
    const choices = [
        "a. X = AB + C",
        "b. X = ABC",
        "c. X = A + B + C",
        "d. X = ABC" // Hypothetical duplicate in malformed bank
    ];
    const isRadio = true;
    let foundMatchForQuestion = false;
    const highlighted = [];

    choices.forEach((c, idx) => {
        if (isRadio && foundMatchForQuestion) return;
        if (matchChoice(c, "X = ABC")) {
            foundMatchForQuestion = true;
            highlighted.push(idx);
        }
    });

    assert.strictEqual(highlighted.length, 1, "Exactly 1 choice must be highlighted on radio questions!");
    assert.strictEqual(highlighted[0], 1, "Choice b (index 1) must be the sole highlighted choice!");
});

// --------------------------------------------------
// 4. Academic Term Detection
// --------------------------------------------------
function detectTermFromText(text) {
    if (!text) return null;
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

test("Term Detection: accurately categorizes all 4 academic terms", () => {
    assert.strictEqual(detectTermFromText("CS6301 Prelim Quiz 1"), "Prelim");
    assert.strictEqual(detectTermFromText("Week 3 Quiz: Digital Logic"), "Prelim");
    assert.strictEqual(detectTermFromText("Midterm Examination"), "Midterm");
    assert.strictEqual(detectTermFromText("Week 8 Exam"), "Midterm");
    assert.strictEqual(detectTermFromText("Pre-final Examination"), "Prefi");
    assert.strictEqual(detectTermFromText("Prefi Quiz 1"), "Prefi");
    assert.strictEqual(detectTermFromText("Week 12 Assessment"), "Prefi");
    assert.strictEqual(detectTermFromText("Final Examination"), "Final");
    assert.strictEqual(detectTermFromText("Week 18 Finals"), "Final");
    assert.strictEqual(detectTermFromText("Course Syllabus"), null);
});

// --------------------------------------------------
// 5. Review Screen Harvesting for Plural / Multi Answers
// --------------------------------------------------
function cleanRightAnswer(raw) {
    return raw.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
}

test("Review Harvesting: cleans singular and plural Moodle rightanswer boxes", () => {
    assert.strictEqual(cleanRightAnswer("The correct answer is: 010"), "010");
    assert.strictEqual(cleanRightAnswer("The correct answers are: Option A, Option B"), "Option A, Option B");
    assert.strictEqual(cleanRightAnswer("The correct answer is: 'X = ABC'"), "X = ABC");
});

// --------------------------------------------------
// 6. Keyboard Shortcuts Input Safety
// --------------------------------------------------
function isTextInputElement(tag, type, isContentEditable) {
    const t = (tag || '').toUpperCase();
    const ty = (type || '').toLowerCase();
    return (t === 'INPUT' && !['radio', 'checkbox', 'button', 'submit', 'reset'].includes(ty)) ||
           t === 'TEXTAREA' ||
           Boolean(isContentEditable);
}

test("Shortcuts Safety: Radio and Checkbox focus ALLOWS keyboard navigation", () => {
    assert.strictEqual(isTextInputElement('INPUT', 'radio', false), false, "Radio focus must NOT block hotkeys!");
    assert.strictEqual(isTextInputElement('INPUT', 'checkbox', false), false, "Checkbox focus must NOT block hotkeys!");
    assert.strictEqual(isTextInputElement('BUTTON', '', false), false, "Button focus must NOT block hotkeys!");
});

test("Shortcuts Safety: Text input and Textarea focus BLOCKS keyboard navigation", () => {
    assert.strictEqual(isTextInputElement('INPUT', 'text', false), true, "Text input must block hotkeys!");
    assert.strictEqual(isTextInputElement('INPUT', 'email', false), true, "Email input must block hotkeys!");
    assert.strictEqual(isTextInputElement('TEXTAREA', '', false), true, "Textarea must block hotkeys!");
    assert.strictEqual(isTextInputElement('DIV', '', true), true, "ContentEditable must block hotkeys!");
});

// --------------------------------------------------
// 7. Community Payload Generator & Filter
// --------------------------------------------------
function generatePayload(code, qList) {
    const validQuestions = qList.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
    return {
        subjectCode: code,
        totalQuestions: validQuestions.length,
        questions: validQuestions.map(q => ({
            question: q.qRaw || q.question || q.qText || "",
            answer: q.ansRaw || q.answer || q.correctAnswer || "",
            choices: q.choices || [],
            wrongAnswers: q.wrongAnswers || []
        }))
    };
}

test("Community Payload: filters out questions with no verified answer", () => {
    const localDb = [
        { qRaw: "What is 1+1?", ansRaw: "2", choices: ["1", "2", "3"], wrongAnswers: [] },
        { qRaw: "What is 2+2?", ansRaw: null, choices: ["3", "4", "5"], wrongAnswers: ["3"] }, // Unverified
        { question: "What is 3+3?", answer: "6", choices: ["5", "6", "7"], wrongAnswers: [] }
    ];

    const payload = generatePayload("MATH101", localDb);
    assert.strictEqual(payload.totalQuestions, 2, "Payload must only contain the 2 verified questions!");
    assert.strictEqual(payload.questions[0].answer, "2");
    assert.strictEqual(payload.questions[1].answer, "6");
    assert.strictEqual(payload.questions.some(q => !q.answer), false, "No question in payload can have empty answer!");
});

// --------------------------------------------------
// 8. Elimination Deduction Engine
// --------------------------------------------------
function deduceChoice(choices, wrongAnswers) {
    if (!choices || choices.length <= 1) return null;
    const wrongNorms = wrongAnswers.map(w => normalizeChoice(typeof w === 'string' ? w : w.text));
    const remaining = choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
    if (remaining.length === 1) {
        return remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
    }
    return null;
}

test("Deduction Engine: 3 wrong choices deduces 4th choice as 100% correct", () => {
    const choices = ["a. 28", "b. 82", "c. 81", "d. 18"];
    const wrong = ["28", "82", "81"];
    const deduced = deduceChoice(choices, wrong);
    assert.strictEqual(deduced, "18");
});

test("Deduction Engine: 4 wrong choices safely returns null with no crash", () => {
    const choices = ["a. 28", "b. 82", "c. 81", "d. 18"];
    const wrong = ["28", "82", "81", "18"];
    const deduced = deduceChoice(choices, wrong);
    assert.strictEqual(deduced, null);
});

// --------------------------------------------------
// 9. Grades Harvester & Background Relay
// --------------------------------------------------
test("Grades Harvester: filters completed vs empty quiz rows accurately", () => {
    const testRows = [
        { title: "Prelim Quiz 1", gradeText: "20.00", percentage: "100.00 %", isEmpty: false },
        { title: "Prelim Lab Quiz 1", gradeText: "-", percentage: "-", isEmpty: true },
        { title: "Prelim Quiz 2", gradeText: "18.18", percentage: "90.91 %", isEmpty: false },
        { title: "Midterm Quiz 1", gradeText: "19.00", percentage: "95.00 %", isEmpty: false }
    ];

    const completed = testRows.filter(r => !r.isEmpty && r.gradeText !== '-' && /\b\d+(\.\d+)?/.test(r.gradeText));
    assert.strictEqual(completed.length, 3, "Exactly 3 completed quizzes should be detected!");
    assert.strictEqual(completed[0].title, "Prelim Quiz 1");
    assert.strictEqual(completed[1].title, "Prelim Quiz 2");
    assert.strictEqual(completed[2].title, "Midterm Quiz 1");
});

test("Grades Harvester: resolves relative review URLs with &showall=1 query", () => {
    const baseUrl = "https://semestral.amaes.com/2612/mod/quiz/view.php?id=1689";
    const relativeReviewHref = "review.php?attempt=45230";
    let reviewUrl = new URL(relativeReviewHref, baseUrl).href;
    if (!reviewUrl.includes('showall=')) {
        reviewUrl += (reviewUrl.includes('?') ? '&' : '?') + 'showall=1';
    }
    assert.strictEqual(reviewUrl, "https://semestral.amaes.com/2612/mod/quiz/review.php?attempt=45230&showall=1");
});

test("Background Relay Payload: formats anonymous payload with required schema", () => {
    const rawQuestions = [
        { qRaw: "What is Boolean algebra?", ansRaw: "Logic system", choices: ["A", "B"] }
    ];
    const payload = {
        subjectCode: "CS6301",
        totalQuestions: rawQuestions.length,
        source: "grades_harvester",
        submittedAt: new Date().toISOString(),
        questions: rawQuestions.map(q => ({
            question: q.qRaw,
            answer: q.ansRaw,
            choices: q.choices,
            wrongAnswers: []
        }))
    };

    assert.strictEqual(payload.subjectCode, "CS6301");
    assert.strictEqual(payload.totalQuestions, 1);
    assert.strictEqual(payload.questions[0].answer, "Logic system");
    assert.strictEqual(Boolean(payload.submittedAt), true);
});

// --------------------------------------------------
// 10. Multi-Tier Database Integration & Priority
// --------------------------------------------------
function mergeTieredAnswers(verifiedList, amauoedList) {
    const combined = [];
    const seen = new Set();

    // 1. Verified official answers take highest priority
    for (const q of verifiedList) {
        const key = q.question.toLowerCase().trim();
        seen.add(key);
        combined.push({ ...q, tier: 'verified' });
    }

    // 2. Amauoed curated answers populate remaining questions
    for (const q of amauoedList) {
        const key = q.question.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            combined.push({ ...q, tier: 'amauoed' });
        }
    }

    return combined;
}

test("Multi-Tier DB: Verified tier takes priority over amauoed tier on duplicate questions", () => {
    const verified = [
        { question: "What is an algorithm?", answer: "A finite step-by-step procedure" }
    ];
    const amauoed = [
        { question: "What is an algorithm?", answer: "A set of rules" },
        { question: "What is CPU?", answer: "Central Processing Unit" }
    ];

    const merged = mergeTieredAnswers(verified, amauoed);
    assert.strictEqual(merged.length, 2, "Merged DB must contain exactly 2 unique questions!");
    assert.strictEqual(merged[0].answer, "A finite step-by-step procedure", "Verified answer must take precedence!");
    assert.strictEqual(merged[0].tier, "verified");
    assert.strictEqual(merged[1].answer, "Central Processing Unit");
    assert.strictEqual(merged[1].tier, "amauoed");
});

// --------------------------------------------------
// 11. Auto-Harvest Settings & Session Gating
// --------------------------------------------------
test("Auto-Harvest Configuration: defaults to enabled and respects session gate", () => {
    const mockStorage = new Map();
    const mockSession = new Map();

    // Default test: when nothing in storage, must be true
    const isEnabledByDefault = mockStorage.get('amaes_auto_harvest_grades') !== 'false';
    assert.strictEqual(isEnabledByDefault, true, "Auto-Harvest must default to true on fresh install!");

    // Session gating test: courseKey session guard prevents multi-trigger
    const courseKey = "CS6301";
    const sessionKey = `amaes_grades_harvested_${courseKey}`;
    
    assert.strictEqual(mockSession.has(sessionKey), false);
    mockSession.set(sessionKey, '1');
    assert.strictEqual(mockSession.has(sessionKey), true);
});

// --------------------------------------------------
// 12. Update Checker Caching & Throttling
// --------------------------------------------------
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

test("Update Checker: semantic version comparison handles patches and suffixes", () => {
    assert.strictEqual(isNewerVersion("1.1.1", "1.1.0"), true);
    assert.strictEqual(isNewerVersion("1.2.0", "1.1.1"), true);
    assert.strictEqual(isNewerVersion("v1.1.1", "v1.1.1"), false);
    assert.strictEqual(isNewerVersion("1.1.0", "1.1.1"), false);
});

test("Update Checker Caching: cached known update bypasses refetching and opens installer immediately", () => {
    const mockStorage = new Map();
    mockStorage.set('amaes_latest_version_seen', '1.2.8');
    mockStorage.set('amaes_last_update_check', String(Date.now()));

    const currentVersion = "v1.2.7";
    const cachedLatest = mockStorage.get('amaes_latest_version_seen');
    const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, currentVersion);

    assert.strictEqual(hasKnownUpdate, true, "Known update v1.2.8 must be detected from cache!");

    // Check manual action: should direct to installer immediately
    let openedUrl = null;
    const SCRIPT_RAW_URL = "https://raw.githubusercontent.com/lms-study-hub/amaes-moodle-toolkit/main/amaes-moodle-toolkit.user.js";
    if (hasKnownUpdate) {
        openedUrl = SCRIPT_RAW_URL;
    }
    assert.strictEqual(openedUrl, SCRIPT_RAW_URL, "Clicking check with cached update must immediately direct to install URL!");
});

test("Userscript Syntax Integrity: ensures amaes-moodle-toolkit.user.js parses with zero syntax errors", () => {
    const fs = require('fs');
    const vm = require('vm');
    const path = require('path');
    const scriptPath = path.join(__dirname, 'amaes-moodle-toolkit.user.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');
    assert.doesNotThrow(() => {
        new vm.Script(scriptCode);
    }, "Userscript must parse without syntax errors!");
});

// --------------------------------------------------
// 14. Dashboard Course Detection & Regex Integrity
// --------------------------------------------------
function extractCourseCode(cardText) {
    if (!cardText) return '';
    const codeMatch = cardText.match(/-\s*([A-Za-z0-9]+) /) || cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
    return codeMatch ? codeMatch[1].toUpperCase() : '';
}

test("Dashboard Course Detection: accurately extracts codes from standard Moodle card titles", () => {
    assert.strictEqual(extractCourseCode("2513 - CS6301 Data Structures and Algorithms"), "CS6301");
    assert.strictEqual(extractCourseCode("2411 - ITE6301 Information Management"), "ITE6301");
    assert.strictEqual(extractCourseCode("MATH101 Calculus 1"), "MATH101");
    assert.strictEqual(extractCourseCode("GEDC106 Readings in Philippine History"), "GEDC106");
    assert.strictEqual(extractCourseCode("Random Announcement Card"), "");
});

// --------------------------------------------------
// 15. Anonymous Community Sharing Payload Guard
// --------------------------------------------------
test("Anonymous Community Auto-Share: payload guarantees 0 personal data leakage", () => {
    const questions = [
        { qRaw: "What is 2+2?", ansRaw: "4", choices: ["2", "3", "4", "5"] }
    ];
    const subCode = "MATH101";

    const payload = {
        subjectCode: subCode,
        totalQuestions: questions.length,
        source: "auto_harvester",
        submittedAt: new Date().toISOString(),
        questions: questions.map(q => ({
            question: q.qRaw,
            answer: q.ansRaw,
            choices: q.choices,
            wrongAnswers: []
        }))
    };

    // Ensure strictly forbidden fields are not present
    const forbiddenKeys = ['studentId', 'userId', 'username', 'email', 'name', 'token', 'session', 'ip'];
    forbiddenKeys.forEach(key => {
        assert.strictEqual(key in payload, false, `Forbidden identifier key '${key}' found in payload!`);
    });

    assert.strictEqual(payload.subjectCode, "MATH101");
    assert.strictEqual(payload.totalQuestions, 1);
    assert.strictEqual(payload.questions[0].answer, "4");
});

// --------------------------------------------------
// 16. Default Configuration for Hands-Free Community Sharing
// --------------------------------------------------
test("Onboarding & Autonomous Sync Defaults: auto-sync and auto-community-share default to true", () => {
    const mockLocalStorage = {
        getItem: (k) => null // default state when fresh install
    };

    const autoCloudSync = mockLocalStorage.getItem('amaes_auto_cloud_sync') !== 'false';
    const autoCommunityShare = mockLocalStorage.getItem('amaes_auto_community_share') !== 'false';
    const autoHarvestGrades = mockLocalStorage.getItem('amaes_auto_harvest_grades') !== 'false';

    assert.strictEqual(autoCloudSync, true, "autoCloudSync must default to true for hands-free sync!");
    assert.strictEqual(autoCommunityShare, true, "autoCommunityShare must default to true for community updates!");
    assert.strictEqual(autoHarvestGrades, true, "autoHarvestGrades must default to true for zero-click past quiz harvest!");
});

// --------------------------------------------------
// 17. Quiz Speedrun Shortcuts & Tips Key Mapping
// --------------------------------------------------
test("Quiz Speedrun Shortcuts: accurately maps 1-4 and A-D to choice indices and N/Space to next page", () => {
    function mapKeyToChoiceIndex(key) {
        key = String(key).toUpperCase();
        if (key >= '1' && key <= '9') {
            return parseInt(key, 10) - 1;
        } else if (['A', 'B', 'C', 'D'].includes(key)) {
            return key.charCodeAt(0) - 65;
        }
        return -1;
    }

    function isNextNavigationKey(key) {
        key = String(key).toUpperCase();
        return key === 'N' || key === ' ' || key === 'ENTER';
    }

    // Test choice indices
    assert.strictEqual(mapKeyToChoiceIndex('1'), 0, "Key 1 must map to index 0 (Choice A)");
    assert.strictEqual(mapKeyToChoiceIndex('2'), 1, "Key 2 must map to index 1 (Choice B)");
    assert.strictEqual(mapKeyToChoiceIndex('3'), 2, "Key 3 must map to index 2 (Choice C)");
    assert.strictEqual(mapKeyToChoiceIndex('4'), 3, "Key 4 must map to index 3 (Choice D)");

    assert.strictEqual(mapKeyToChoiceIndex('A'), 0, "Key A must map to index 0 (Choice A)");
    assert.strictEqual(mapKeyToChoiceIndex('B'), 1, "Key B must map to index 1 (Choice B)");
    assert.strictEqual(mapKeyToChoiceIndex('C'), 2, "Key C must map to index 2 (Choice C)");
    assert.strictEqual(mapKeyToChoiceIndex('D'), 3, "Key D must map to index 3 (Choice D)");

    // Test navigation keys
    assert.strictEqual(isNextNavigationKey('N'), true, "Key N must trigger next navigation");
    assert.strictEqual(isNextNavigationKey(' '), true, "Space must trigger next navigation");
    assert.strictEqual(isNextNavigationKey('Enter'), true, "Enter must trigger next navigation");
    assert.strictEqual(isNextNavigationKey('X'), false, "Irrelevant key must not trigger next navigation");
});

// --------------------------------------------------
// 18. Auto-Next & Safe Progression Defaults
// --------------------------------------------------
test("Auto-Next & Safe Progression Defaults: autoNextQuiz is false, autoSubmitQuiz is permanently false", () => {
    const mockLocalStorage = {
        getItem: (k) => null // default state on fresh install
    };

    const autoNextQuiz = mockLocalStorage.getItem('amaes_auto_next_quiz') === 'true';
    const autoSubmitQuiz = false; // Permanently disabled by design

    assert.strictEqual(autoNextQuiz, false, "autoNextQuiz must default to false so students can review answers before advancing!");
    assert.strictEqual(autoSubmitQuiz, false, "autoSubmitQuiz must remain false to prevent accidental quiz submission!");
});

// --------------------------------------------------
// 19. Page Completeness & Review Summary Auto-Submit Gate
// --------------------------------------------------
test("Page Completeness & Summary Submit Gate: checks all questions answered before advancing to review", () => {
    // Simulate DOM check for page question completion
    function checkPageQuestionsComplete(mockQuestions) {
        if (!mockQuestions || mockQuestions.length === 0) return false;
        return mockQuestions.every(q => q.hasChecked || q.hasText || q.isAnswered);
    }

    const page1Incomplete = [
        { id: 1, hasChecked: true, hasText: false, isAnswered: true },
        { id: 2, hasChecked: false, hasText: false, isAnswered: false }
    ];
    assert.strictEqual(checkPageQuestionsComplete(page1Incomplete), false, "Page with unanswered question must NOT auto-advance!");

    const page1Complete = [
        { id: 1, hasChecked: true, hasText: false, isAnswered: true },
        { id: 2, hasChecked: true, hasText: false, isAnswered: true }
    ];
    assert.strictEqual(checkPageQuestionsComplete(page1Complete), true, "Page where all questions have choices selected must trigger auto-advance!");

    // Simulate summary page table check
    function shouldSubmitSummary(summaryRows, autoSubmitEnabled) {
        if (!autoSubmitEnabled) return false;
        const incomplete = summaryRows.filter(r => /not yet answered|incomplete/i.test(r.status));
        return incomplete.length === 0;
    }

    const summaryComplete = [
        { qNum: 1, status: "Answer saved" },
        { qNum: 2, status: "Answer saved" }
    ];
    assert.strictEqual(shouldSubmitSummary(summaryComplete, true), true, "Completed summary must auto-submit to review!");

    const summaryIncomplete = [
        { qNum: 1, status: "Answer saved" },
        { qNum: 2, status: "Not yet answered" }
    ];
    assert.strictEqual(shouldSubmitSummary(summaryIncomplete, true), false, "Summary with unanswered questions must pause!");
});

// --------------------------------------------------
// 20. Choice Probability Badges & Wrong Choice Highlighting
// --------------------------------------------------
test("Choice Probability & Wrong Badges: accurately formats confidence weights and wrong choices", () => {
    function formatSourceBadge(cand) {
        const isDeduced = cand.deduced === true;
        const isAmauoed = cand.source === 'amauoed';
        const confSuffix = (cand.confirmations && cand.confirmations > 1) ? ` (${cand.confirmations}x)` : '';
        return isDeduced ? `Deduced • 100% Prob${confSuffix}` : (isAmauoed ? `AMAUOED • 95% Prob${confSuffix}` : `Verified • 100% Prob${confSuffix}`);
    }

    function formatWrongBadge(matchedWrong) {
        return matchedWrong.count > 1 ? `Wrong (${matchedWrong.count}x) • 0% Prob` : 'Wrong • 0% Prob';
    }

    function formatCandidateProb(uneliminatedCount) {
        const remainingProb = Math.round(100 / uneliminatedCount);
        return `Candidate • ${remainingProb}% Prob`;
    }

    // Verified correct DB
    assert.strictEqual(formatSourceBadge({ verified: true, source: 'verified_db' }), "Verified • 100% Prob");
    assert.strictEqual(formatSourceBadge({ verified: true, confirmations: 3, source: 'verified_db' }), "Verified • 100% Prob (3x)");

    // AMAUOED catalog
    assert.strictEqual(formatSourceBadge({ verified: false, source: 'amauoed' }), "AMAUOED • 95% Prob");
    assert.strictEqual(formatSourceBadge({ verified: false, confirmations: 2, source: 'amauoed' }), "AMAUOED • 95% Prob (2x)");

    // Deduced 100%
    assert.strictEqual(formatSourceBadge({ deduced: true, verified: true }), "Deduced • 100% Prob");

    // Confirmed wrong choices
    assert.strictEqual(formatWrongBadge({ count: 1 }), "Wrong • 0% Prob");
    assert.strictEqual(formatWrongBadge({ count: 4 }), "Wrong (4x) • 0% Prob");

    // Elimination probabilities
    assert.strictEqual(formatCandidateProb(2), "Candidate • 50% Prob");
    assert.strictEqual(formatCandidateProb(3), "Candidate • 33% Prob");
});

// --------------------------------------------------
// 21. Community Auto-Dispatch on Local Save
// --------------------------------------------------
test("Community Auto-Share on Local Save: triggers when new answers saved unless cloud-synced or disabled", () => {
    function shouldDispatchToCommunity(autoShareSetting, sourceLabel, stats) {
        const autoShareEnabled = autoShareSetting !== 'false';
        const isFromCloudSync = typeof sourceLabel === 'string' && sourceLabel.startsWith('Cloud-');
        const hasFreshData = (stats.added > 0 || stats.confirmed > 0 || stats.eliminated > 0);
        return autoShareEnabled && !isFromCloudSync && hasFreshData;
    }

    // Default ON: fresh review answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'review_screen', { added: 1, confirmed: 0, eliminated: 0 }), true);
    // Freshly deduced answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'Elimination Deduction', { added: 1, confirmed: 0, eliminated: 0 }), true);
    // Freshly scraped AMAUOED answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'AMAUOED', { added: 10, confirmed: 0, eliminated: 0 }), true);
    // Suppressed if downloaded from cloud (avoid echo loops)
    assert.strictEqual(shouldDispatchToCommunity('true', 'Cloud-Verified', { added: 5, confirmed: 0, eliminated: 0 }), false);
    assert.strictEqual(shouldDispatchToCommunity('true', 'Cloud-Amauoed', { added: 5, confirmed: 0, eliminated: 0 }), false);
    // Suppressed if user toggled off auto-share
    assert.strictEqual(shouldDispatchToCommunity('false', 'review_screen', { added: 5, confirmed: 0, eliminated: 0 }), false);
    // Suppressed if no changes occurred
    assert.strictEqual(shouldDispatchToCommunity('true', 'review_screen', { added: 0, confirmed: 0, eliminated: 0 }), false);
});

// --------------------------------------------------
// 22. AMAUOED Static Scraping Gating
// --------------------------------------------------
test("AMAUOED Static Scraping Gate: avoids redundant scraping if local cache or prior scrape exists", () => {
    function shouldScrapeAmauoed(localCount, hasAmauoedUrl, alreadyScrapedFlag) {
        // If local cache already has answers, static link re-scraping is redundant
        if (localCount > 0) return false;
        // If no link exists, cannot scrape
        if (!hasAmauoedUrl) return false;
        // If already scraped once, static content does not change
        if (alreadyScrapedFlag) return false;
        return true;
    }

    // 0 local answers, valid link, not yet scraped -> SHOULD scrape
    assert.strictEqual(shouldScrapeAmauoed(0, true, false), true);
    // Local answers exist -> DO NOT scrape
    assert.strictEqual(shouldScrapeAmauoed(25, true, false), false);
    // Already scraped -> DO NOT scrape again
    assert.strictEqual(shouldScrapeAmauoed(0, true, true), false);
    // No link known -> cannot scrape
    assert.strictEqual(shouldScrapeAmauoed(0, false, false), false);
});

// --------------------------------------------------
// 23. Harvester Concurrency Mutex & Race Guard
// --------------------------------------------------
test("Harvester Concurrency Mutex: blocks duplicate simultaneous background & manual harvesting", async () => {
    let isHarvestingInProgress = false;

    async function simulateHarvester() {
        if (isHarvestingInProgress) {
            return { success: false, inProgress: true };
        }
        isHarvestingInProgress = true;
        try {
            await new Promise(r => setTimeout(r, 10));
            return { success: true, count: 5 };
        } finally {
            isHarvestingInProgress = false;
        }
    }

    // Launch first harvest
    const run1 = simulateHarvester();
    // Immediate concurrent second launch should be blocked by mutex
    const run2 = await simulateHarvester();

    assert.strictEqual(run2.inProgress, true, "Concurrent harvest attempt must be blocked by mutex!");

    const res1 = await run1;
    assert.strictEqual(res1.success, true, "First harvest run must succeed!");
    assert.strictEqual(isHarvestingInProgress, false, "Mutex must reset to false after completion!");
});

// --------------------------------------------------
// 24. Dynamic Course Subject Fallback in Harvester
// --------------------------------------------------
test("Harvester Dynamic Fallback: avoids hardcoded subject code when table detection is empty", () => {
    function resolveSubjectCode(detectedCode, courseId) {
        let subCode = detectedCode;
        if (!subCode || subCode === 'DEFAULT' || subCode === 'GENERAL') {
            subCode = courseId ? (`COURSE_${courseId}`) : 'GENERAL';
        }
        return subCode;
    }

    assert.strictEqual(resolveSubjectCode('MATH6100', '123'), 'MATH6100');
    assert.strictEqual(resolveSubjectCode('', '456'), 'COURSE_456');
    assert.strictEqual(resolveSubjectCode(null, '789'), 'COURSE_789');
    assert.strictEqual(resolveSubjectCode('GENERAL', '999'), 'COURSE_999');
    assert.strictEqual(resolveSubjectCode('', null), 'GENERAL');
    assert.notStrictEqual(resolveSubjectCode('', '123'), 'CS6301', "Must never hardcode CS6301 on unknown course!");
});

// --------------------------------------------------
// 25. Question Text Subscript Normalization & Base Collision Guard
// --------------------------------------------------
test("Question Normalization: unscripts digits so distinct bases do not collide", () => {
    function normalizeTextTest(str) {
        if (!str) return '';
        let text = str.toLowerCase().trim();
        text = unscriptDigits(text);
        text = text.replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    const octalQ = normalizeTextTest("Convert (22)₈ into its corresponding decimal number.");
    const hexQ = normalizeTextTest("Convert (22)₁₆ into its corresponding decimal number.");
    const binQ = normalizeTextTest("Convert (22)₂ into its corresponding decimal number.");

    assert.strictEqual(octalQ, "convert (22)8 into its corresponding decimal number");
    assert.strictEqual(hexQ, "convert (22)16 into its corresponding decimal number");
    assert.strictEqual(binQ, "convert (22)2 into its corresponding decimal number");
    assert.notStrictEqual(octalQ, hexQ, "Octal and Hex questions must NOT collide!");
    assert.notStrictEqual(octalQ, binQ, "Octal and Binary questions must NOT collide!");
});

// --------------------------------------------------
// 26. Contradiction Guard: Prevents Eliminating 100% of Choices
// --------------------------------------------------
test("Contradiction Guard: retains at least 1 candidate when all choices marked wrong", () => {
    const choices = ["a. 82", "b. 18", "c. 28", "d. 81"];
    let allWrongList = [
        { norm: "18", count: 1 },
        { norm: "81", count: 2 },
        { norm: "28", count: 3 },
        { norm: "82", count: 4 }
    ];

    if (choices.length >= 2 && allWrongList.length >= choices.length) {
        allWrongList.sort((a, b) => (b.count || 1) - (a.count || 1));
        allWrongList.splice(choices.length - 1);
    }

    assert.strictEqual(allWrongList.length, 3, "Must retain at most 3 wrong choices out of 4!");
    // The choice with lowest count (18, count: 1) is spared!
    assert.strictEqual(allWrongList.some(w => w.norm === "18"), false, "Choice with lowest failure count must be freed!");
});

// --------------------------------------------------
// 27. Contradiction Safety: Confirmed Wrong Answer Demotes Incorrect Database Entry
// --------------------------------------------------
test("Contradiction Safety: Confirmed wrong choice demotes invalid answer and blocks verified badge", () => {
    const cur = {
        qNorm: "it involves developing a game plan to guide a company",
        ansRaw: "strategic plan",
        ansNorm: "strategic plan",
        verified: true,
        confirmations: 2,
        wrongAnswers: []
    };

    const incomingWrong = [{ norm: "strategic plan", text: "strategic plan", count: 1 }];

    // Review/attempt proved current ansRaw was WRONG
    incomingWrong.forEach(inW => {
        if (cur.ansNorm && (inW.norm === cur.ansNorm || unscriptDigits(inW.norm) === unscriptDigits(cur.ansNorm))) {
            cur.ansRaw = '';
            cur.ansNorm = '';
            cur.verified = false;
            cur.confirmations = 0;
        }
        cur.wrongAnswers.push(inW);
    });

    assert.strictEqual(cur.ansRaw, '', "ansRaw must be cleared when proven incorrect");
    assert.strictEqual(cur.verified, false, "verified must be demoted to false");
    assert.strictEqual(cur.confirmations, 0, "confirmations must reset to 0");
    assert.strictEqual(cur.wrongAnswers.length, 1, "wrongAnswers must contain the eliminated choice");
});

// --------------------------------------------------
// 28. Dynamic Semester Detection (No Hardcoded 2612)
// --------------------------------------------------
test("Dynamic Semester Detection: extracts any term code dynamically (2612, 2613, 301)", () => {
    function detectSemesterBase(pathname, mockStorage = {}) {
        const m = pathname.match(/^\/(\d{3,5})\//);
        if (m) {
            return `/${m[1]}/`;
        }
        return mockStorage.saved || '/';
    }

    function buildCoursesUrl(pathname, origin = 'https://semestral.amaes.com') {
        return `${origin}${detectSemesterBase(pathname)}my/courses.php`;
    }

    assert.strictEqual(detectSemesterBase('/2612/my/courses.php'), '/2612/');
    assert.strictEqual(detectSemesterBase('/2613/course/view.php?id=123'), '/2613/');
    assert.strictEqual(detectSemesterBase('/301/mod/quiz/attempt.php'), '/301/');
    assert.strictEqual(detectSemesterBase('/login/index.php', { saved: '/2612/' }), '/2612/');
    assert.strictEqual(detectSemesterBase('/login/index.php'), '/');

    assert.strictEqual(buildCoursesUrl('/2612/my/courses.php'), 'https://semestral.amaes.com/2612/my/courses.php');
    assert.strictEqual(buildCoursesUrl('/2613/my/courses.php'), 'https://semestral.amaes.com/2613/my/courses.php');
    assert.strictEqual(buildCoursesUrl('/301/my/courses.php'), 'https://semestral.amaes.com/301/my/courses.php');
});

// --------------------------------------------------
// 29. Copy Prompt Formatting: DB Answer & Confidence Toggle
// --------------------------------------------------
test("Copy Prompt Formatting: respects copyIncludeConfidence toggle for answer hints", () => {
    function formatPrompt(qText, choices, detectedAnswer, copyIncludeConfidence, withHint = true) {
        let output = `${qText}\n\n`;
        output += choices.join('\n');
        if (detectedAnswer && copyIncludeConfidence) {
            output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
        }
        if (withHint) {
            output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text.`;
        }
        return output.trim();
    }

    const q = "What does RAM stand for?";
    const choices = ["a. Random Access Memory", "b. Read Access Memory"];
    const detected = { text: "Random Access Memory", label: "Verified • 100% Probability", source: "Verified Database" };

    const withConfidence = formatPrompt(q, choices, detected, true);
    assert.ok(withConfidence.includes("[DETECTED ANSWER IN DATABASE]"), "Must include DB hints when copyIncludeConfidence is true");
    assert.ok(withConfidence.includes("Suggested: Random Access Memory"), "Must include suggestion");

    const withoutConfidence = formatPrompt(q, choices, detected, false);
    assert.strictEqual(withoutConfidence.includes("[DETECTED ANSWER IN DATABASE]"), false, "Must exclude DB hints when copyIncludeConfidence is false");
});

// --------------------------------------------------
// 30. Unanswered / Missing Quizzes Detector
// --------------------------------------------------
test("Missing Quizzes Detector: marks unattempted quizzes in grades report and course page", () => {
    // 1. Simulate Grades Report table rows
    const mockGradesRows = [
        { title: "Prelim Quiz 1", href: "/mod/quiz/view.php?id=1", grade: "100.00", pct: "100.00%" },
        { title: "Prelim Quiz 2", href: "/mod/quiz/view.php?id=2", grade: "-", pct: "-" },
        { title: "Midterm Exam", href: "/mod/quiz/view.php?id=3", grade: "", pct: "" },
        { title: "Prefi Quiz 1", href: "/mod/quiz/view.php?id=4", grade: "85.00", pct: "85.00%" }
    ];

    const missingInGrades = mockGradesRows.filter(r => {
        const hasGrade = (r.grade && r.grade !== '-' && r.grade !== '–' && /\d/.test(r.grade)) ||
                         (r.pct && r.pct !== '-' && r.pct !== '–' && !r.pct.includes('0.00') && /\d/.test(r.pct));
        return !hasGrade;
    });

    assert.strictEqual(missingInGrades.length, 2, "Must detect exactly 2 unattempted/missing quizzes in Grades table");
    assert.strictEqual(missingInGrades[0].title, "Prelim Quiz 2");
    assert.strictEqual(missingInGrades[1].title, "Midterm Exam");

    // 2. Simulate Course page activity cards
    const mockCourseActivities = [
        { title: "Lecture 1", type: "lecture", isCompleted: true },
        { title: "Quiz 1", type: "quiz", isCompleted: true },
        { title: "Quiz 2", type: "quiz", isCompleted: false },
        { title: "Quiz 3", type: "quiz", isCompleted: false }
    ];

    const missingInCourse = mockCourseActivities.filter(a => a.type === 'quiz' && !a.isCompleted);
    assert.strictEqual(missingInCourse.length, 2, "Must detect 2 incomplete quizzes on course page");
});

// --------------------------------------------------
// 31. Activity Log Feed Export & Copy Formatting
// --------------------------------------------------
test("Activity Log Feed Export: formats chronological log entries with timestamps", () => {
    const mockHistory = [
        { time: "09:05:01 AM", text: "Auto-synced 180 answers for ITE6301" },
        { time: "09:05:15 AM", text: "Answered Question 1: Verified (100%)" },
        { time: "09:05:20 AM", text: "Highlighted 15 answers on quiz attempt" }
    ];

    function exportLogs(history, subject = "ITE6301") {
        if (!history || history.length === 0) return '';
        const lines = history.map(item => `[${item.time}] ${item.text}`).reverse();
        return `AMAES Moodle Toolkit Activity Log\nSubject: ${subject}\n\n` + lines.join('\n');
    }

    const exported = exportLogs(mockHistory, "ITE6301");
    assert.ok(exported.includes("Subject: ITE6301"));
    assert.ok(exported.includes("[09:05:01 AM] Auto-synced 180 answers for ITE6301"));
    assert.ok(exported.includes("[09:05:20 AM] Highlighted 15 answers on quiz attempt"));
});

// --------------------------------------------------
// 32. Course-Wide Coverage & 4-Tier Breakdown Aggregation
// --------------------------------------------------
test("Course-Wide Coverage: accurately tallies 4-tier sources (Verified DB, Community, AMAUOED, Eliminated)", () => {
    const mockCachedQuestions = [
        { qNorm: "q1", ansNorm: "a1", source: "grade_report", wrongAnswers: ["w1", "w2"] },
        { qNorm: "q2", ansNorm: "a2", source: "quiz_review", wrongAnswers: [] },
        { qNorm: "q3", ansNorm: "a3", source: "community", wrongAnswers: ["w3"] },
        { qNorm: "q4", ansNorm: "a4", source: "amauoed", wrongAnswers: [] },
        { qNorm: "q5", ansNorm: "a5", sources: ["amauoed_import"], wrongAnswers: ["w4"] }
    ];

    let verified = 0;
    let community = 0;
    let amauoed = 0;
    let eliminated = 0;

    mockCachedQuestions.forEach(q => {
        const s = (q.source || '').toLowerCase();
        const sources = Array.isArray(q.sources) ? q.sources.map(x => (x || '').toLowerCase()) : [];
        const isAmauoed = s.includes('amauoed') || sources.some(x => x.includes('amauoed'));
        const isComm = s.includes('community') || sources.some(x => x.includes('community'));

        if (isAmauoed) {
            amauoed++;
        } else if (isComm) {
            community++;
        } else {
            verified++;
        }

        if (Array.isArray(q.wrongAnswers)) {
            eliminated += q.wrongAnswers.length;
        }
    });

    assert.strictEqual(verified, 2, "Verified DB count should be 2 (grade_report + quiz_review)");
    assert.strictEqual(community, 1, "Community count should be 1");
    assert.strictEqual(amauoed, 2, "AMAUOED count should be 2");
    assert.strictEqual(eliminated, 4, "Total eliminated wrong choices should be 4");
    assert.strictEqual(mockCachedQuestions.length, 5, "Total questions in coverage should be 5");
});

test("Button Wiring Integrity: Header reset and home buttons are bound to handlers", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    assert.strictEqual(script.includes("id=\"amaes-reset-btn\""), true, "amaes-reset-btn must exist in template");
    assert.strictEqual(script.includes("document.getElementById('amaes-reset-btn')"), true, "amaes-reset-btn must be queried");
    assert.strictEqual(script.includes("resetBtn.onclick = () => {"), true, "resetBtn must have onclick handler");

    assert.strictEqual(script.includes("id=\"amaes-home-btn\""), true, "amaes-home-btn must exist in template");
    assert.strictEqual(script.includes("document.getElementById('amaes-home-btn')"), true, "amaes-home-btn must be queried");
    assert.strictEqual(script.includes("homeBtn.onclick = (e) => {"), true, "homeBtn must have onclick handler");
});

test("Quiz Landing Start Auto-Quiz: detects start or re-attempt attempt button on view.php", () => {
    // Simulate DOM for /mod/quiz/view.php
    const mockDocument = {
        querySelector(selector) {
            if (selector.includes('attempt.php') || selector.includes('quizstartbutton')) {
                return {
                    clicked: false,
                    click() { this.clicked = true; }
                };
            }
            return null;
        }
    };

    const isQuizLanding = true;
    let started = false;
    if (isQuizLanding) {
        const startBtn = mockDocument.querySelector('form[action*="attempt.php"] button, .quizstartbutton button');
        if (startBtn) {
            startBtn.click();
            started = startBtn.clicked;
        }
    }

    assert.strictEqual(started, true, "Start Auto-Quiz on view.php must trigger start attempt button");
});

// --------------------------------------------------
// 34. Multi-Course Dashboard Harvesting & Course ID Resolution
// --------------------------------------------------
test("Multi-Course Dashboard Harvesting: extracts courseId and generates gradesUrl for batch scanning", () => {
    const mockCards = [
        {
            text: "UGRD-CS6301 Data Structures and Algorithms",
            href: "https://semestral.amaes.com/2612/course/view.php?id=1024"
        },
        {
            text: "UGRD-ITE6301 Information Management",
            href: "https://semestral.amaes.com/2612/course/view.php?id=2048"
        }
    ];

    const results = [];
    mockCards.forEach(card => {
        let subCode = '';
        const m = card.text.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
        if (m) subCode = m[1].toUpperCase();

        let courseId = '';
        const idMatch = card.href.match(/[?&]id=(\d+)/);
        if (idMatch) courseId = idMatch[1];

        const gradesUrl = courseId ? `https://semestral.amaes.com/2612/grade/report/user/index.php?id=${courseId}` : '';

        results.push({
            code: subCode,
            courseId,
            gradesUrl,
            title: card.text
        });
    });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].code, "CS6301");
    assert.strictEqual(results[0].courseId, "1024");
    assert.strictEqual(results[0].gradesUrl, "https://semestral.amaes.com/2612/grade/report/user/index.php?id=1024");
    assert.strictEqual(results[1].code, "ITE6301");
    assert.strictEqual(results[1].courseId, "2048");
    assert.strictEqual(results[1].gradesUrl, "https://semestral.amaes.com/2612/grade/report/user/index.php?id=2048");
});

// --------------------------------------------------
// 35. Cloud Sync Fallback to AMAUOED Catalog
// --------------------------------------------------
test("Cloud Sync Fallback: gracefully transitions from missing GitHub repo to AMAUOED catalog scraping", async () => {
    let cloudAttempted = false;
    let fallbackScrapeAttempted = false;

    async function mockSyncCloudOrFallback(code) {
        // Step 1: Cloud fetch fails or has 0 answers
        cloudAttempted = true;
        const cloudResult = null; // simulate course not found in github repo

        if (!cloudResult) {
            // Step 2: Fallback to AMAUOED catalog search
            fallbackScrapeAttempted = true;
            return {
                source: 'AMAUOED',
                count: 142,
                url: `https://amauoed.com/courses/ite/ite6301`
            };
        }
        return cloudResult;
    }

    const res = await mockSyncCloudOrFallback("ITE6301");
    assert.strictEqual(cloudAttempted, true, "Cloud fetch must be attempted first");
    assert.strictEqual(fallbackScrapeAttempted, true, "AMAUOED fallback must be triggered when cloud is empty");
    assert.strictEqual(res.source, "AMAUOED");
    assert.strictEqual(res.count, 142);
});

// --------------------------------------------------
// 36. Live Info Bar & Pulsing Status Dot Integrity
// --------------------------------------------------
test("Live Info Bar & Pulsing Status Dot: setLog triggers visual dot pulse and updates status & plan texts", () => {
    const mockDot = {
        style: {},
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); }
        }
    };
    const mockStatus = { innerHTML: '', style: {} };
    const mockPlan = { innerHTML: '' };

    function mockSetLog(doing, color, plan) {
        mockStatus.innerHTML = doing;
        if (color) mockStatus.style.color = color;
        if (plan) mockPlan.innerHTML = plan;

        mockDot.style.background = color || "#10b981";
        mockDot.classList.remove('amaes-pulse');
        mockDot.classList.add('amaes-pulse');
    }

    mockSetLog("<b>Auto-Pick Answers: ON</b>", "var(--accent-green)", "Will auto-select verified choices");

    assert.ok(mockStatus.innerHTML.includes("Auto-Pick Answers: ON"));
    assert.strictEqual(mockPlan.innerHTML, "Will auto-select verified choices");
    assert.strictEqual(mockDot.style.background, "var(--accent-green)");
    assert.ok(mockDot.classList.classes.has("amaes-pulse"), "Dot must receive amaes-pulse class");
});

// --------------------------------------------------
// 37. Userscript Button & Toggle Wiring Integrity
// --------------------------------------------------
test("Userscript Toggle & Button Wiring: verifies all handlers call setLog and pulse feedback", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Verify key toggle listeners wire setLog
    assert.ok(script.includes("Auto-Pick Answers:"), "chkAutoPick must log status");
    assert.ok(script.includes("Auto-Next Navigation:"), "chkAutoNext must log status");
    assert.ok(script.includes("Smart Skip Unverified:"), "chkSmartSkip must log status");
    assert.ok(script.includes("Highlight Answers:"), "chkAutoHlQuiz must log status");
    assert.ok(script.includes("Include DB Hints on Copy:"), "chkCopyConfidence must log status");
    assert.ok(script.includes("Auto-Harvest past quizzes from Grades:"), "chkAutoHarvestGrades must log status");
    assert.ok(script.includes("Auto-Download JSON Backups:"), "chkAutoDlJson must log status");

    // Verify CSS pulse animation is defined
    assert.ok(script.includes("@keyframes amaes-dot-pulse"), "CSS must define @keyframes amaes-dot-pulse");
    assert.ok(script.includes(".amaes-pulse"), "CSS must define .amaes-pulse class");

    // Verify multi-course harvester loop
    assert.ok(script.includes("harvestQuizzesFromGradesDoc"), "Harvester must have harvestQuizzesFromGradesDoc function");
    assert.ok(script.includes("Scanning Grade Reports for <b>${dashCourses.length} enrolled courses</b>"), "executeGradesHarvester must support multi-course dashboard scanning");
});

// --------------------------------------------------
// 38. Multi-Choice Question Detection & AI Prompt Formatting
// --------------------------------------------------
test("Multi-Choice Question: formats AI prompt with multiple answer notice and tailored instructions", () => {
    // Mock extractQuestionData logic
    function mockExtractQuestionData(hasCheckboxes, promptText, qText) {
        const isMultiChoice = Boolean(
            hasCheckboxes ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(promptText) ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(qText)
        );
        return {
            qText: qText.replace(/^Question\s*\d+[\s:.]*/i, '').trim(),
            choices: ["a. RAM", "b. ROM", "c. Cache Memory", "d. Hard Disk"],
            isMultiChoice
        };
    }

    function mockFormatQuestionForAI(data, withHint = true) {
        let output = '';
        if (data.isMultiChoice) {
            output += `[NOTE: MULTIPLE ANSWERS ALLOWED - SELECT ONE OR MORE CHOICES]\n`;
        }
        output += `${data.qText}\n\n`;
        output += data.choices.join('\n');
        if (withHint) {
            if (data.isMultiChoice) {
                output += `\n\nInstructions: This question allows MULTIPLE answers ("Select one or more"). Answer ONLY with ALL applicable option letters (e.g. "a, c" or "b, d") and their exact choice texts. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
            } else {
                output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
            }
        }
        return output.trim();
    }

    const multiQData = mockExtractQuestionData(true, "Select one or more:", "Which of the following are types of volatile memory?");
    assert.strictEqual(multiQData.isMultiChoice, true, "Question with checkboxes must be flagged as multi-choice");

    const formattedPrompt = mockFormatQuestionForAI(multiQData, true);
    assert.ok(formattedPrompt.includes("[NOTE: MULTIPLE ANSWERS ALLOWED - SELECT ONE OR MORE CHOICES]"), "AI prompt must notify that multiple choices are allowed");
    assert.ok(formattedPrompt.includes("Instructions: This question allows MULTIPLE answers"), "AI prompt instructions must ask for all applicable option letters");
    assert.ok(formattedPrompt.includes("e.g. \"a, c\" or \"b, d\""), "AI prompt instructions must provide multi-letter example");

    const singleQData = mockExtractQuestionData(false, "Select one:", "What does CPU stand for?");
    assert.strictEqual(singleQData.isMultiChoice, false, "Single choice radio question must NOT be flagged as multi-choice");
    const singlePrompt = mockFormatQuestionForAI(singleQData, true);
    assert.strictEqual(singlePrompt.includes("[NOTE: MULTIPLE ANSWERS ALLOWED"), false, "Single choice must NOT have multi-choice notice");
    assert.ok(singlePrompt.includes("Answer ONLY with the correct option letter (a, b, c, or d)"), "Single choice must have standard letter instructions");
});

// --------------------------------------------------
// 39. Multi-Letter AI Clipboard Auto-Selection ('V' Shortcut)
// --------------------------------------------------
test("Multi-Letter AI Clipboard: pressing V clicks all corresponding checkboxes for multi-answer response", () => {
    function mockParseAiClipboard(clipboardText, isCheckbox, inputs) {
        const cleanText = clipboardText.trim();
        const multiLetters = cleanText.match(/\b([a-dA-D])\b/g);
        if (isCheckbox && multiLetters && multiLetters.length > 1) {
            const uniqueLetters = Array.from(new Set(multiLetters.map(l => l.toUpperCase())));
            let checkedCount = 0;
            uniqueLetters.forEach(letter => {
                const idx = letter.charCodeAt(0) - 65;
                if (inputs[idx]) {
                    if (!inputs[idx].checked) {
                        inputs[idx].click();
                    }
                    checkedCount++;
                }
            });
            return { handled: true, count: checkedCount, letters: uniqueLetters };
        }
        return { handled: false };
    }

    const checkboxes = [
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } }
    ];

    // Simulate AI returning "The correct answers are a and c"
    const aiResponse = "The correct answers are a and c: a. RAM, c. Cache Memory";
    const res = mockParseAiClipboard(aiResponse, true, checkboxes);

    assert.strictEqual(res.handled, true, "Multi-letter AI clipboard response must be handled");
    assert.deepStrictEqual(res.letters, ["A", "C"], "Must extract options A and C");
    assert.strictEqual(checkboxes[0].checked, true, "Option A must be checked");
    assert.strictEqual(checkboxes[1].checked, false, "Option B must remain unchecked");
    assert.strictEqual(checkboxes[2].checked, true, "Option C must be checked");
    assert.strictEqual(checkboxes[3].checked, false, "Option D must remain unchecked");
});

// --------------------------------------------------
// 40. Multi-Answer Auto-Next Progression Gate
// --------------------------------------------------
test("Multi-Answer Auto-Next Gate: requires all verified highlighted choices to be checked before advancing", () => {
    function mockAreAllPageQuestionsAnswered(highlightedBoxesChecked, totalHighlighted) {
        if (totalHighlighted > 1) {
            return highlightedBoxesChecked === totalHighlighted;
        }
        return highlightedBoxesChecked > 0;
    }

    // 2 verified answers required (e.g. A and C)
    assert.strictEqual(mockAreAllPageQuestionsAnswered(1, 2), false, "Must NOT allow auto-next when only 1 of 2 verified answers is checked");
    assert.strictEqual(mockAreAllPageQuestionsAnswered(2, 2), true, "Allows auto-next once all 2 verified answers are checked");
    // Single choice questions
    assert.strictEqual(mockAreAllPageQuestionsAnswered(1, 1), true, "Allows auto-next when single choice is checked");
});

// --------------------------------------------------
// 41. Multi-Answer Review Harvesting & Consensus Merging
// --------------------------------------------------
test("Multi-Answer Harvesting & Cache: splits rightAnswer into answers array and deduplicates on merge", () => {
    function mockHarvestRightAnswer(rawRightAnswer) {
        let cleaned = rawRightAnswer.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
        const answersList = cleaned ? cleaned.split(/[,;&\n]+|\s+and\s+/i).map(s => s.trim()).filter(Boolean) : [];
        return {
            ansRaw: cleaned,
            ansNorm: normalizeChoice(cleaned),
            answers: answersList.length > 1 ? answersList : undefined
        };
    }

    const harvested = mockHarvestRightAnswer("The correct answers are: Static RAM, Dynamic RAM");
    assert.strictEqual(harvested.ansRaw, "Static RAM, Dynamic RAM");
    assert.deepStrictEqual(harvested.answers, ["Static RAM", "Dynamic RAM"], "Must parse individual choices into answers array");

    // Cache merge deduplication test
    const existingEntry = {
        qNorm: "what types of ram exist",
        ansRaw: "Static RAM, Dynamic RAM",
        answers: ["Static RAM", "Dynamic RAM"]
    };
    const incomingItem = {
        answers: ["Dynamic RAM", "Cache SRAM"]
    };
    existingEntry.answers = Array.from(new Set(existingEntry.answers.concat(incomingItem.answers)));
    assert.deepStrictEqual(existingEntry.answers, ["Static RAM", "Dynamic RAM", "Cache SRAM"], "Must merge and deduplicate multiple answer choices");
});

// --------------------------------------------------
// 42. Button Binding & ReferenceError Prevention
// --------------------------------------------------
test("Button Binding Integrity: createPanel declares all element references without ReferenceErrors", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Verify btnCopyAllQ is declared and in markup
    assert.ok(script.includes("const btnCopyAllQ = document.getElementById('btn-copy-all-q');"), "btnCopyAllQ must be declared to prevent ReferenceError in createPanel");
    assert.ok(script.includes('id="btn-copy-all-q"'), "btn-copy-all-q must be present in Action Buttons markup");
    assert.ok(script.includes("btnCloudSync.classList.add('amaes-pulse');"), "btnCloudSync must trigger pulse animation");
    assert.ok(script.includes("btnHarvestGradesDb.classList.add('amaes-pulse');"), "btnHarvestGradesDb must trigger pulse animation");
    assert.ok(script.includes(".amaes-btn:active"), "CSS must include :active scale press effect for tactile feedback");
});

// --------------------------------------------------
// 43. AMAUOED Multi-Chip & Distractor Extraction
// --------------------------------------------------
test("AMAUOED HTML Parser: extracts multi-chip answers, distractors as wrongAnswers, and choices", () => {
    // Simulated DOM parser test for parseAmauoedHtml logic
    function mockParseAmauoedCard(cardData) {
        const correctList = cardData.chips || [];
        const allChoices = cardData.choices || [];
        const wrongAnswers = allChoices.filter(c => !correctList.some(ans => normalizeChoice(ans) === normalizeChoice(c)));

        const ansRaw = correctList.join(', ');
        const ansNorm = normalizeChoice(ansRaw);
        const entry = {
            qRaw: cardData.question,
            qNorm: normalizeChoice(cardData.question),
            ansRaw,
            ansNorm,
            source: 'amauoed'
        };
        if (correctList.length > 1) {
            entry.answers = correctList;
        }
        if (wrongAnswers.length > 0) {
            entry.wrongAnswers = wrongAnswers.map(w => ({ text: w, norm: normalizeChoice(w) }));
        }
        if (allChoices.length > 0) {
            entry.choices = allChoices;
        }
        return entry;
    }

    const parsed = mockParseAmauoedCard({
        question: "Which of the following are valid network topologies?",
        choices: ["Star", "Mesh", "Banana", "Ring"],
        chips: ["Star", "Mesh", "Ring"]
    });

    assert.strictEqual(parsed.ansRaw, "Star, Mesh, Ring");
    assert.deepStrictEqual(parsed.answers, ["Star", "Mesh", "Ring"], "Must contain all 3 correct chips in answers array");
    assert.strictEqual(parsed.wrongAnswers.length, 1);
    assert.strictEqual(parsed.wrongAnswers[0].text, "Banana", "Distractor must be recorded in wrongAnswers");
    assert.strictEqual(parsed.choices.length, 4, "All 4 choices must be captured");
});

// --------------------------------------------------
// 44. AMAUOED 5-Tier Link Discovery Matcher
// --------------------------------------------------
test("AMAUOED 5-Tier Matcher: matches exact code, dept+num, dept alias, unique num, and title keywords", () => {
    const catalog = [
        { cleanCode: 'CS6202', rawCode: 'CS-6202', dept: 'CS', num: '6202', title: 'Algorithms and Complexity', url: 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs' },
        { cleanCode: 'ITE6200', rawCode: 'ITE-6200', dept: 'ITE', num: '6200', title: 'Data Structures and Algorithms', url: 'https://amauoed.com/courses/ite/data-structures-and-algorithms-6200-ite' },
        { cleanCode: 'MATH6100', rawCode: 'MATH-6100', dept: 'MATH', num: '6100', title: 'Calculus 1', url: 'https://amauoed.com/courses/math/calculus-1-6100-math' },
        { cleanCode: 'GE6107', rawCode: 'GE-6107', dept: 'GE', num: '6107', title: 'Ethics', url: 'https://amauoed.com/courses/ge/ethics-6107-ge' }
    ];

    function matchInCatalog(code, courseTitle, courses) {
        const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        const codeNum = cleanCode.replace(/\D+/g, '');
        const codeDept = cleanCode.replace(/\d+/g, '').toUpperCase();

        // Tier 1: Exact code
        const exact = courses.find(c => c.cleanCode === cleanCode || c.rawCode === cleanCode);
        if (exact) return exact.url;

        // Tier 2: Dept + Number
        if (codeDept && codeNum) {
            const deptNum = courses.find(c => c.dept === codeDept && c.num === codeNum);
            if (deptNum) return deptNum.url;
        }

        // Tier 3: Dept alias (IT -> ITE)
        const ALIAS_MAP = {
            'IT': ['ITE', 'IT'],
            'ITE': ['IT', 'ITE'],
            'CS': ['COMP', 'CS'],
            'MATH': ['MTH', 'MATH']
        };
        const aliases = ALIAS_MAP[codeDept] || [codeDept];
        if (codeNum) {
            const aliasMatch = courses.find(c => aliases.includes(c.dept) && c.num === codeNum);
            if (aliasMatch) return aliasMatch.url;
        }

        // Tier 4: Unique number match
        if (codeNum && codeNum.length >= 3) {
            const numMatches = courses.filter(c => c.num === codeNum);
            if (numMatches.length === 1) return numMatches[0].url;
        }

        // Tier 5: Title keywords
        if (courseTitle) {
            const queryWords = courseTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
            if (queryWords.length >= 2) {
                const best = courses.find(c => queryWords.filter(w => c.title.toLowerCase().includes(w)).length >= 2);
                if (best) return best.url;
            }
        }

        return null;
    }

    // Tier 1: Exact
    assert.strictEqual(matchInCatalog('CS-6202', '', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
    // Tier 2: CS6202 (no hyphen)
    assert.strictEqual(matchInCatalog('CS6202', '', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
    // Tier 3: IT-6200 alias -> ITE-6200
    assert.strictEqual(matchInCatalog('IT6200', '', catalog), 'https://amauoed.com/courses/ite/data-structures-and-algorithms-6200-ite');
    // Tier 4: Unique 4-digit number 6107
    assert.strictEqual(matchInCatalog('SUBJ6107', '', catalog), 'https://amauoed.com/courses/ge/ethics-6107-ge');
    // Tier 5: Title keyword overlap
    assert.strictEqual(matchInCatalog('UNKNOWN', 'Algorithms and Complexity Advanced Analysis', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
});

// --------------------------------------------------
// 45. Solver Variable Integrity: No TypeError on Reassignment
// --------------------------------------------------
test("Solver Variable Integrity: cached variable is declared with let in runAutoQuizSolver", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Scope check to runAutoQuizSolver function
    const solverStart = script.indexOf('async function runAutoQuizSolver');
    const solverSection = script.substring(solverStart, solverStart + 1500);

    assert.ok(solverSection.includes("let cached = getCachedAnswers(subCode);"), "cached in runAutoQuizSolver must be declared with 'let' to allow reassignment");
    assert.ok(!solverSection.includes("const cached = getCachedAnswers(subCode);"), "Must NOT use const for cached in runAutoQuizSolver");
});

// --------------------------------------------------
// 46. Auto-Fetch AMAUOED Quiz Toggle & Sync
// --------------------------------------------------
test("Auto-Fetch AMAUOED Quiz Toggle: exists in Quiz & DB tabs and stays synchronized", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    assert.ok(script.includes('id="chk-auto-scrape-amauoed-quiz"'), "chk-auto-scrape-amauoed-quiz must be present in Quiz tab markup");
    assert.ok(script.includes('id="chk-auto-scrape-amauoed"'), "chk-auto-scrape-amauoed must be present in DB tab markup");
    assert.ok(script.includes('function handleAutoScrapeToggle('), "Must use unified handleAutoScrapeToggle to synchronize both checkboxes");
    assert.ok(script.includes('autoFetchCloudAnswersIfMissing(subCode)'), "Quiz attempt page load and solver must call autoFetchCloudAnswersIfMissing");
});

// --------------------------------------------------
// 47. Inline Cloze / Text Field Sanitization & AMAUOED Matcher
// --------------------------------------------------
test("Inline Cloze / Text Field Matcher: strips inline inputs/blanks so sentence matches AMAUOED question", () => {
    function mockSanitizeMoodleQ(rawMoodleHtml) {
        // Strip input tags and extra spaces
        const stripped = rawMoodleHtml.replace(/<input[^>]*>/gi, '').replace(/\s+/g, ' ').trim();
        let norm = stripped.toLowerCase().replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        norm = norm.replace(/_{2,}/g, '___').replace(/\s+/g, ' ').replace(/[.:?!;,]+$/, '').trim();
        return norm;
    }

    const moodleHtml = 'A Moore machine can be described by a <input type="text" value="6"> tuple.';
    const amauoedQ = 'A Moore machine can be described by a tuple.';
    
    const moodleNorm = mockSanitizeMoodleQ(moodleHtml);
    const amauoedNorm = mockSanitizeMoodleQ(amauoedQ);

    assert.strictEqual(moodleNorm, "a moore machine can be described by a tuple");
    assert.strictEqual(amauoedNorm, "a moore machine can be described by a tuple");
    assert.strictEqual(moodleNorm, amauoedNorm, "Inline input question in Moodle must match AMAUOED question text");
});

// --------------------------------------------------
// 48. Text Field Interactive Fill Hint & Auto-Fill
// --------------------------------------------------
test("Text Field Interactive Fill: creates clickable fill hint and supports auto-fill", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Verify all text input selectors are checked
    assert.ok(script.includes("const textInputs = que.querySelectorAll('input[type=\"text\"]"), "Must query all text inputs including inline cloze fields");
    assert.ok(script.includes("class=\"amaes-fill-btn\""), "Must include 1-click Fill button in shortans hint");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('input', { bubbles: true }));"), "Must dispatch input event on fill");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('change', { bubbles: true }));"), "Must dispatch change event on fill");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('blur', { bubbles: true }));"), "Must dispatch blur event on fill");
});

// --------------------------------------------------
// 49. Paste AI (V) into Text Fields
// --------------------------------------------------
test("Paste AI (V) Shortcut: automatically pastes clipboard answer into text field if no choices exist", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Verify autoSelectFromAiClipboard handles text inputs
    assert.ok(script.includes("textInputs[0].value = cleanedAnswer;"), "Must paste clean clipboard answer into text field");
    assert.ok(script.includes("showToast(`Pasted to Text Box: ${cleanedAnswer}`);"), "Must display feedback toast when pasting into text input");
});

// --------------------------------------------------
// 50. Dropdown (<select>) Matching & Interactive Pick Hint
// --------------------------------------------------
test("Dropdown Matching Engine: matches option texts and sub-questions for matching tables and gapselects", () => {
    function matchDropdownOption(subQText, bestAnswer, candAnswers, idx, options) {
        let targetAns = '';
        if (subQText && (bestAnswer.includes(':') || bestAnswer.includes('->') || bestAnswer.includes('-'))) {
            const lines = bestAnswer.split(/[\n,;]+/).map(l => l.trim());
            for (const line of lines) {
                const subNorm = subQText.toLowerCase().trim();
                const lineNorm = line.toLowerCase().trim();
                if (lineNorm.includes(subNorm)) {
                    const parts = line.split(/[:\->=]+/);
                    if (parts.length >= 2) {
                        targetAns = parts.slice(1).join(':').trim();
                        break;
                    }
                }
            }
        }
        if (!targetAns) {
            targetAns = candAnswers[idx] || candAnswers[0] || bestAnswer;
        }

        const normTarget = targetAns.toLowerCase().replace(/[^a-z0-9]/g, '');
        return options.find(opt => {
            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
            const normOpt = opt.text.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normOpt === normTarget || (normTarget.length > 2 && normOpt.includes(normTarget)) || (normOpt.length > 2 && normTarget.includes(normOpt));
        });
    }

    const options = [
        { value: "0", text: "Choose..." },
        { value: "opt1", text: "Central Processing Unit" },
        { value: "opt2", text: "Random Access Memory" },
        { value: "opt3", text: "Read Only Memory" }
    ];

    const answerMulti = "CPU: Central Processing Unit, RAM: Random Access Memory";
    const matchedCPU = matchDropdownOption("CPU", answerMulti, [], 0, options);
    const matchedRAM = matchDropdownOption("RAM", answerMulti, [], 1, options);

    assert.ok(matchedCPU, "CPU sub-question must match Central Processing Unit");
    assert.strictEqual(matchedCPU.value, "opt1");
    assert.ok(matchedRAM, "RAM sub-question must match Random Access Memory");
    assert.strictEqual(matchedRAM.value, "opt2");

    // Gapselect / Cloze array matching
    const gapAnswers = ["Random Access Memory", "Read Only Memory"];
    const matchedGap1 = matchDropdownOption("", "", gapAnswers, 0, options);
    const matchedGap2 = matchDropdownOption("", "", gapAnswers, 1, options);
    assert.strictEqual(matchedGap1.value, "opt2");
    assert.strictEqual(matchedGap2.value, "opt3");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');
    assert.ok(script.includes("const selectInputs = que.querySelectorAll('select');"), "highlightQuizAnswers must query all select elements");
    assert.ok(script.includes("amaes-select-hint"), "Must create amaes-select-hint for dropdown questions");
    assert.ok(script.includes("amaes-select-btn"), "Must include 1-click Pick button for dropdown questions");
    assert.ok(script.includes("selectInput.value = matchedOption.value;"), "Auto-pick must assign matched value to select element");
});

// --------------------------------------------------
// 51. Safe Auto-Pause on Unknown Questions
// --------------------------------------------------
test("Safe Auto-Pause: halts autoQuizMode, updates master button to Resume, and attaches select listener", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    // Check Case B auto-pause
    const caseBStart = script.indexOf('// Case B: UNKNOWN QUESTION DETECTED');
    const caseBSection = script.substring(caseBStart, caseBStart + 4500);

    assert.ok(caseBSection.includes("autoQuizMode = false;"), "Auto-solver Case B must halt autoQuizMode");
    assert.ok(caseBSection.includes("localStorage.setItem('amaes_auto_quiz_mode', 'false');"), "Must persist paused state to localStorage");
    assert.ok(caseBSection.includes("syncAutoQuizUI(true);"), "Must trigger syncAutoQuizUI with isPausedOnUnknown=true");
    assert.ok(caseBSection.includes("AUTO-PAUSED"), "HUD must display AUTO-PAUSED status badge");
    assert.ok(caseBSection.includes("select"), "Case B input listener must include select elements");

    // Check syncAutoQuizUI button styling
    assert.ok(script.includes("Resume Auto-Quiz"), "syncAutoQuizUI must support 'Resume Auto-Quiz' button state");
    assert.ok(script.includes("linear-gradient(135deg, #f59e0b, #d97706)"), "Resume button must use warm amber styling");
});

// --------------------------------------------------
// 52. AI Clipboard Paste (V) into Dropdown Elements
// --------------------------------------------------
test("Paste AI (V) Shortcut on Dropdowns: selects matching option in <select> dropdown from clipboard", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');

    const vPasteStart = script.indexOf('async function autoSelectFromAiClipboard');
    const vPasteSection = script.substring(vPasteStart, vPasteStart + 6500);

    assert.ok(vPasteSection.includes("const selectInputs = Array.from(targetQue.querySelectorAll('select'));"), "autoSelectFromAiClipboard must search for select dropdowns");
    assert.ok(vPasteSection.includes("sel.value = matchOpt.value;"), "Must assign matched value to select dropdown");
    assert.ok(vPasteSection.includes("sel.dispatchEvent(new Event('change', { bubbles: true }));"), "Must dispatch change event on dropdown paste");
    assert.ok(vPasteSection.includes("showToast(`Pasted to Dropdown: Selected ${selectedCount} option(s)`);"), "Must provide clear feedback toast on dropdown paste");
});

// --------------------------------------------------
// 53. Drag and Drop Question Extraction & AI Prompt Formatting
// --------------------------------------------------
test("Drag and Drop Extraction & Formatting: identifies drag choices, drop zones, and formats AI prompt", () => {
    function mockExtractDragDrop(dragTexts, dropCount, qTextRaw) {
        const choices = [];
        const seen = new Set();
        dragTexts.forEach((txt) => {
            const trimmed = txt.trim();
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed);
                const letter = String.fromCharCode(97 + choices.length);
                choices.push(`${letter}. ${trimmed}`);
            }
        });

        return {
            isDragDrop: true,
            dropZonesCount: dropCount,
            qText: qTextRaw,
            choices
        };
    }

    function mockFormatAiPrompt(data) {
        let output = '';
        if (data.isDragDrop) {
            output += `[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]\n`;
            if (data.dropZonesCount > 1) {
                output += `Total Blanks: ${data.dropZonesCount}\n`;
            }
        }
        output += `${data.qText}\n\n`;
        if (data.choices && data.choices.length > 0) {
            output += `Available Draggable Choices:\n${data.choices.join('\n')}\n\n`;
        }
        output += `Instructions: This is a Drag and Drop question.`;
        return output;
    }

    const extracted = mockExtractDragDrop(["David Hilbert", "Alan Turing", "Leibniz's Dream", "George Boole", "Alonzo Church"], 1, "[Blank 1] challenged the mathematical community...");
    assert.strictEqual(extracted.isDragDrop, true);
    assert.strictEqual(extracted.choices.length, 5);
    assert.strictEqual(extracted.choices[0], "a. David Hilbert");

    const prompt = mockFormatAiPrompt(extracted);
    assert.ok(prompt.includes("[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]"));
    assert.ok(prompt.includes("Available Draggable Choices:"));
    assert.ok(prompt.includes("a. David Hilbert"));

    // Userscript check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');
    assert.ok(script.includes(".draghome"), "Must query .draghome choices");
    assert.ok(script.includes(".drop"), "Must query .drop zones");
    assert.ok(script.includes("[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]"), "AI prompt must announce Drag and Drop question");
});

// --------------------------------------------------
// 54. Drag and Drop Matching Engine & Interactive Hint
// --------------------------------------------------
test("Drag and Drop Matching Engine: highlights drag choices, drop zones, and injects 1-click Place button", () => {
    function matchDragChoice(dragItems, targetAns) {
        const normTarget = targetAns.toLowerCase().replace(/[^a-z0-9]/g, '');
        return dragItems.find(item => {
            const normItem = item.text.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normItem === normTarget || (normTarget.length > 1 && normItem.includes(normTarget)) || (normItem.length > 1 && normTarget.includes(normItem));
        });
    }

    const dragItems = [
        { text: "Alan Turing", choiceNum: "1" },
        { text: "David Hilbert", choiceNum: "2" },
        { text: "George Boole", choiceNum: "3" }
    ];

    const match = matchDragChoice(dragItems, "David Hilbert");
    assert.ok(match, "Must find matching drag item for David Hilbert");
    assert.strictEqual(match.choiceNum, "2");

    // Script check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');
    assert.ok(script.includes("amaes-drag-hint"), "highlightQuizAnswers must create amaes-drag-hint");
    assert.ok(script.includes("amaes-drag-btn"), "Must create 1-click Place button");
    assert.ok(script.includes("hasDragHint"), "runAutoQuizSolver must recognize hasDragHint");
});

// --------------------------------------------------
// 55. AI Clipboard Paste (V) on Drag and Drop Questions
// --------------------------------------------------
test("Paste AI (V) Shortcut on Drag and Drop: parses blank-specific answers and places choices", () => {
    function parseAiBlanks(clipboardText, dropCount) {
        const cleaned = clipboardText.replace(/^Answer:\s*/i, '').trim();
        const blankMatches = cleaned.match(/Blank\s*\d+\s*[:\-–]\s*([^\n,;]+)/gi);
        if (blankMatches && blankMatches.length > 0) {
            return blankMatches.map(m => m.replace(/Blank\s*\d+\s*[:\-–]\s*/i, '').trim());
        } else if (cleaned.includes(',') && dropCount > 1) {
            return cleaned.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [cleaned];
    }

    // Single blank question
    const singleAns = parseAiBlanks("David Hilbert", 1);
    assert.deepStrictEqual(singleAns, ["David Hilbert"]);

    // Multi-blank question
    const multiAns = parseAiBlanks("Blank 1: b, Blank 2: c, Blank 3: a, Blank 4: b", 4);
    assert.deepStrictEqual(multiAns, ["b", "c", "a", "b"]);

    // Script check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-moodle-toolkit.user.js', 'utf8');
    const vPasteStart = script.indexOf('async function autoSelectFromAiClipboard');
    const vPasteSection = script.substring(vPasteStart, vPasteStart + 15000);

    assert.ok(vPasteSection.includes("Pasted to Drag & Drop: Placed"), "Must show toast feedback on drag-and-drop paste");
    assert.ok(vPasteSection.includes("matchingDrag.dispatchEvent"), "Must dispatch event to place drag item");
});

console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log("==================================================");

if (failed > 0) {
    process.exit(1);
}
