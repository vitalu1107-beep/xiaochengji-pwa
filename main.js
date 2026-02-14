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
    calm:   { icon: "🌙", label: "平静" },
    happy:  { icon: "✨", label: "愉悦" },
    relaxed:{ icon: "🌱", label: "释然" },
    lazy:   { icon: "☁️", label: "慵懒" },
  };

  // ---------- Elements (new index.html) ----------
  const homeDateEl = $("#home-date");
  const homeGreetingEl = $("#home-greeting");
  const homeQuoteEl = $("#home-quote");
  const statStreakEl = $("#stat-streak");
  const statStreakSubEl = $("#stat-streak-sub");
  const statHappyEl = $("#stat-happy");
  const statHappySubEl = $("#stat-happy-sub");
  const recentListEl = $("#recent-list");
  const recentEmptyEl = $("#recent-empty");

  const inputTextEl = $("#input-text");
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

  // ---------- State ----------
  let records = loadRecords();
  let selectedMood = null;
  let currentRandomId = null;

  // ---------- Tabs navigation (your index already has a simple one, but we keep this safe) ----------
  const tabs = $$(".topnav button");
  const pages = ["page-home", "page-today", "page-wall", "page-random", "page-settings"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function showPage(id) {
    pages.forEach((p) => (p.style.display = p.id === id ? "" : "none"));
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.target === id));
    // re-render on page switch
    if (id === "page-home") renderHome();
    if (id === "page-today") renderToday();
    if (id === "page-wall") renderWall();
    if (id === "page-random") renderRandom();
    if (id === "page-settings") renderSettings();
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => showPage(btn.dataset.target)));

  // Make any [data-target] outside topnav switch pages
  $$("[data-target]").forEach((el) => {
    if (el.closest(".topnav")) return;
    el.addEventListener("click", () => {
      const t = el.getAttribute("data-target");
      if (t) showPage(t);
    });
  });

  // ---------- Home ----------
  function calcStreak(arr) {
    // streak = consecutive days ending today with >=1 record each day
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

    // stats
    const streak = calcStreak(records);
    const happyCount = records.length;

    if (statStreakEl) statStreakEl.textContent = String(streak);
    if (statStreakSubEl) statStreakSubEl.textContent = `已坚持 ${streak} 天`;
    if (statHappyEl) statHappyEl.textContent = String(happyCount);
    if (statHappySubEl) statHappySubEl.textContent = `${happyCount} 个瞬间`;

    // recent list (latest 2)
    const latest = [...records].sort((a, b) => b.ts - a.ts).slice(0, 2);
    if (recentListEl) {
      // clear all except the empty placeholder
      recentListEl.querySelectorAll(".item").forEach((n) => n.remove());

      if (latest.length === 0) {
        if (recentEmptyEl) recentEmptyEl.style.display = "";
      } else {
        if (recentEmptyEl) recentEmptyEl.style.display = "none";

        latest.forEach((r) => {
          const mood = MOODS[r.mood] || null;
          const left = `
            <div class="item-left">
              ${mood ? `<span class="mood-pill ${r.mood}"><span class="mood-ico">${mood.icon}</span><span class="mood-txt">${mood.label}</span></span>` : ""}
              <div class="item-text">${escapeHtml(r.text)}</div>
            </div>
          `;

          const right = `
            <div class="item-right">
              <div class="item-time">${escapeHtml(r.timeText)}</div>
            </div>
          `;

          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = left + right;
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
    // today list
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
          <button class="btn btn-danger" type="button" data-del="${escapeHtml(r.id)}">删除</button>
        </div>
      `;

      if (todayListEl) todayListEl.appendChild(div);
    });

    // delete handlers
    $$("#today-list [data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        records = records.filter((x) => x.id !== id);
        saveRecords(records);
        renderToday();
        renderHome();
        toast("已删除");
      });
    });
  }

  function saveRecord() {
    const text = (inputTextEl?.value || "").trim();
    if (!text) return toast("先写一句再封存～");

    // mood optional; but if you want required, uncomment:
    // if (!selectedMood) return toast("先选一个心情～");

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
    // keep mood selection if you like; or reset:
    selectedMood = null;
    $$("#mood-group .mood-btn").forEach((b) => b.classList.remove("active"));

    renderToday();
    renderHome();
    renderWall();
    toast("已封存 ✨");
  }

  // clear today
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

    // filter by quick tag buttons (data-filter) if clicked
    // (we keep it simple: buttons set input value)
    if (q) {
      list = list.filter((r) => r.text.toLowerCase().includes(q));
    }

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
          <div class="item-text" style="white-space:normal;">${escapeHtml(r.text)}</div>
        </div>
        <div class="item-right">
          <div class="item-time">${escapeHtml(r.timeText)}</div>
          <button class="btn btn-danger" type="button" data-del="${escapeHtml(r.id)}">删除</button>
        </div>
      `;
      wallListEl.appendChild(div);
    });

    $$("#wall-list [data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
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
    // keep current if exists, else pick
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
        // fallback
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

  // ---------- Events ----------
  // Mood
  bindMood();

  // Save
  if (saveBtnEl) saveBtnEl.addEventListener("click", saveRecord);

  // Enter to save (optional)
  if (inputTextEl) {
    inputTextEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveRecord();
      }
    });
  }

  // Clear today
  if (clearTodayBtn) clearTodayBtn.addEventListener("click", clearToday);

  // Wall search
  if (wallSearchEl) wallSearchEl.addEventListener("input", renderWall);

  // Wall quick filters (#运动/#生活)
  $$('[data-filter]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-filter") || "";
      if (wallSearchEl) wallSearchEl.value = v;
      renderWall();
    });
  });

  // Wall clear
  if (wallClearBtn) wallClearBtn.addEventListener("click", clearWallAll);

  // Random
  if (randomNextBtn) randomNextBtn.addEventListener("click", () => {
    currentRandomId = null;
    pickRandom();
  });
  if (randomDeleteBtn) randomDeleteBtn.addEventListener("click", deleteCurrentRandom);

  // Nickname
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

  // Export / Clear all
  if (exportBtn) exportBtn.addEventListener("click", exportText);
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);

  // ---------- Init ----------
  // Fix: your “去记录/去看看”按钮现在要去“记录微光/成就墙”
  // 你可以在 index.html 里把 data-target 改对，但这里也兜底修一次：
  $$('button[data-target="page-wall"]').forEach((b) => {
    if (b.textContent.includes("去记录")) b.setAttribute("data-target", "page-today");
  });

  renderHome();
  renderToday();
  renderWall();
  renderRandom();
  renderSettings();
})();

