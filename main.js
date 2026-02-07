console.log("✅ main.js running");
// ===============================
// Small Wins - main.js (clean full version)
// Features:
// - Record wins (localStorage)
// - Tabs/pages navigation
// - Today/Yesterday/History grouped view
// - History groups: default expand latest 3 dates (excluding today/yesterday already shown separately)
// - Wall: search + multi-tag (chips) filter (AND logic)
// - Chips: toggle highlight + filter
// - Delete: confirm to avoid mis-touch
// - Clear today / reset all confirm
// - Random review modal
// - Export to clipboard
// ===============================

// ====== DOM ======
const tabs = document.querySelectorAll(".tab");
const pages = {
  home: document.getElementById("page-home"),
  today: document.getElementById("page-today"),
  wall: document.getElementById("page-wall"),
  settings: document.getElementById("page-settings"),
};

const inputEl = document.getElementById("achievementInput");
const tagBtn = document.getElementById("tagBtn");
const tagMenuEl = document.getElementById("tagMenu");
const addBtn = document.getElementById("addBtn");
const quickTagsEl = document.getElementById("quickTags");

const statTodayEl = document.getElementById("statToday");
const statAllEl = document.getElementById("statAll");
const recentListEl = document.getElementById("recentList");
const recentEmptyEl = document.getElementById("recentEmpty");
const goTodayBtn = document.getElementById("goTodayBtn");
const goWallBtn = document.getElementById("goWallBtn");

const todayListEl = document.getElementById("todayList");
const todayEmptyEl = document.getElementById("todayEmpty");
const clearTodayBtn = document.getElementById("clearTodayBtn");

const yesterdayListEl = document.getElementById("yesterdayList");
const yesterdayEmptyEl = document.getElementById("yesterdayEmpty");

const historyWrapEl = document.getElementById("historyWrap");
const historyEmptyEl = document.getElementById("historyEmpty");

const searchInputEl = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchMetaEl = document.getElementById("searchMeta");
const wallListEl = document.getElementById("wallList");
const wallEmptyEl = document.getElementById("wallEmpty");

// Chips (tag buttons) - may exist only on wall page
// IMPORTANT: chips might not be ready at script parse time if you render them dynamically.
// Here they are in HTML, so it's safe.
const chipButtons = Array.from(document.querySelectorAll(".chip"));

// Only ONE selectedChips in entire file
const selectedChips = new Set(); // multi-select tags

const randomBtn = document.getElementById("randomBtn");

const modalEl = document.getElementById("modal");
const modalMaskEl = document.getElementById("modalMask");
const modalContentEl = document.getElementById("modalContent");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalAgainBtn = document.getElementById("modalAgainBtn");

const exportBtn = document.getElementById("exportBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const toastEl = document.getElementById("toast");

// ====== Storage ======
const STORAGE_KEY = "smallWins_v2"; // array of items: {id, text, date, createdAt}
let items = loadItems();

// ====== Date helpers ======
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  return toDateStr(new Date());
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}
function formatCN(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}月${d}日`;
}

// ====== CRUD ======
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function addItem(text) {
  const now = Date.now();
  const item = {
    id: String(now) + "_" + Math.random().toString(16).slice(2),
    text,
    date: todayStr(),
    createdAt: now,
  };
  items.unshift(item);
  saveItems();
}
function deleteItem(id) {
  items = items.filter((x) => x.id !== id);
  saveItems();
}
function clearToday() {
  const t = todayStr();
  items = items.filter((x) => x.date !== t);
  saveItems();
}

// ====== UI helpers ======

function extractTagsFromText(text) {
  const s = String(text || "");
  const matches = s.match(/#([\u4e00-\u9fa5A-Za-z0-9_]+)/g) || [];
  return matches.map(t => t.slice(1)); // 去掉 #
}

function getTopTags(limit = 50) {
  const count = new Map();
  items.forEach(it => {
    extractTagsFromText(it.text).forEach(tag => {
      count.set(tag, (count.get(tag) || 0) + 1);
    });
  });
  return [...count.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function insertTagToInput(tag) {
  if (!inputEl) return;
  const raw = String(inputEl.value || "");
  const token = `#${tag}`;

  // 已包含就不重复插入
  if (raw.includes(token)) {
    inputEl.focus();
    return;
  }

  const needSpace = raw.length > 0 && !/\s$/.test(raw);
  inputEl.value = raw + (needSpace ? " " : "") + token + " ";
  inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
}

function openTagMenu() {
  if (!tagMenuEl) return;

  const tags = getTopTags(50);
  tagMenuEl.innerHTML = "";

  if (tags.length === 0) {
    tagMenuEl.classList.add("hidden");
    return;
  }

  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-item";
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      insertTagToInput(tag);
      closeTagMenu();
    });
    tagMenuEl.appendChild(btn);
  });

  tagMenuEl.classList.remove("hidden");
}

