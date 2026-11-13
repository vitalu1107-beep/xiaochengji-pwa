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
  assert.match(css, /\.review-card\.is-exiting-left[^}]*transition-duration:\s*460ms/);
  assert.match(css, /\.review-card\.is-exiting-left[^}]*--swipe-x:\s*-118%/);
  assert.match(css, /\.review-card\.is-exiting-right[^}]*--swipe-x:\s*118%/);
  assert.match(main, /--swipe-progress/);
  assert.match(main, /setTimeout\(completeExit, 520\)/);
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
  assert.match(main, /function animateRandomStep\(direction\)[\s\S]*triggerMascot\("review",\s*direction > 0 \? "swipe-left" : "swipe-right"\)/);
  assert.match(main, /reviewPendingDirection = delta < 0 \? 1 : -1;[\s\S]*triggerMascot\("review",\s*reviewPendingDirection > 0 \? "swipe-left" : "swipe-right"\)/);
  assert.match(main, /if \(setNickname\(value\)\) \{[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
  assert.match(main, /if \(setEnergy\(value\)\) \{[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
  assert.match(main, /setNickname\(value\)\) \{[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
  assert.match(main, /setEnergy\(value\)\) \{[\s\S]*triggerMascot\("settings",\s*"celebrate"\)/);
});