// ===== 标签联想（优化版）=====
const input = document.getElementById("input-text");
const tagBox = document.getElementById("tag-suggest");

if (input && tagBox) {

  function extractTags(text){
    const matches = text.match(/#\S+/g);
    return matches ? matches.map(t => t.replace("#","")) : [];
  }

  function getAllTags(){
    const data = JSON.parse(localStorage.getItem("records") || "[]");
    const tagSet = new Set();
    data.forEach(item=>{
      extractTags(item.text || "").forEach(t=>tagSet.add(t));
    });
    return Array.from(tagSet);
  }

  input.addEventListener("input", ()=>{
    const value = input.value;
    const cursor = input.selectionStart;
    const left = value.slice(0, cursor);

    // 只要检测到正在输入 #xxx
    const match = left.match(/#(\S*)$/);

    if(!match){
      tagBox.style.display = "none";
      return;
    }

    const keyword = match[1];
    const allTags = getAllTags();

    let filtered;

    if(keyword === ""){
      // 只输入 #
      filtered = allTags;
    }else{
      // 输入 #生 这种
      filtered = allTags.filter(t => t.startsWith(keyword));
    }

    if(filtered.length === 0){
      tagBox.style.display = "none";
      return;
    }

    tagBox.innerHTML = "";

    filtered.forEach(tag=>{
      const btn = document.createElement("button");
      btn.textContent = "#"+tag;
      btn.type = "button";

      btn.onclick = ()=>{
        const newText = value.replace(/#\S*$/, "#"+tag+" ");
        input.value = newText;
        tagBox.style.display = "none";
        input.focus();
      };

      tagBox.appendChild(btn);
    });

    tagBox.style.display = "flex";
  });
}
