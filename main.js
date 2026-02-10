/* Small Wins - main.js (stable rebuild)
 * Goals:
 * - Never crash the whole app if some DOM nodes are missing
 * - Tabs navigation works
 * - Record wins to localStorage
 * - Basic views: Home/Today/Wall/Settings
 */

(() => {
  "use strict";
// ===== Tag helpers (auto parse from #xxx) =====
const TAG_RE = /#([\u4e00-\u9fa5A-Za-z0-9_]+)/g;

function extractTagsFromText(text) {
  const s = String(text || "");
  const tags = [];
  let m;
  while ((m = TAG_RE.exec(s)) !== null) {
    const t = (m[1] || "").trim();
    if (t && !tags.includes(t)) tags.push(t);
  }
  return tags;
}

// ensure item.tags exists (backward compatible)
function ensureTags(item) {
  if (!item) return item;
  if (!Array.isArray(item.tags) || item.tags.length === 0) {
    item.tags = extractTagsFromText(item.text);
  }
  return item;
}

  // ---------- Storage ----------
  const STORAGE_KEY = "smallwins_items_v1";

  /** @typedef {{id:string, text:string, ts:number, done?:boolean}} WinItem */

  /** @returns {WinItem[]} */
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
  .filter((x) => x && typeof x === "object")
  .map((x) => ({
    id: String(x.id || cryptoRandomId()),
    text: String(x.text || "").trim(),
    ts: Number(x.ts || Date.now()),
    done: !!x.done,
    tags: Array.isArray(x.tags) && x.tags.length ? x.tags : extractTagsFromText(String(x.text || "")),
  }))
  .filter((x) => x.text.length > 0);

    } catch (e) {
      console.warn("loadItems failed:", e);
      return [];
    }
  }

  /** @param {WinItem[]} items */
  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("saveItems failed:", e);
    }
  }

  let items = loadItems();

  // ---------- Utils ----------
  function $(id) {
    return document.getElementById(id);
  }
  function show(el) {
    if (el) el.classList.remove("hidden");
  }
  function hide(el) {
    if (el) el.classList.add("hidden");
  }
  function setText(el, text) {
    if (el) el.textContent = text;
  }
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function cryptoRandomId() {
    // safe fallback
    try {
      return (crypto && crypto.randomUUID) ? crypto.randomUUID() : "id_" + Math.random().toString(16).slice(2);
    } catch {
      return "id_" + Math.random().toString(16).slice(2);
    }
  }
  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function dayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function formatTime(ts) {
    const d = new Date(ts);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  }

  // ---------- DOM (tolerant) ----------
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    random: $("page-random"),
    settings: $("page-settings"),
  };

  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const tagBtn = $("tagBtn");
  const tagMenuEl = $("tagMenu");     // optional
  const quickTagsEl = $("quickTags"); // optional

  const statTodayEl = $("statToday");
  const statAllEl = $("statAll");

  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");

  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");

  const todayListEl = $("todayList");
  const todayEmptyEl = $("todayEmpty");
  const clearTodayBtn = $("clearTodayBtn");

  const yesterdayListEl = $("yesterdayList");
  const yesterdayEmptyEl = $("yesterdayEmpty");

  const historyWrapEl = $("historyWrap");
  const historyEmptyEl = $("historyEmpty");

  // ---------- Tags ----------
  // Supports #生活 #work #复盘_01
  function extractTagsFromText(text) {
    const s = String(text || "");
    const matches = s.match(/#([\u4e00-\u9fa5A-Za-z0-9_]+)/g) || [];
    return matches.map((m) => m.slice(1));
  }

  function getTopTags(limit = 8) {
    const counter = new Map();
    for (const it of items) {
      for (const t of extractTagsFromText(it.text)) {
        const key = String(t).trim();
        if (!key) continue;
        counter.set(key, (counter.get(key) || 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  function insertTagToInput(tag) {
    if (!inputEl) return;
    const cur = inputEl.value || "";
    const toAdd = `#${tag}`;
    // If already included, do nothing
    if (cur.includes(toAdd)) return;
    const sep = cur.trim().length === 0 ? "" : " ";
    inputEl.value = cur + sep + toAdd + " ";
    inputEl.focus();
  }

  function renderQuickTags() {
    if (!quickTagsEl) return;

    const tags = getTopTags(8);
    quickTagsEl.innerHTML = "";
    if (!tags.length) {
      hide(quickTagsEl);
      return;
    }

    show(quickTagsEl);
    for (const tag of tags) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = `#${tag}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertTagToInput(tag);
      });
      quickTagsEl.appendChild(btn);
    }
  }

  // ---------- Core actions ----------
  function addItem(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      done: false,
    });
    saveItems(items);
    return true;
  }

  function toggleDone(id) {
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    items[idx].done = !items[idx].done;
    saveItems(items);
  }

  function deleteItem(id) {
    items = items.filter((x) => x.id !== id);
    saveItems(items);
  }

  function clearToday() {
    const today0 = dayStart(new Date());
    items = items.filter((x) => x.ts < today0);
    saveItems(items);
  }

  // ---------- Rendering helpers ----------
  function renderList(containerEl, emptyEl, listItems, options = {}) {
    if (!containerEl) return;

    containerEl.innerHTML = "";

    if (!listItems.length) {
      if (emptyEl) show(emptyEl);
      return;
    }
    if (emptyEl) hide(emptyEl);

    for (const it of listItems) {
      const row = document.createElement("div");
      row.className = "item";

      const left = document.createElement("div");
      left.className = "item-left";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!it.done;
      checkbox.addEventListener("change", () => {
        toggleDone(it.id);
        renderAll();
      });

      const text = document.createElement("div");
      text.className = "item-text" + (it.done ? " done" : "");
      text.innerHTML = escapeHtml(it.text);

      left.appendChild(checkbox);
      left.appendChild(text);

      const right = document.createElement("div");
      right.className = "item-right";

      const time = document.createElement("div");
      time.className = "item-time";
      time.textContent = formatTime(it.ts);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger";
      del.textContent = "删除";
      del.addEventListener("click", () => {
        if (confirm("确定删除这条记录吗？")) {
          deleteItem(it.id);
          renderAll();
        }
      });

      right.appendChild(time);
      // optional: hide delete in some contexts
      if (!options.hideDelete) right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);

      containerEl.appendChild(row);
    }
  }

  function renderStats() {
    const today = new Date();
    const todayCount = items.filter((x) => isSameDay(new Date(x.ts), today)).length;
    setText(statTodayEl, String(todayCount));
    setText(statAllEl, String(items.length));
  }

  function renderHomeRecent() {
    if (!recentListEl) return;
    const recent = items.slice(0, 5);
    renderList(recentListEl, recentEmptyEl, recent, { hideDelete: true });
  }

  function renderTodayPage() {
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);

    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    const yestItems = items.filter((x) => isSameDay(new Date(x.ts), yest));

    renderList(todayListEl, todayEmptyEl, todayItems);
    renderList(yesterdayListEl, yesterdayEmptyEl, yestItems);
  }

  function renderWallPage() {
    // simple grouped history
    if (!historyWrapEl) return;

    historyWrapEl.innerHTML = "";

    if (!items.length) {
      if (historyEmptyEl) show(historyEmptyEl);
      return;
    }
    if (historyEmptyEl) hide(historyEmptyEl);

    // Group by YYYY-MM-DD
    const groups = new Map();
    for (const it of items) {
      const d = new Date(it.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }

    const keys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1)); // desc

    for (const key of keys) {
      const section = document.createElement("section");
      section.className = "history-section";

      const h = document.createElement("div");
      h.className = "history-title";
      h.textContent = key;

      const list = document.createElement("div");
      list.className = "history-list";

      section.appendChild(h);
      section.appendChild(list);
      historyWrapEl.appendChild(section);

      renderList(list, null, groups.get(key));
    }
  }

  // ===== Wall bindings (search + chips) =====
function renderWall() {
  const { wallListEl, wallEmptyEl, wallSearchEl } = getWallNodes();
  if (!wallListEl) return;

  let items = loadItems().map(ensureTags);

  const qRaw = (wallSearchEl?.value || "").trim();
  const q = qRaw.replace(/^#/, "");

  if (q) {
    items = items.filter((it) => {
      const text = String(it?.text || "");
      const tags = Array.isArray(it?.tags) ? it.tags : [];
      return (
        text.includes(qRaw) ||
        text.includes("#" + q) ||
        tags.includes(q) ||
        tags.some((t) => String(t).includes(q))
      );
    });
  }

  items.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

  if (typeof renderList === "function") {
    renderList(wallListEl, wallEmptyEl, items);
  } else {
    wallListEl.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.textContent = String(it.text || "");
      wallListEl.appendChild(li);
    });
    if (wallEmptyEl) wallEmptyEl.style.display = items.length ? "none" : "";
  }
}
  
function getWallNodes() {
  const wallListEl = document.getElementById("wallList");
  const wallEmptyEl = document.getElementById("wallEmpty");

  // 你的页面里 input 的 id 是 wallSearch（你控制台已经验证）
  const wallSearchEl =
    document.getElementById("wallSearch") ||
    document.querySelector("#page-wall input");

  // 你的 chips 容器 id 是 wallChips（你控制台已验证）
  const wallChipsEl =
    document.getElementById("wallChips") ||
    document.querySelector("#page-wall .chips");

  // 清空按钮你页面里是 searchClearBtn（index.html 里就是）
  const wallClearBtnEl =
    document.getElementById("searchClearBtn") ||
    document.querySelector("#page-wall button.ghost");

  return { wallListEl, wallEmptyEl, wallSearchEl, wallChipsEl, wallClearBtnEl };
}

function bindWallOnce() {
  const { wallSearchEl, wallChipsEl, wallClearBtnEl } = getWallNodes();
  if (!wallSearchEl) return;

  // 避免重复绑定
  if (wallSearchEl.dataset.bound === "1") return;
  wallSearchEl.dataset.bound = "1";

  // 输入搜索：实时刷新
  wallSearchEl.addEventListener("input", () => {
    if (typeof renderWall === "function") renderWall();
  });

  // 清空按钮
  if (wallClearBtnEl) {
    wallClearBtnEl.addEventListener("click", () => {
      wallSearchEl.value = "";
      if (typeof renderWall === "function") renderWall();
    });
  }

  // 点击 chips：把关键词写入搜索框并刷新
  if (wallChipsEl) {
    wallChipsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button.chip");
      if (!btn) return;
      const tag = (btn.dataset.chip || btn.textContent || "").trim();
      if (!tag) return;

      // 点击同一个：取消；点击别的：切换
      wallSearchEl.value = (wallSearchEl.value.trim() === tag) ? "" : tag;

      if (typeof renderWall === "function") renderWall();
    });
  }
}

  function renderSettingsPage() {
    // Optional export button if exists
    const exportBtn = $("exportBtn");
    const exportText = $("exportText");

    if (exportBtn) {
      exportBtn.onclick = () => {
        const data = JSON.stringify(items, null, 2);
        if (exportText) {
          exportText.value = data;
          exportText.focus();
          exportText.select();
        } else {
          navigator.clipboard?.writeText?.(data).catch(() => {});
          alert("已复制到剪贴板（如果浏览器允许）。");
        }
      };
    }

    const clearAllBtn = $("clearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        if (!confirm("确定清空全部记录吗？此操作不可恢复。")) return;
        items = [];
        saveItems(items);
        renderAll();
      };
    }
  }

  function renderAll() {
    renderStats();
    renderHomeRecent();
    renderTodayPage();
    renderWallPage();
    renderSettingsPage();
    renderQuickTags();
  }

  // ---------- Navigation ----------
  function setActiveTab(pageKey) {
    for (const t of tabs) {
      const k = t.getAttribute("data-page") || t.dataset.page;
      if (k === pageKey) t.classList.add("active");
      else t.classList.remove("active");
    }
  }

  function showPage(pageKey) {
  // hide all
  Object.values(pages).forEach(hide);

  // show target
  show(pages[pageKey]);
  setActiveTab(pageKey);

  // ✅ 切到成就墙时：绑定一次 + 立刻渲染
  if (pageKey === "wall") {
    try {
      if (typeof bindWallOnce === "function") bindWallOnce();
      if (typeof renderWall === "function") renderWall();
    } catch (e) {
      console.warn("showPage(wall) failed:", e);
    }
  }
}

  function bindTabs() {
    for (const t of tabs) {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    }
  }

  // ---------- Input behaviors ----------
  function bindInput() {
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const v = (inputEl?.value || "").trim();
        if (!v) {
          alert("先写点内容～");
          inputEl?.focus?.();
          return;
        }
        const ok = addItem(v);
        if (ok && inputEl) inputEl.value = "";
        renderAll();
        inputEl?.focus?.();
      });
    }

    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        // Enter submit (Shift+Enter -> newline is not supported here unless textarea)
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn?.click?.();
        }
      });

      // basic: show quick tags when focusing / typing '#'
      inputEl.addEventListener("focus", () => {
        renderQuickTags();
        show(quickTagsEl);
      });
      inputEl.addEventListener("input", () => {
        // lightweight refresh
        if ((inputEl.value || "").includes("#")) {
          renderQuickTags();
          show(quickTagsEl);
        }
      });
    }

    // quick jump buttons
    if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
    if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));

    // clear today
    if (clearTodayBtn) {
      clearTodayBtn.addEventListener("click", () => {
        if (!confirm("确定清空今天的记录吗？")) return;
        clearToday();
        renderAll();
      });
    }

    // click outside closes quickTags
    document.addEventListener("click", () => {
      if (!quickTagsEl) return;
      hide(quickTagsEl);
    });
    // click inside quickTags shouldn't close
    if (quickTagsEl) {
      quickTagsEl.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  }

  // ---------- Boot ----------
  function boot() {
    bindTabs();
    bindInput();

    // default page
    showPage("home");
    renderAll();

    // safety: expose for debugging
    window.__smallwins = {
      loadItems,
      saveItems,
      get items() {
        return items;
      },
      set items(v) {
        items = Array.isArray(v) ? v : items;
        saveItems(items);
        renderAll();
      },
      renderAll,
      showPage,
      addItem,
    };
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
