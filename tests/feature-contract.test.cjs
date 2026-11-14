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
  assert.match(html, /id="btn-random-prev"/);
  assert.match(html, /id="btn-random-next"/);
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
  assert.match(css, /\.energy-hero\s*\{[^}]*min-height:\s*282px/);
  assert.match(css, /\.energy-quote\s*\{[^}]*font-size:\s*clamp\(25px,\s*6\.5vw,\s*34px\)/);
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

test('achievement detail keeps one close affordance and enters edit from the content', () => {
  assert.match(html, /id="modal"[\s\S]*aria-label="关闭详情"/);
  assert.doesNotMatch(html, /id="modal-edit"/);
  assert.doesNotMatch(html, /class="modal-actions"/);
  assert.match(main, /function openModal\(record\)[\s\S]*modalBodyEl[\s\S]*beginEdit\(record\)/);
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

test('home uses a layered warm hero instead of a flat text sheet', () => {
  assert.match(html, /class="energy-scene"/);
  assert.match(html, /class="energy-leaf"/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.energy-hero\s*\{[^}]*border-radius:\s*28px/);
  assert.match(css, /\.energy-mark\s*\{[^}]*width:\s*96px/);
  assert.match(css, /\.stats-line\s*\{[^}]*background:\s*var\(--surface\)/);
});
