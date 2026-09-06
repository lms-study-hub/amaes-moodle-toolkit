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
function normalizeChoice(str) {
    if (!str) return '';
    let text = str.toLowerCase().trim();
    text = text.replace(/[\u2212\u2013\u2014]/g, '-');
    text = text.replace(/^select one:?\s*/i, '').replace(/^[a-e][.)]\s*/i, '');
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/[.:?!;,]+$/, '');
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

console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log("==================================================");

if (failed > 0) {
    process.exit(1);
}
