// ====== DOM ======
const tabs = document.querySelectorAll(".tab");
const pages = {
  home: document.getElementById("page-home"),
  today: document.getElementById("page-today"),
  wall: document.getElementById("page-wall"),
  settings: document.getElementById("page-settings"),
};

const inputEl = document.getElementById("achievementInput");
const addBtn = document.getElementById("addBtn");

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

// ====== Chips filter state (multi-select) ======
const selectedChips = new Set(); // e.g. "阅读", "复盘"

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
const STORAGE_KEY = "smallWins_v2";
let items = loadItems(); // {id, text, date, createdAt}

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
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 1200);
}

function syncChipUI() {
  document.querySelectorAll(".chip").forEach((btn) => {
    const key = btn.dataset.chip || "";
    btn.classList.toggle("active", key && selectedChips.has(key));
  });
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
    pages[k].classList.toggle("hidden", k !== pageKey);
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
  left.textContent = "✓ " + item.text;

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

  // ✅ 防误触：单条删除二次确认
  del.addEventListener("click", () => {
    const ok = confirm("确定删除这一条小成就吗？");
    if (!ok) return;

    deleteItem(item.id);
    renderAll();
    showToast("已删除");
  });

  li.appendChild(left);
  li.appendChild(del);
  return li;
}

function renderList(listEl, data, emptyEl) {
  listEl.innerHTML = "";
  if (data.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  data.forEach((it) => listEl.appendChild(elItemRow(it)));
}

// ✅ 你缺的就是这个：同步 Chip 高亮
function syncChipUI() {
  const chips = document.querySelectorAll(".chip");
  chips.forEach((btn) => {
    const key = btn.dataset.chip || "";
    btn.classList.toggle("active", key && selectedChips.has(key));
  });
}

// ====== Render ======
function renderHome() {
  const t = todayStr();
  const todayItems = items.filter((x) => x.date === t);

  statTodayEl.textContent = String(todayItems.length);
  statAllEl.textContent = String(items.length);

  const recent = items.slice(0, 6);
  recentListEl.innerHTML = "";
  if (recent.length === 0) {
    recentEmptyEl.classList.remove("hidden");
  } else {
    recentEmptyEl.classList.add("hidden");
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
  historyItems.forEach((it) => ((byDate[it.date] ||= []).push(it)));
  const dates = Object.keys(byDate).sort().reverse();

  historyWrapEl.innerHTML = "";
  if (dates.length === 0) {
    historyEmptyEl.classList.remove("hidden");
    return;
  }
  historyEmptyEl.classList.add("hidden");

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
    caret.textContent = idx < 3 ? "收起" : "展开";

    head.appendChild(title);
    head.appendChild(caret);

    const body = document.createElement("div");
    body.className = "group-body" + (idx < 3 ? "" : " hidden");

    const ul = document.createElement("ul");
    ul.className = "list";
    byDate[dateStr].forEach((it) => ul.appendChild(elItemRow(it)));
    body.appendChild(ul);

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
  const q = (searchInputEl.value || "").trim().toLowerCase();
  const chips = Array.from(selectedChips);

  const data = items.filter((it) => {
    const text = (it.text || "").toLowerCase();

    const matchQuery = q ? text.includes(q) : true;

    // AND：同时包含全部标签
    const matchChips =
      chips.length === 0
        ? true
        : chips.every((c) => text.includes(String(c).toLowerCase()));

    return matchQuery && matchChips;
  });

  const chipText = chips.length ? `标签：${chips.join(" + ")}` : "标签：无";
  const queryText = q ? `搜索：「${q}」` : "搜索：无";
  searchMetaEl.textContent = `${chipText} ｜ ${queryText} ｜ 结果 ${data.length} / 总共 ${items.length}`;

  wallListEl.innerHTML = "";
  if (data.length === 0) {
    wallEmptyEl.classList.remove("hidden");
    return;
  }
  wallEmptyEl.classList.add("hidden");
  data.forEach((it) => wallListEl.appendChild(elItemRow(it, true)));
}

function renderAll() {
  if (!pages.home.classList.contains("hidden")) renderHome();
  if (!pages.today.classList.contains("hidden")) renderToday();
  if (!pages.wall.classList.contains("hidden")) renderWall();
}

// ====== Random Review ======
function openModal(text) {
  modalContentEl.textContent = text;
  modalEl.classList.remove("hidden");
}
function closeModal() {
  modalEl.classList.add("hidden");
}
function pickRandom() {
  if (items.length === 0) {
    showToast("还没有历史可以回顾～");
    return;
  }
  const r = items[Math.floor(Math.random() * items.length)];
  openModal(`「${r.text}」\n\n来自：${r.date} · ${formatCN(r.date)}`);
}

// ====== Events ======
tabs.forEach((btn) => {
  const page = btn.dataset.page;
  if (!page) return;
  btn.addEventListener("click", () => showPage(page));
});

goTodayBtn.addEventListener("click", () => showPage("today"));
goWallBtn.addEventListener("click", () => showPage("wall"));

addBtn.addEventListener("click", () => {
  const v = inputEl.value.trim();
  if (!v) {
    showToast("先写点内容～");
    inputEl.focus();
    return;
  }
  addItem(v);
  inputEl.value = "";
  renderAll();
  inputEl.focus();
  showToast("已记录 ✅");
});

// Enter 提交（未来换 textarea 也兼容 Shift+Enter 换行）
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addBtn.click();
  }
});

clearTodayBtn.addEventListener("click", () => {
  const tCount = items.filter((x) => x.date === todayStr()).length;
  if (tCount === 0) return;
  const ok = confirm("确定清空今天的所有小成就吗？");
  if (!ok) return;
  clearToday();
  renderAll();
  showToast("已清空今天");
});

searchInputEl.addEventListener("input", () => renderWall());
searchClearBtn.addEventListener("click", () => {
  searchInputEl.value = "";
  selectedChips.clear();
  syncChipUI();
  renderWall();
  searchInputEl.focus();
});

// ✅ 标签点击：事件委托（不需要 chipButtons 变量，也不会重复绑定）
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;

  const key = btn.dataset.chip || "";
  if (!key) return;

  if (selectedChips.has(key)) selectedChips.delete(key);
  else selectedChips.add(key);

  syncChipUI();
  showPage("wall");
  renderWall();
});

randomBtn.addEventListener("click", () => pickRandom());
modalMaskEl.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
modalAgainBtn.addEventListener("click", () => pickRandom());

exportBtn.addEventListener("click", async () => {
  if (items.length === 0) {
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

resetAllBtn.addEventListener("click", () => {
  if (items.length === 0) return;
  const ok = confirm("确定清空全部历史数据吗？此操作不可恢复。");
  if (!ok) return;
  items = [];
  saveItems();
  renderAll();
  showToast("已清空全部");
});

// ====== Init ======
syncChipUI();
showPage("home");
inputEl.focus();
renderAll();