function closeTagMenu() {
  tagMenuEl?.classList.add("hidden");
}

// 渲染首页快捷标签（#xxx 一键插入）
function renderQuickTags() {
  if (!quickTagsEl) return;

  const tags = getTopTags(8);
  quickTagsEl.innerHTML = "";

  if (!tags || tags.length === 0) return;

  tags.forEach((tag) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip"; // 复用 chip 样式（不带 data-chip）
  btn.textContent = `#${tag}`;

  btn.addEventListener("click", () => {
    insertTagToInput(tag);
    quickTagsEl?.classList.add("hidden"); // 选完就收起
  });

  quickTagsEl.appendChild(btn);
});
  
// ====== Tag menu helpers (# 弹出选择) ======
function extractTagsFromText(text) {
  const s = String(text || "");
  // 支持：#生活 #work #复盘_01
  const matches = s.match(/#([\u4e00-\u9fa5A-Za-z0-9_]+)/g) || [];
  return matches.map((t) => t.slice(1)); // 去掉 #
}

function getTopTags(limit = 20) {
  const count = new Map();
  items.forEach((it) => {
    extractTagsFromText(it.text).forEach((tag) => {
      const key = String(tag).trim();
      if (!key) return;
      count.set(key, (count.get(key) || 0) + 1);
    });
  });

  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function insertTagToInput(tag) {
  if (!inputEl) return;

  const raw = String(inputEl.value || "");
  const token = `#${tag}`;

  // 如果光标在中间，也能插入
  const start = inputEl.selectionStart ?? raw.length;
  const end = inputEl.selectionEnd ?? raw.length;

  // 避免重复插入同一个标签（你想允许重复就删掉这一段）
  if (raw.includes(token)) {
    inputEl.focus();
    return;
  }

  const before = raw.slice(0, start);
  const after = raw.slice(end);

  const needSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needSpaceAfter = after.length > 0 && !/^\s/.test(after);

  const next =
    before +
    (needSpaceBefore ? " " : "") +
    token +
    " " +
    (needSpaceAfter ? " " : "") +
    after;

  inputEl.value = next;
  inputEl.focus();
  inputEl.setSelectionRange(
    (before + (needSpaceBefore ? " " : "") + token + " ").length,
    (before + (needSpaceBefore ? " " : "") + token + " ").length
  );
}

function renderTagMenu() {
  if (!tagMenuEl) return;

  const tags = getTopTags(20);
  tagMenuEl.innerHTML = "";

  if (tags.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.style.padding = "10px 12px";
    empty.textContent = "还没有标签，先在记录里写 #生活 这种～";
    tagMenuEl.appendChild(empty);
    return;
  }

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-item";
    btn.textContent = tag; // 显示“生活”，不带#
    btn.addEventListener("click", () => {
      insertTagToInput(tag);
      closeTagMenu();
    });
    tagMenuEl.appendChild(btn);
  });
}

function openTagMenu() {
  if (!tagMenuEl) return;
  renderTagMenu();
  tagMenuEl.classList.remove("hidden");
}

function closeTagMenu() {
  if (!tagMenuEl) return;
  tagMenuEl.classList.add("hidden");
}

function toggleTagMenu() {
  if (!tagMenuEl) return;
  const isHidden = tagMenuEl.classList.contains("hidden");
  if (isHidden) openTagMenu();
  else closeTagMenu();
}               
               
function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 1200);
}

function setActiveTab(pageKey) {
  tabs.forEach((b) => {
    const p = b.dataset.page;
    if (!p) return;
    b.classList.toggle("active", p === pageKey);
  });
}

function showPage(pageKey) {
  Object.keys(pages).forEach((k) => {
    const el = pages[k];
    if (!el) return;
    el.classList.toggle("hidden", k !== pageKey);
  });
  setActiveTab(pageKey);

  if (pageKey === "home") renderHome();
  if (pageKey === "today") renderToday();
  if (pageKey === "wall") renderWall();
}

function elItemRow(item, withDate = false) {
  const li = document.createElement("li");
  li.className = "item";

  const left = document.createElement("div");
  left.className = "item-text";
  left.textContent = "✓ " + (item.text || "");

  if (withDate) {
    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = item.date + " · " + formatCN(item.date);
    left.appendChild(meta);
  }

  const del = document.createElement("button");
  del.className = "del";
  del.type = "button";
  del.textContent = "删除";

  // 防误触：二次确认
  del.addEventListener("click", () => {
    const ok = confirm("确定删除这一条小成就吗？");
    if (!ok) return;

    deleteItem(item.id);
    renderAll();
    renderQuickTags(); // ✅ 删除后刷新快捷标签
    showToast("已删除");
  });

  li.appendChild(left);
  li.appendChild(del);
  return li;
}

