/* ========= Small Wins · main.js (matches your new index.html) ========= */
(() => {
  const LS_KEY = "smallwins_records_v1";
  const LS_NICK = "smallwins_nickname_v1";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const pad2 = (n) => String(n).padStart(2, "0");
  const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function formatDateCN(d) {
    return `${d.getFullYear()}年${pad2(d.getMonth() + 1)}月${pad2(d.getDate())}日`;
  }

  function greetingByHour(h) {
    if (h < 6) return "凌晨好";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveRecords(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }

  function getNickname() {
    return localStorage.getItem(LS_NICK) || "夏央";
  }
  function setNickname(v) {
    localStorage.setItem(LS_NICK, v);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(msg) {
    let t = $("#__toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__toast";
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "22px";
      t.style.transform = "translateX(-50%)";
      t.style.background = "rgba(20,20,20,.92)";
      t.style.color = "#fff";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "999px";
      t.style.fontSize = "14px";
      t.style.zIndex = "99999";
      t.style.maxWidth = "80vw";
      t.style.textAlign = "center";
      t.style.display = "none";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(t.__timer);
    t.__timer = setTimeout(() => (t.style.display = "none"), 1600);
  }

  // ---------- Mood mapping ----------
  const MOODS = {
    calm:    { icon: "🌙", label: "平静" },
    happy:   { icon: "✨", label: "愉悦" },
    relaxed: { icon: "🌱", label: "释然" },
    lazy:    { icon: "☁️", label: "慵懒" },
  };

  // ---------- Elements ----------
  const homeDateEl = $("#home-date");
  const homeGreetingEl = $("#home-greeting");
  const statStreakEl = $("#stat-streak");
  const statStreakSubEl = $("#stat-streak-sub");
  const statHappyEl = $("#stat-happy");
  const statHappySubEl = $("#stat-happy-sub");
  const recentListEl = $("#recent-list");
  const recentEmptyEl = $("#recent-empty");

  const inputTextEl = $("#input-text");
  const tagSuggestEl = $("#tag-suggest");
  const moodGroupEl = $("#mood-group");
  const saveBtnEl = $("#btn-save");
  const todayListEl = $("#today-list");
  const todayEmptyEl = $("#today-empty");
  const clearTodayBtn = $("#btn-clear-today");

  const wallSearchEl = $("#wall-search");
  const wallListEl = $("#wall-list");
  const wallEmptyEl = $("#wall-empty");
  const wallClearBtn = $("#btn-wall-clear");

  const randomTextEl = $("#random-text");
  const randomTimeEl = $("#random-time");
  const randomNextBtn = $("#btn-random-next");
  const randomDeleteBtn = $("#btn-random-delete");

  const installBtn = $("#btn-install");
  const installTip = $("#install-tip");

  const nicknameInput = $("#nickname-input");
  const nicknamePreview = $("#nickname-preview");
  const saveNickBtn = $("#btn-save-nickname");

  const exportBtn = $("#btn-export");
  const clearAllBtn = $("#btn-clear-all");

  // Modal (全文查看)
  const modalEl = $("#modal");
  const modalTitleEl = $("#modal-title");
  const modalBodyEl = $("#modal-body");

  // ---------- State ----------
  let records = loadRecords();
  let selectedMood = null;
  let currentRandomId = null;

  // ---------- Modal ----------
  function openModal(title, body) {
    if (!modalEl) return;
    if (modalTitleEl) modalTitleEl.textContent = title || "";
    if (modalBodyEl) modalBodyEl.textContent = body || "";
    modalEl.style.display = "";
    modalEl.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.style.display = "none";
    modalEl.setAttribute("aria-hidden", "true");
  }

  if (modalEl) {
    modalEl.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // ---------- Tabs navigation (Top + Bottom tabbar) ----------
  const tabs = $$(".topnav button, .tabbar-btn");
  const pages = ["page-home", "page-today", "page-wall", "page-random", "page-settings"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function showPage(id) {
    pages.forEach((p) => (p.style.display = p.id === id ? "" : "none"));
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.target === id));

    // 切页时把 tag suggest 收起来，避免浮在上层
    hideTagSuggest();

    if (id === "page-home") renderHome();
    if (id === "page-today") renderToday();
    if (id === "page-wall") renderWall();
    if (id === "page-random") renderRandom();
    if (id === "page-settings") renderSettings();
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => showPage(btn.dataset.target)));

  // 让所有 data-target（比如首页卡片按钮）也能切页
  $$("[data-target]").forEach((el) => {
    if (el.closest(".topnav")) return;
    if (el.closest(".tabbar")) return;
    el.addEventListener("click", () => {
      const t = el.getAttribute("data-target");
      if (t) showPage(t);
    });
  });

  // ---------- Home ----------
  function calcStreak(arr) {
    const set = new Set(arr.map((r) => r.dateKey));
    const today = new Date();
    let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let streak = 0;
    while (set.has(toDateKey(d))) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function renderHome() {
    const now = new Date();
    const nick = getNickname();
    if (homeDateEl) homeDateEl.textContent = formatDateCN(now);

    const greet = `${greetingByHour(now.getHours())}，${nick}`;
    if (homeGreetingEl) homeGreetingEl.textContent = greet;
    if (nicknamePreview) nicknamePreview.textContent = greet;

    const streak = calcStreak(records);
    const happyCount = records.length;

    if (statStreakEl) statStreakEl.textContent = String(streak);
    if (statStreakSubEl) statStreakSubEl.textContent = `已坚持 ${streak} 天`;
    if (statHappyEl) statHappyEl.textContent = String(happyCount);
    if (statHappySubEl) statHappySubEl.textContent = `${happyCount} 个瞬间`;

    const latest = [...records].sort((a, b) => b.ts - a.ts).slice(0, 2);

    if (recentListEl) {
      recentListEl.querySelectorAll(".item").forEach((n) => n.remove());

      if (latest.length === 0) {
        if (recentEmptyEl) recentEmptyEl.style.display = "";
      } else {
        if (recentEmptyEl) recentEmptyEl.style.display = "none";

        latest.forEach((r) => {
          const mood = MOODS[r.mood] || null;
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `
            <div class="item-left">
              ${mood ? `<span class="mood-pill ${r.mood}"><span class="mood-ico">${mood.icon}</span><span class="mood-txt">${mood.label}</span></span>` : ""}
              <div class="item-text">${escapeHtml(r.text)}</div>
            </div>
            <div class="item-right">
              <div class="item-time">${escapeHtml(r.timeText)}</div>
            </div>
          `;
          div.addEventListener("click", () => openModal(r.timeText, r.text));
          recentListEl.appendChild(div);
        });
      }
    }
  }

  // ---------- Today / Record ----------
  function bindMood() {
    if (!moodGroupEl) return;
    const btns = $$("#mood-group .mood-btn");

    btns.forEach((b) => {
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        selectedMood = b.dataset.mood || null;
      });
    });
  }

  function renderToday() {
    const todayKey = toDateKey(new Date());
    const todays = records
      .filter((r) => r.dateKey === todayKey)
      .sort((a, b) => b.ts - a.ts);

    if (todayListEl) todayListEl.innerHTML = "";

    if (todays.length === 0) {
      if (todayEmptyEl) todayEmptyEl.style.display = "";
      return;
    }
    if (todayEmptyEl) todayEmptyEl.style.display = "none";

    todays.forEach((r) => {
      const mood = MOODS[r.mood] || null;
      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div class="item-left">
          ${mood ? `<span class="mood-pill ${r.mood}"><span class="mood-ico">${mood.icon}</span><span class="mood-txt">${mood.label}</span></span>` : ""}
          <div class="item-text">${escapeHtml(r.text)}</div>
        </div>
        <div class="item-right">
          <div class="item-time">${escapeHtml(r.timeText)}</div>
          <button class="btn danger" type="button" data-del="${escapeHtml(r.id)}">删除</button>
        </div>
      `;

      // 点卡片看全文（点删除不触发）
      div.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]")) return;
        openModal(r.timeText, r.text);
      });

      if (todayListEl) todayListEl.appendChild(div);
    });

    $$("#today-list [data-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-del");
        records = records.filter((x) => x.id !== id);
        saveRecords(records);
        renderToday();
        renderHome();
        renderWall();
        toast("已删除");
      });
    });
  }

  function saveRecord() {
    const text = (inputTextEl?.value || "").trim();
    if (!text) return toast("先写一句再封存～");

    const now = new Date();
    const dateKey = toDateKey(now);
    const timeText = `${dateKey} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    const r = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text,
      mood: selectedMood || null,
      dateKey,
      ts: now.getTime(),
      timeText,
    };

    records.push(r);
    saveRecords(records);

    if (inputTextEl) inputTextEl.value = "";
    selectedMood = null;
    $$("#mood-group .mood-btn").forEach((b) => b.classList.remove("active"));

    hideTagSuggest();
    renderToday();
    renderHome();
    renderWall();
    toast("已封存 ✨");
  }

  function clearToday() {
    const todayKey = toDateKey(new Date());
    const before = records.length;
    records = records.filter((r) => r.dateKey !== todayKey);
    saveRecords(records);
    renderToday();
    renderHome();
    renderWall();
    if (before === records.length) toast("今天没有可清空的记录");
    else toast("今天已清空");
  }

  // ---------- Wall ----------
  function renderWall() {
    const q = (wallSearchEl?.value || "").trim().toLowerCase();
    let list = [...records].sort((a, b) => b.ts - a.ts);

    if (q) list = list.filter((r) => (r.text || "").toLowerCase().includes(q));

    if (wallListEl) wallListEl.innerHTML = "";

    if (list.length === 0) {
      if (wallEmptyEl) wallEmptyEl.style.display = "";
      return;
    }
    if (wallEmptyEl) wallEmptyEl.style.display = "none";

    list.forEach((r) => {
      const mood = MOODS[r.mood] || null;
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="item-left">
          ${mood ? `<span class="mood-pill ${r.mood}"><span class="mood-ico">${mood.icon}</span><span class="mood-txt">${mood.label}</span></span>` : ""}
          <div class="item-text">${escapeHtml(r.text)}</div>
        </div>
        <div class="item-right">
          <div class="item-time">${escapeHtml(r.timeText)}</div>
          <button class="btn danger" type="button" data-del="${escapeHtml(r.id)}">删除</button>
        </div>
      `;
      div.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]")) return;
        openModal(r.timeText, r.text);
      });
      wallListEl.appendChild(div);
    });

    $$("#wall-list [data-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-del");
        records = records.filter((x) => x.id !== id);
        saveRecords(records);
        renderWall();
        renderHome();
        renderToday();
        toast("已删除");
      });
    });
  }

  function clearWallAll() {
    if (!records.length) return toast("没有数据可清空");
    if (!confirm("确定清空全部记录吗？")) return;
    records = [];
    saveRecords(records);
    renderHome();
    renderToday();
    renderWall();
    renderRandom();
    toast("已清空");
  }

  // ---------- Random ----------
  function pickRandom() {
    if (!records.length) {
      currentRandomId = null;
      if (randomTextEl) randomTextEl.textContent = "—";
      if (randomTimeEl) randomTimeEl.textContent = "还没有记录～";
      return;
    }
    const r = records[Math.floor(Math.random() * records.length)];
    currentRandomId = r.id;

    const mood = MOODS[r.mood] || null;
    const prefix = mood ? `${mood.icon} ${mood.label} · ` : "";

    if (randomTextEl) randomTextEl.textContent = prefix + r.text;
    if (randomTimeEl) randomTimeEl.textContent = r.timeText;
  }

  function renderRandom() {
    if (!currentRandomId) pickRandom();
    else {
      const r = records.find((x) => x.id === currentRandomId);
      if (!r) pickRandom();
      else {
        const mood = MOODS[r.mood] || null;
        const prefix = mood ? `${mood.icon} ${mood.label} · ` : "";
        if (randomTextEl) randomTextEl.textContent = prefix + r.text;
        if (randomTimeEl) randomTimeEl.textContent = r.timeText;
      }
    }
  }

  function deleteCurrentRandom() {
    if (!currentRandomId) return toast("没有可删除的记录");
    records = records.filter((x) => x.id !== currentRandomId);
    saveRecords(records);
    currentRandomId = null;
    renderHome();
    renderToday();
    renderWall();
    pickRandom();
    toast("已删除");
  }

  // ---------- Settings ----------
  function renderSettings() {
    const nick = getNickname();
    if (nicknameInput) nicknameInput.value = nick;
    const now = new Date();
    if (nicknamePreview) nicknamePreview.textContent = `${greetingByHour(now.getHours())}，${nick}`;
  }

  function exportText() {
    if (!records.length) return toast("还没有可导出的记录");
    const lines = [...records]
      .sort((a, b) => a.ts - b.ts)
      .map((r) => {
        const mood = MOODS[r.mood] || null;
        const moodText = mood ? `${mood.icon}${mood.label} ` : "";
        return `${r.timeText}  ${moodText}${r.text}`;
      });

    const text = lines.join("\n");
    navigator.clipboard?.writeText(text)
      .then(() => toast("已复制到剪贴板"))
      .catch(() => {
        prompt("复制下面内容：", text);
      });
  }

  function clearAll() {
    if (!records.length) return toast("没有数据可清空");
    if (!confirm("确定清空全部数据吗？此操作不可撤销。")) return;
    records = [];
    saveRecords(records);
    toast("已清空全部数据");
    renderHome();
    renderToday();
    renderWall();
    renderRandom();
  }

  // ---------- PWA Install ----------
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installTip) installTip.textContent = "✅ 可安装：点击上方按钮即可添加到桌面。";
    if (installBtn) installBtn.disabled = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) {
        toast("如果没有弹窗：请用浏览器“分享”→“添加到主屏幕”");
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      toast(choice.outcome === "accepted" ? "已发起安装" : "已取消安装");
    });
  }

  // ---------- Tag Suggest ----------
  function extractTagsFromText(text) {
    const res = [];
    const re = /[#＃]([^\s#＃]+)/g;
    let m;
    while ((m = re.exec(text || "")) !== null) res.push(m[1]);
    return res;
  }

  function getAllTagsSorted() {
    const counter = new Map();
    records.forEach((r) => {
      extractTagsFromText(r.text || "").forEach((t) => {
        counter.set(t, (counter.get(t) || 0) + 1);
      });
    });
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }

  function hideTagSuggest() {
    if (!tagSuggestEl) return;
    tagSuggestEl.style.display = "none";
    tagSuggestEl.innerHTML = "";
  }

  function showTagSuggest(tags, leftText, cursorPos) {
    if (!tagSuggestEl || !inputTextEl) return;
    if (!tags.length) return hideTagSuggest();

    tagSuggestEl.innerHTML = "";
    tags.slice(0, 12).forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-suggest-item";
      btn.textContent = "#" + tag;

      btn.addEventListener("click", () => {
        const newLeft = leftText.replace(/[#＃]([^\s#＃]*)$/, "#" + tag + " ");
        const right = inputTextEl.value.slice(cursorPos);
        inputTextEl.value = newLeft + right;

        const pos = newLeft.length;
        inputTextEl.focus();
        inputTextEl.setSelectionRange(pos, pos);

        hideTagSuggest();
      });

      tagSuggestEl.appendChild(btn);
    });

    // 固定定位到输入框下方（避免被裁剪/盖住）
    const rect = inputTextEl.getBoundingClientRect();
    tagSuggestEl.style.position = "fixed";
    tagSuggestEl.style.left = rect.left + "px";
    tagSuggestEl.style.top = rect.bottom + 8 + "px";
    tagSuggestEl.style.width = rect.width + "px";
    tagSuggestEl.style.zIndex = "99999";
    tagSuggestEl.style.display = "flex";
  }

  function setupTagSuggest() {
    if (!inputTextEl || !tagSuggestEl) return;

    inputTextEl.addEventListener("input", () => {
      const value = inputTextEl.value || "";
      const cursor = inputTextEl.selectionStart ?? value.length;
      const left = value.slice(0, cursor);

      const m = left.match(/[#＃]([^\s#＃]*)$/);
      if (!m) return hideTagSuggest();

      const keyword = (m[1] || "").trim();
      const all = getAllTagsSorted();
      const filtered = keyword ? all.filter((t) => t.startsWith(keyword)) : all;

      showTagSuggest(filtered, left, cursor);
    });

    // 点击空白处收起
    document.addEventListener("click", (e) => {
      if (e.target === inputTextEl || (tagSuggestEl && tagSuggestEl.contains(e.target))) return;
      hideTagSuggest();
    });

    // Esc 收起（这里不和 modal 冲突：modal 也会关，用户预期一致）
    inputTextEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideTagSuggest();
    });

    // 滚动/缩放时收起，避免浮层位置飘
    window.addEventListener("scroll", hideTagSuggest, { passive: true });
    window.addEventListener("resize", hideTagSuggest);
  }

  // ---------- Events ----------
  bindMood();

  if (saveBtnEl) saveBtnEl.addEventListener("click", saveRecord);

  if (inputTextEl) {
    inputTextEl.addEventListener("keydown", (e) => {
      // 输入框是 input[type=text]：Enter 直接保存
      if (e.key === "Enter") {
        e.preventDefault();
        saveRecord();
      }
    });
  }

  if (clearTodayBtn) clearTodayBtn.addEventListener("click", clearToday);

  if (wallSearchEl) wallSearchEl.addEventListener("input", renderWall);

  $$("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-filter") || "";
      if (wallSearchEl) wallSearchEl.value = v;
      renderWall();
    });
  });

  if (wallClearBtn) wallClearBtn.addEventListener("click", clearWallAll);

  if (randomNextBtn) randomNextBtn.addEventListener("click", () => {
    currentRandomId = null;
    pickRandom();
  });
  if (randomDeleteBtn) randomDeleteBtn.addEventListener("click", deleteCurrentRandom);

  if (saveNickBtn) {
    saveNickBtn.addEventListener("click", () => {
      const v = (nicknameInput?.value || "").trim();
      if (!v) return toast("昵称不能为空");
      setNickname(v);
      renderHome();
      renderSettings();
      toast("昵称已保存");
    });
  }

  if (exportBtn) exportBtn.addEventListener("click", exportText);
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);

  // ---------- Init ----------
  // 兜底：防止“去记录”被错误指向成就墙
  $$('button[data-target="page-wall"]').forEach((b) => {
    if (b.textContent.includes("去记录")) b.setAttribute("data-target", "page-today");
  });

  setupTagSuggest();

  renderHome();
  renderToday();
  renderWall();
  renderRandom();
  renderSettings();
})();
