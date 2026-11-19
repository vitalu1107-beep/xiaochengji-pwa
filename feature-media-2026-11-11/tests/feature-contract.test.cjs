const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

test('record composer exposes local image attachment controls', () => {
  assert.match(html, /id="image-input"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(main, /MAX_IMAGES_PER_RECORD|SmallWinsMedia/);
});

test('wall and review expose the confirmed interaction controls', () => {
  assert.match(html, /data-view="time"/);
  assert.match(html, /data-view="tag"/);
  assert.doesNotMatch(html, /id="btn-random-prev"/);
  assert.doesNotMatch(html, /id="btn-random-next"/);
  assert.doesNotMatch(html, /class="review-arrow/);
  assert.match(html, /id="random-position"/);
  assert.match(main, /createReviewDeck/);
});

test('review card supports touch swipes without losing the gesture', () => {
  assert.match(main, /randomCardEl\.addEventListener\("touchstart"/);
  assert.match(main, /randomCardEl\.addEventListener\("touchend"/);
  assert.match(main, /randomCardEl\.addEventListener\("pointercancel"/);
  assert.match(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /\.review-card[^}]*touch-action:\s*pan-y/);
});

test('review card exposes stacked-page animation hooks', () => {
  assert.match(html, /class="review-stack"/);
  assert.match(html, /class="review-layer review-layer-prev"/);
  assert.match(html, /class="review-layer review-layer-next"/);
  assert.match(main, /--swipe-x/);
  assert.match(main, /is-exiting-(left|right)/);
  assert.match(main, /transitionend/);
});

test('review swipe keeps the outgoing card visibly moving', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.review-content[^}]*overflow:\s*hidden/);
  assert.match(css, /--swipe-progress/);
  assert.match(css, /\.review-card\.is-flipping-left[^}]*--page-rotation:\s*-180deg/);
  assert.match(css, /\.review-card\.is-flipping-right[^}]*--page-rotation:\s*180deg/);
  assert.match(main, /--swipe-progress/);
  assert.match(main, /setTimeout\(completeRandomStep, 560\)/);
});

test('record enter inserts a newline instead of saving automatically', () => {
  assert.doesNotMatch(main, /textarea：Enter 保存/);
  assert.match(main, /event\.key === "Enter"/);
  assert.doesNotMatch(main, /event\.key === "Enter"[^\n]*saveRecord\(\)/);
});

test('mascot hooks map one cat to each page', () => {
  const hooks = [
    ['mascot-home', 'home'],
    ['mascot-record', 'record'],
    ['mascot-wall', 'wall'],
    ['mascot-review', 'review'],
    ['mascot-settings', 'settings'],
  ];

  for (const [id, page] of hooks) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, new RegExp(`id="${id}"[^>]*data-mascot-page="${page}"`));
  }

  assert.match(html, /class="energy-mark"[^>]*>[\s\S]*id="mascot-home"/);
  assert.doesNotMatch(html, /class="[^"\n]*mascot-hero/);
});

test('mascot motion states respect reduced motion', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.mascot-interactive\b/);
  for (const state of ['enter', 'peek', 'listen', 'point', 'celebrate', 'swipe-left', 'swipe-right']) {
    assert.match(css, new RegExp(`\\.mascot-state-${state}\\b`));
  }
  assert.match(css, /transition(?:-[^:]+)?:[^;]*(?:240|320|360|420|460|480)ms/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.mascot-[^{]*\{[\s\S]*transform:\s*none/);
});