function renderList(listEl, data, emptyEl) {
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!data || data.length === 0) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  data.forEach((it) => listEl.appendChild(elItemRow(it)));
}

// ✅ 只同步“成就墙过滤标签”的激活态（必须带 data-chip）
function syncChipUI() {
  document.querySelectorAll(".chip[data-chip]").forEach((btn) => {
    const key = btn.dataset.chip || "";
    btn.classList.toggle("active", key && selectedChips.has(key));
  });
}

// ====== Render ======
function renderHome() {
  const t = todayStr();
  const todayItems = items.filter((x) => x.date === t);

  if (statTodayEl) statTodayEl.textContent = String(todayItems.length);
  if (statAllEl) statAllEl.textContent = String(items.length);

  // 最近 6 条
  const recent = items.slice(0, 6);
  if (recentListEl) recentListEl.innerHTML = "";

  if (!recent || recent.length === 0) {
    if (recentEmptyEl) recentEmptyEl.classList.remove("hidden");
  } else {
    if (recentEmptyEl) recentEmptyEl.classList.add("hidden");
    recent.forEach((it) => recentListEl.appendChild(elItemRow(it, true)));
  }
}

function renderToday() {
  const t = todayStr();
  const y = yesterdayStr();

  const todayItems = items.filter((x) => x.date === t);
  const yItems = items.filter((x) => x.date === y);

  renderList(todayListEl, todayItems, todayEmptyEl);
  renderList(yesterdayListEl, yItems, yesterdayEmptyEl);

  // 历史：排除今天/昨天，按 date 分组（倒序）
  const historyItems = items.filter((x) => x.date !== t && x.date !== y);

  const byDate = {};
  historyItems.forEach((it) => {
    (byDate[it.date] ||= []).push(it);
  });

  const dates = Object.keys(byDate).sort().reverse();

  if (historyWrapEl) historyWrapEl.innerHTML = "";
  if (!dates || dates.length === 0) {
    if (historyEmptyEl) historyEmptyEl.classList.remove("hidden");
    return;
  }
  if (historyEmptyEl) historyEmptyEl.classList.add("hidden");

  // 默认展开最近 3 个历史日期组（注意：这里的历史不含今天/昨天）
  const DEFAULT_OPEN = 3;

  dates.forEach((dateStr, idx) => {
    const group = document.createElement("div");
    group.className = "group";

    const head = document.createElement("div");
    head.className = "group-head";

    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = `${dateStr} · ${formatCN(dateStr)}（${byDate[dateStr].length}）`;

    const caret = document.createElement("div");
    caret.className = "muted small";

    const body = document.createElement("div");
    body.className = "group-body";

    const shouldOpen = idx < DEFAULT_OPEN;
    if (!shouldOpen) body.classList.add("hidden");
    caret.textContent = shouldOpen ? "收起" : "展开";

    const ul = document.createElement("ul");
    ul.className = "list";
    byDate[dateStr].forEach((it) => ul.appendChild(elItemRow(it)));
    body.appendChild(ul);

    head.appendChild(title);
    head.appendChild(caret);

    head.addEventListener("click", () => {
      const hidden = body.classList.toggle("hidden");
      caret.textContent = hidden ? "展开" : "收起";
    });

    group.appendChild(head);
    group.appendChild(body);
    historyWrapEl.appendChild(group);
  });
}

function renderWall() {
  const q = (searchInputEl?.value || "").trim().toLowerCase();
  const chips = Array.from(selectedChips).map((x) => String(x).toLowerCase());

  const data = items.filter((it) => {
    const text = String(it.text || "").toLowerCase();
    const tags = extractTags(it.text); // ✅ 新增：从文本解析 #标签（已经是小写）
    const matchQuery = q ? text.includes(q) : true;
    const matchChips = chips.length === 0 ? true : chips.every((c) => tags.includes(c));
    return matchQuery && matchChips;
  });

  if (searchMetaEl) {
    const chipText = chips.length ? `标签：${Array.from(selectedChips).join(" + ")}` : "标签：无";
    const queryText = q ? `搜索：「${q}」` : "搜索：无";
    searchMetaEl.textContent = `${chipText} ｜ ${queryText} ｜ 结果 ${data.length} / 总共 ${items.length}`;
  }

  if (wallListEl) wallListEl.innerHTML = "";
  if (!data || data.length === 0) {
    if (wallEmptyEl) wallEmptyEl.classList.remove("hidden");
    return;
  }
  if (wallEmptyEl) wallEmptyEl.classList.add("hidden");
  data.forEach((it) => wallListEl.appendChild(elItemRow(it, true)));
}

