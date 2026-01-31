const inputEl = document.getElementById("achievementInput");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const listEl = document.getElementById("achievementList");
const emptyEl = document.getElementById("emptyState");
const toastEl = document.getElementById("toast");

const STORAGE_KEY = "smallWins_v1";

// === 数据 ===
let achievements = load();

// === 工具函数 ===
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
}

function showToast(text = "已记录 ✅") {
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 1200);
}

// === 渲染 ===
function render() {
  listEl.innerHTML = "";

  if (achievements.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  achievements.forEach((text, idx) => {
    const li = document.createElement("li");
    li.className = "item";

    const span = document.createElement("div");
    span.className = "item-text";
    span.textContent = "✓ " + text;

    const delBtn = document.createElement("button");
    delBtn.className = "del";
    delBtn.type = "button";
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", () => {
      achievements.splice(idx, 1);
      save();
      render();
      showToast("已删除");
    });

    li.appendChild(span);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  });
}

// === 行为 ===
function addAchievement() {
  const value = inputEl.value.trim();
  if (!value) {
    showToast("先写点内容～");
    inputEl.focus();
    return;
  }

  achievements.unshift(value);
  save();
  inputEl.value = "";
  render();
  inputEl.focus();
  showToast("已记录 ✅");
}

addBtn.addEventListener("click", addAchievement);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addAchievement();
});

clearBtn.addEventListener("click", () => {
  if (achievements.length === 0) return;
  const ok = confirm("确定清空今天的所有小成就吗？");
  if (!ok) return;

  achievements = [];
  save();
  render();
  showToast("已清空");
});

// 初始渲染
render();
inputEl.focus();