test('mascot controller uses one-shot states and clears them', () => {
  assert.match(main, /const mascotElements\s*=\s*\{/);
  assert.match(main, /const mascotTimers\s*=\s*new Map\(\)/);
  assert.match(main, /const mascotLastTrigger\s*=\s*new Map\(\)/);
  assert.match(main, /const MASCOT_COOLDOWN_MS\s*=\s*1200/);
  assert.match(main, /function triggerMascot\(page, state = "enter"\)/);
  assert.match(main, /function resetMascot\(page\)/);
  assert.match(main, /function bindMascotInteractions\(\)/);
  assert.match(main, /setTimeout\(\(\) => \{[\s\S]*?resetMascot\(page\)/);
});

test('home record and wall mascot events map to real controls', () => {
  assert.match(main, /triggerMascot\(nextMascotPage,\s*"enter"\)/);
  assert.match(main, /inputTextEl\?\.addEventListener\("focus"[\s\S]*triggerMascot\("record",\s*"peek"\)/);
  assert.match(main, /inputTextEl\?\.addEventListener\("input"[\s\S]*!composing[\s\S]*triggerMascot\("record",\s*"listen"\)/);
  assert.match(main, /composeToolsBtn\?\.addEventListener\("click"[\s\S]*triggerMascot\("record",\s*"point"\)/);
  assert.match(main, /function finishSave\(\)[\s\S]*triggerMascot\("record",\s*"celebrate"\)/);
  assert.match(main, /wallSearchEl\?\.addEventListener\("input"[\s\S]*triggerMascot\("wall",\s*"listen"\)/);
  assert.match(main, /\$\$\("#wall-view-toggle \[data-view\]"\)[\s\S]*triggerMascot\("wall",\s*"peek"\)/);
  assert.match(main, /wallEmptyEl\) wallEmptyEl\.style\.display = list\.length \? "none" : "";[\s\S]*list\.length[\s\S]*triggerMascot\("wall",\s*"empty"\)/);
  assert.match(main, /compositionstart/);
  assert.match(main, /compositionend/);
});

test('review and settings mascot events follow action outcome', () => {
  assert.match(main, /function beginRandomStep\(direction\)[\s\S]*triggerMascot\("review",\s*direction > 0 \? "swipe-left" : "swipe-right"\)/);
  assert.match(main, /beginRandomStep\(delta < 0 \? 1 : -1\)/);
  assert.match(main, /function commitNicknameSetting\(\)[\s\S]*setNickname\(value\)[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
  assert.match(main, /function commitEnergySetting\(\)[\s\S]*setEnergy\(value\)[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
});

test('home energy mark keeps the mascot beside the leaf and stays compact on mobile', () => {
  assert.match(html, /<button id="energy-mark"[^>]*class="energy-mark"/);
  assert.match(html, /id="mascot-home"[^>]*data-mascot-page="home"/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.energy-mark\s*\{[^}]*width:\s*96px/);
  assert.match(css, /\.mascot-inline\s*\{[^}]*left:\s*10px/);
  assert.match(css, /\.energy-mark::before\s*\{[^}]*left:\s*-8px/);
  assert.match(css, /\.energy-quote\s*\{[^}]*font-size:\s*clamp\(23px,\s*5\.8vw,\s*29px\)/);
});

test('home energy mark has an obvious native tap interaction', () => {
  assert.match(main, /const celebrateHome = \(\) => \{[\s\S]*triggerMascot\("home",\s*"celebrate"\)/);
  assert.match(main, /energyMarkEl\?\.addEventListener\("click", celebrateHome\)/);
  assert.match(main, /energyMarkEl\?\.addEventListener\("keydown"/);
});

test('review page uses a real 3D page-turn with a back face', () => {
  assert.match(html, /class="[^"]*review-card-front/);
  assert.match(html, /class="[^"]*review-card-back/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.review-stack\s*\{[^}]*perspective:\s*900px/);
  assert.match(css, /\.review-card\s*\{[^}]*transform-style:\s*preserve-3d/);
  assert.match(css, /\.review-card-back\s*\{[^}]*backface-visibility:\s*hidden/);
  assert.match(css, /\.review-card-back\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.review-card\.is-flipping-left[^}]*--page-rotation:\s*-180deg/);
  assert.match(css, /\.review-card\.is-flipping-right[^}]*--page-rotation:\s*180deg/);
  assert.match(main, /reviewPendingDirection[\s\S]*is-flipping-(left|right)/);
});

test('review media cards tighten the image-to-text rhythm and use the swapped page palette', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(main, /randomCardEl\?\.classList\.toggle\("has-media"[\s\S]*mediaIds/);
  assert.match(css, /#page-random\s*\{[^}]*--review-bg:\s*#f7faf7/);
  assert.match(css, /#page-random[^}]*background:\s*linear-gradient/);
});

test('review swaps the page and card color surfaces', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /#page-random\s*\{[^}]*--review-bg:\s*#f7faf7/);
  assert.match(css, /#page-random\s*\{[^}]*--review-surface:\s*#d9edd8/);
  assert.match(css, /#page-random\s*\{[^}]*--review-glass:\s*rgba\(217,\s*237,\s*216,\s*\.82\)/);
  assert.match(css, /#page-random[^}]*background:\s*linear-gradient\(180deg, #f8fbf8 0%, #eef7ef 100%\)/);
  assert.match(css, /#page-random \.review-position[^}]*background:\s*rgba\(210,\s*237,\s*211,\s*\.64\)/);
});

test('review card supports tap-to-flip current record details without stealing swipes', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(main, /function toggleReviewFlip\(\)/);
  assert.match(main, /randomCardEl\?\.classList\.toggle\("is-card-flipped"/);
  assert.match(main, /randomCardEl\.addEventListener\("click"/);
  assert.match(main, /reviewTapSuppressed/);
  assert.match(main, /const id = reviewDeck\.next\(\)/);
  assert.match(main, /renderReviewFace\(isFlipped \? "front" : "back", next\)/);
  assert.match(css, /--card-flip:\s*0deg/);
  assert.match(css, /\.review-card\.is-card-flipped[^}]*--card-flip:\s*180deg/);
  assert.match(css, /backdrop-filter:\s*blur\(18px\)/);
  assert.match(css, /prefers-reduced-motion:[\s\S]*--card-flip:\s*0deg/);
});

test('review flip keeps the inner card plane separate from swipe page rotation', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(html, /class="review-card-inner"/);
  assert.match(css, /\.review-card-inner\s*\{[^}]*transform-style:\s*preserve-3d/);
  assert.match(css, /\.review-card-inner\s*\{[^}]*transform:\s*rotateY\(var\(--card-flip\)\)/);
  assert.match(css, /\.review-card\s*\{[^}]*rotateY\(var\(--page-rotation\)\)/);
});

test('review flip keeps reset state overridable and preserves the back details', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(main, /function resetReviewMotion\(\)[\s\S]*removeProperty\("--card-flip"\)/);
  assert.match(main, /function showRandomRecord\(record\)[\s\S]*if \(!record\)[\s\S]*resetReviewMotion\(\)/);
  assert.match(main, /function renderReviewFace\(face, record\)/);
  assert.match(main, /const id = reviewDeck\.next\(\)/);
  assert.match(main, /renderReviewFace\(isFlipped \? "front" : "back", next\)/);
  assert.match(html, /<section id="random-card"[\s\S]*?<div class="review-card-inner"/);
  assert.match(html, /<div class="review-card-inner"[\s\S]*review-card-front/);
  assert.match(html, /id="random-back-media"/);
  assert.doesNotMatch(css, /\.review-card-back::before/);
  assert.doesNotMatch(css, /这件小成就/);
  assert.doesNotMatch(html, /class="review-card-front"[\s\S]*?id="btn-random-prev"/);
  assert.doesNotMatch(html, /class="review-card-front"[\s\S]*?id="btn-random-next"/);
  assert.match(css, /\.review-card\.is-card-flipped \.review-card-back\s*\{[^}]*visibility:\s*visible/);
  assert.match(css, /@supports not \(backdrop-filter:\s*blur\(18px\)\)/);
});

test('achievement detail keeps one close affordance and enters edit from the content', () => {
  assert.match(html, /id="modal"[\s\S]*aria-label="关闭详情"/);
  assert.doesNotMatch(html, /id="modal-edit"/);
  assert.doesNotMatch(html, /class="modal-actions"/);
  assert.match(main, /function openModal\(record[\s\S]*modalBodyEl[\s\S]*beginEdit\(record\)/);
});

test('record composer uses a more inviting small-win prompt', () => {
  assert.match(html, /placeholder="今天，哪一刻值得为自己点个赞？"/);
});

test('settings fields save inline without redundant check buttons', () => {
  assert.doesNotMatch(html, /id="btn-save-nickname"/);
  assert.doesNotMatch(html, /id="btn-save-energy"/);
  assert.match(main, /function commitNicknameSetting\(\)/);
  assert.match(main, /function commitEnergySetting\(\)/);
  assert.match(main, /function bindSettingField\(input, commit\)[\s\S]*input\?\.addEventListener\("blur", commit\)/);
  assert.match(main, /bindSettingField\(nicknameInput, commitNicknameSetting\)/);
  assert.match(main, /bindSettingField\(energyInput, commitEnergySetting\)/);
});

test('pages avoid redundant explanatory copy and let layout carry the hierarchy', () => {
  assert.doesNotMatch(html, /class="page-subtitle"/);
  assert.doesNotMatch(html, /class="energy-caption"/);
  assert.doesNotMatch(html, /class="review-hint"/);
  assert.doesNotMatch(html, /class="review-shuffle"/);
  assert.doesNotMatch(html, /class="privacy-note"/);
  assert.doesNotMatch(html, /class="settings-preview"/);
  assert.doesNotMatch(html, /id="install-tip"/);
  assert.doesNotMatch(html, /class="modal-edit-hint"/);
  assert.match(html, /id="random-position"/);
});

test('home uses a layered warm hero instead of a flat text sheet', () => {
  assert.match(html, /class="energy-scene"/);
  assert.match(html, /class="energy-leaf"/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.energy-hero\s*\{[^}]*border-radius:\s*22px/);
  assert.match(css, /\.energy-mark\s*\{[^}]*width:\s*96px/);
  assert.match(css, /\.stat-inline\s*\{[^}]*background:\s*var\(--surface\)/);
});

test('home removes the redundant brand block and restores breathing room', () => {
  assert.match(html, /<main id="page-home"[^>]*aria-labelledby="home-heading"/);
  assert.match(html, /<h1 id="home-heading" class="sr-only">小成就<\/h1>/);
  assert.doesNotMatch(html, /class="brand-lockup"/);
  assert.doesNotMatch(html, /<p>Small Wins<\/p>/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.home-greeting-block\s*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(css, /\.home-greeting-block\s*\{[^}]*border-bottom:/);
  assert.match(css, /\.stats-line\s*\{[^}]*margin:\s*0/);
});

test('home recent achievements get a distinct card hierarchy and balanced spacing', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /#recent-heading\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(css, /#recent-heading\s*\{[^}]*font-weight:\s*720/);
  assert.match(css, /\.recent-list\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.recent-list\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.recent-list\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /\.recent-list \.item\s*\{[^}]*background:\s*var\(--surface\)/);
  assert.match(css, /\.recent-list \.item\s*\{[^}]*border-radius:\s*22px/);
  assert.match(css, /\.recent-section\s*\{[^}]*padding-top:\s*8px/);
});

test('review typography stays compact and metadata is rendered as light chips', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.review-text\s*\{[^}]*font-family:\s*var\(--ui-font\)[^}]*font-size:\s*18px[^}]*font-weight:\s*400/);
  assert.match(css, /\.review-mood\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.review-chip\s*\{[^}]*border-radius:\s*999px/);
  assert.doesNotMatch(css, /\.review-chip\s*\{[^}]*font-size:\s*0/);
  assert.match(css, /\.review-chip\s*\{[^}]*font-size:\s*13px/);
  assert.doesNotMatch(css, /\.review-chip::before/);
  assert.match(main, /function renderReviewMeta\(container, record\)/);
  assert.match(main, /className = `review-chip review-chip-\$\{kind\}`/);
  assert.match(main, /chip\.textContent = value/);
  assert.match(main, /chip\.setAttribute\("aria-label"/);
  assert.match(main, /const seen = new Set\(\)/);
  assert.match(main, /seen\.has\(normalized\)/);
});

test('home uses one compact sans hierarchy and an even vertical rhythm', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /--ui-font:\s*-apple-system/);
  assert.match(css, /\.home-greeting\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(css, /\.home-greeting-block\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.energy-quote\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(css, /\.home-content \.section-title\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(css, /\.stats-line\s*\{[^}]*margin:\s*0/);
  assert.match(css, /\.recent-section\s*\{[^}]*padding-top:\s*8px/);
});

test('home uses a unified bento grid for primary, metric, and recent cards', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(html, /class="home-bento"/);
  assert.match(css, /\.home-bento\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.stats-line\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.stat-inline\s*\{[^}]*border-radius:\s*22px/);
  assert.match(css, /\.recent-list\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.recent-list\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.recent-list \.item\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.recent-list \.item\s*\{[^}]*border-radius:\s*22px/);
});

test('review navigation relies on swipe and card flip without overlay arrows', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.doesNotMatch(css, /\.review-arrow\s*\{/);
  assert.match(main, /randomCardEl\.addEventListener\("touchstart"/);
  assert.match(main, /function toggleReviewFlip\(\)/);
});

test('modal close handles clicks on the nested close icon', () => {
  assert.match(main, /modalEl\?\.addEventListener\("click", \(event\) => \{[^}]*closest/);
  assert.match(main, /\[data-close=\\"1\\"\]/);
});