function renderAll() {
  if (pages.home && !pages.home.classList.contains("hidden")) renderHome();
  if (pages.today && !pages.today.classList.contains("hidden")) renderToday();
  if (pages.wall && !pages.wall.classList.contains("hidden")) renderWall();
}

// ====== Random Review ======
function openModal(text) {
  if (!modalContentEl || !modalEl) return;
  modalContentEl.textContent = text;
  modalEl.classList.remove("hidden");
}
function closeModal() {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
}
function pickRandom() {
  if (!items || items.length === 0) {
    showToast("还没有历史可以回顾～");
    return;
  }
  const r = items[Math.floor(Math.random() * items.length)];
  openModal(`「${r.text}」\n\n来自：${r.date} · ${formatCN(r.date)}`);
}

// ====== Events ======
// Tabs
tabs.forEach((btn) => {
  const page = btn.dataset.page;
  if (!page) return;
  btn.addEventListener("click", () => showPage(page));
});

if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));

// Add
if (addBtn) {
  addBtn.addEventListener("click", () => {
    const v = (inputEl?.value || "").trim();
    if (!v) {
      showToast("先写点内容～");
      inputEl?.focus?.();
      return;
    }
    addItem(v);
    
if (tagMenuEl && !tagMenuEl.classList.contains("hidden")) {
  renderTagMenu();
}

if (inputEl) inputEl.value = "";
renderAll();
inputEl?.focus?.();
showToast("已记录 ✅");

  });
}

// Enter submit (Shift+Enter for newline if you later use textarea)
if (inputEl) {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBtn?.click?.();
    }
  });
}

// # 标签按钮：打开/关闭
if (tagBtn) {
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // ✅ 防止立刻被 document click 关掉
    toggleTagMenu();
  });
}

// 点击空白处关闭菜单
document.addEventListener("click", (e) => {
  if (!tagMenuEl) return;
  const inMenu = tagMenuEl.contains(e.target);
  const inBtn = tagBtn && tagBtn.contains(e.target);
  if (!inMenu && !inBtn) closeTagMenu();
});

// ESC 关闭
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeTagMenu();
});

// Clear today
if (clearTodayBtn) {
  clearTodayBtn.addEventListener("click", () => {
    const tCount = items.filter((x) => x.date === todayStr()).length;
    if (tCount === 0) return;
    const ok = confirm("确定清空今天的所有小成就吗？");
    if (!ok) return;
    clearToday();
    renderAll();
    showToast("已清空今天");
  });
}

// Wall search
if (searchInputEl) {
  searchInputEl.addEventListener("input", () => renderWall());
}
if (searchClearBtn) {
  searchClearBtn.addEventListener("click", () => {
    if (searchInputEl) searchInputEl.value = "";
    selectedChips.clear();
    syncChipUI();
    renderWall();
    searchInputEl?.focus?.();
  });
}

// Chips click (multi-select)
if (chipButtons && chipButtons.length) {
  chipButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.chip || "";
      if (!key) return;

      if (selectedChips.has(key)) selectedChips.delete(key);
      else selectedChips.add(key);

      syncChipUI();
      showPage("wall"); // ensure user sees results
      renderWall();
    });
  });
}

// Random review
if (randomBtn) randomBtn.addEventListener("click", () => pickRandom());
if (modalMaskEl) modalMaskEl.addEventListener("click", closeModal);
if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (modalAgainBtn) modalAgainBtn.addEventListener("click", () => pickRandom());

// Export
if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    if (!items || items.length === 0) {
      showToast("没有数据可导出");
      return;
    }
    const lines = items
      .slice()
      .reverse()
      .map((it) => `${it.date} - ${it.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      showToast("已复制到剪贴板");
    } catch {
      alert(lines);
    }
  });
}

// Reset all
if (resetAllBtn) {
  resetAllBtn.addEventListener("click", () => {
    if (!items || items.length === 0) return;
    const ok = confirm("确定清空全部历史数据吗？此操作不可恢复。");
    if (!ok) return;
    items = [];
    saveItems();
    renderAll();
    showToast("已清空全部");
    renderQuickTags();
  });
}

function toggleQuickTags() {
  if (!quickTagsEl) return;
  renderQuickTags();                 // 每次打开都刷新
  quickTagsEl.classList.toggle("hidden");
}

// 点 # 开/关
tagBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleQuickTags();
});

// 点空白处关闭
document.addEventListener("click", () => {
  if (!quickTagsEl) return;
  quickTagsEl.classList.add("hidden");
});

// 点菜单内部不触发关闭
quickTagsEl?.addEventListener("click", (e) => {
  e.stopPropagation();
});


// ====== Init ======
syncChipUI();
showPage("home");
inputEl?.focus?.();
renderAll();
renderQuickTags();
openTagMenu(); 
closeTagMenu(); // 让标签统计刷新
