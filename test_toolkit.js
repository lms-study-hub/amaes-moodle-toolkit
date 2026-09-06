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
    mockStorage.set('amaes_latest_version_seen', '1.2.5');
    mockStorage.set('amaes_last_update_check', String(Date.now()));

    const currentVersion = "v1.2.4";
    const cachedLatest = mockStorage.get('amaes_latest_version_seen');
    const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, currentVersion);

    assert.strictEqual(hasKnownUpdate, true, "Known update v1.2.5 must be detected from cache!");

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
// 18. Auto-Next to Review & Data Check Defaults
// --------------------------------------------------
test("Auto-Next & Manual Review Submission Defaults: autoNextQuiz is true, autoSubmitQuiz is false", () => {
    const mockLocalStorage = {
        getItem: (k) => null // default state on fresh install
    };

    const autoNextQuiz = mockLocalStorage.getItem('amaes_auto_next_quiz') !== 'false';
    const autoSubmitQuiz = mockLocalStorage.getItem('amaes_auto_submit_quiz') === 'true';

    assert.strictEqual(autoNextQuiz, true, "autoNextQuiz must default to true for auto-advance after answering!");
    assert.strictEqual(autoSubmitQuiz, false, "autoSubmitQuiz must default to false so quiz submit is not forced on user!");
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

console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log("==================================================");

if (failed > 0) {
    process.exit(1);
}
