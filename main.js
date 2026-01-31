const listEl = document.getElementById("achievementList");
const inputEl = document.getElementById("achievementInput");

let achievements = JSON.parse(
  localStorage.getItem("smallWins") || "[]"
);

function render() {
  listEl.innerHTML = "";
  achievements.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = "✓ " + text;
    listEl.appendChild(li);
  });
}

function addAchievement() {
  const value = inputEl.value.trim();
  if (!value) return;

  achievements.unshift(value);
  localStorage.setItem("smallWins", JSON.stringify(achievements));

  inputEl.value = "";
  render();
}

render();
