const groups = [
  { title: "男生角色", names: ["顾星辰", "江叙白", "秋亦帆", "林泽宇"] },
  { title: "女生角色", names: ["苏晚晴", "夏知柚", "许星眠", "温以宁"] }
];

const initialState = () => ({
  question: "",
  names: groups.map(group => [...group.names]),
  answers: groups.map(() => Array(4).fill(""))
});

const state = initialState();

try {
  const saved = JSON.parse(localStorage.getItem("answer-werewolf-sheet") || "null");
  if (typeof saved?.question === "string") state.question = saved.question;
  if (saved?.names?.length === 2 && saved.names.every(list => list.length === 4)) state.names = saved.names;
  if (saved?.answers?.length === 2 && saved.answers.every(list => list.length === 4)) state.answers = saved.answers;
} catch (error) {
  console.warn("暂存内容无法读取，已使用空白表格。", error);
}

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="screen">
    <section class="sheet" id="sheet" aria-label="答案狼人杀表格">
      <div class="sheet-content">
        <h1 class="main-title">答案狼人杀</h1>
        <label class="question-card">
          <span class="question-label">题目</span>
          <input class="question-input" id="question" maxlength="80" placeholder="点击填写题目" value="${escapeHtml(state.question)}">
        </label>
        <div id="tables" style="display:contents"></div>
      </div>
    </section>
    <nav class="actions" aria-label="表格操作">
      <button class="action" id="shuffle" type="button">打乱姓名</button>
      <button class="action primary" id="export" type="button">导出完整图片</button>
      <button class="action" id="exportHidden" type="button">隐藏姓名后导出</button>
      <button class="action" id="clear" type="button">清空填写内容</button>
    </nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>`;

const tables = document.querySelector("#tables");

function renderTables() {
  tables.innerHTML = groups.map((group, groupIndex) => `
    <section class="group" data-group="${groupIndex}">
      <h2 class="group-title">${group.title}</h2>
      <div class="table">
        <div class="row">
          <div class="cell head">姓名</div>
          <div class="cell head">答案</div>
        </div>
        ${state.names[groupIndex].map((name, rowIndex) => `
          <div class="row">
            <div class="cell name">${name}</div>
            <div class="cell">
              <textarea class="entry" data-group="${groupIndex}" data-row="${rowIndex}" aria-label="${name}的答案" maxlength="180" placeholder="点击填写答案">${escapeHtml(state.answers[groupIndex][rowIndex])}</textarea>
            </div>
          </div>`).join("")}
      </div>
    </section>`).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function saveState() {
  try {
    localStorage.setItem("answer-werewolf-sheet", JSON.stringify(state));
  } catch (error) {
    console.warn("暂存失败。", error);
  }
}

document.querySelector("#question").addEventListener("input", event => {
  state.question = event.target.value;
  saveState();
});

tables.addEventListener("input", event => {
  const input = event.target.closest(".entry");
  if (!input) return;
  const { group, row } = input.dataset;
  state.answers[Number(group)][Number(row)] = input.value;
  saveState();
});

window.addEventListener("pagehide", saveState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState();
});

document.querySelector("#shuffle").addEventListener("click", () => {
  document.querySelectorAll(".name").forEach(name => name.classList.add("shuffling"));
  setTimeout(() => {
    state.names = state.names.map(names => shuffleToNewOrder(names));
    saveState();
    renderTables();
    showToast("姓名顺序已打乱");
  }, 140);
});

function shuffleToNewOrder(names) {
  const next = [...names];
  const original = names.join("|");
  for (let attempt = 0; attempt < 8 && next.join("|") === original; attempt++) {
    for (let index = next.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [next[index], next[target]] = [next[target], next[index]];
    }
  }
  if (next.join("|") === original) [next[0], next[1]] = [next[1], next[0]];
  return next;
}

document.querySelector("#clear").addEventListener("click", () => {
  if (!window.confirm("确定要清空题目和全部答案吗？")) return;
  state.question = "";
  state.answers = groups.map(() => Array(4).fill(""));
  document.querySelector("#question").value = "";
  saveState();
  renderTables();
  showToast("填写内容已清空");
});

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

renderTables();

const backgroundImage = new Image();
backgroundImage.src = "background.png";
const backgroundReady = new Promise((resolve, reject) => {
  backgroundImage.onload = resolve;
  backgroundImage.onerror = reject;
});

document.querySelector("#export").addEventListener("click", () => exportSheet(false));
document.querySelector("#exportHidden").addEventListener("click", () => exportSheet(true));

async function exportSheet(hideNames) {
  const buttons = [...document.querySelectorAll(".action")];
  buttons.forEach(button => button.disabled = true);
  showToast("正在生成图片…");

  try {
    await Promise.all([backgroundReady, document.fonts?.ready || Promise.resolve()]);
    const canvas = document.createElement("canvas");
    canvas.width = 941;
    canvas.height = 1670;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    drawExportContent(ctx, hideNames);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("图片生成失败");
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${hideNames ? "答案狼人杀-隐藏姓名" : "答案狼人杀-完整表格"}-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(hideNames ? "隐藏姓名图片已导出" : "完整图片已导出");
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重试");
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

function drawExportContent(ctx, hideNames) {
  const x = 70;
  const width = 801;

  ctx.save();
  ctx.fillStyle = "#574975";
  ctx.font = '700 54px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,255,255,.92)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillText("答案狼人杀", 470.5, 158);
  ctx.restore();

  drawQuestion(ctx, x, 210, width, 78);

  const groupHeight = 600;
  const gap = 30;
  const firstY = 318;
  groups.forEach((group, groupIndex) => {
    drawGroup(ctx, {
      x,
      y: firstY + groupIndex * (groupHeight + gap),
      width,
      height: groupHeight,
      title: group.title,
      names: state.names[groupIndex],
      answers: state.answers[groupIndex],
      hideNames
    });
  });
}

function drawQuestion(ctx, x, y, width, height) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 22);
  ctx.fillStyle = "rgba(255,255,255,.52)";
  ctx.fill();
  ctx.strokeStyle = "rgba(123,105,177,.46)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#65568f";
  ctx.font = '500 25px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("题目", x + 23, y + height / 2);

  const lineStart = x + 90;
  ctx.strokeStyle = "rgba(111,93,168,.48)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lineStart, y + height - 18);
  ctx.lineTo(x + width - 22, y + height - 18);
  ctx.stroke();

  ctx.fillStyle = "#4f4969";
  ctx.font = '400 24px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  drawSingleLine(ctx, state.question, lineStart + 3, y + 19, width - 117);
  ctx.restore();
}

function drawGroup(ctx, options) {
  const { x, y, width, height, title, names, answers, hideNames } = options;
  const radius = 29;
  const titleHeight = 72;
  const tableHeight = height - titleHeight;
  const headerHeight = 48;
  const rowHeight = (tableHeight - headerHeight) / 4;
  const nameWidth = hideNames ? 0 : width * .28;
  const answerWidth = width - nameWidth;
  const lineColor = "rgba(123,105,177,.44)";

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.fill();
  ctx.clip();

  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, "rgba(231,224,255,.74)");
  gradient.addColorStop(1, "rgba(255,247,252,.74)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, titleHeight);

  ctx.fillStyle = "#65568f";
  ctx.font = '500 32px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + width / 2, y + titleHeight / 2);

  const tableY = y + titleHeight;
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(x, tableY, width, headerHeight);
  if (!hideNames) {
    ctx.fillStyle = "rgba(244,240,255,.28)";
    ctx.fillRect(x, tableY + headerHeight, nameWidth, tableHeight - headerHeight);
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x, tableY); ctx.lineTo(x + width, tableY);
  ctx.moveTo(x, tableY + headerHeight); ctx.lineTo(x + width, tableY + headerHeight);
  for (let row = 1; row <= 3; row++) {
    const rowY = tableY + headerHeight + row * rowHeight;
    ctx.moveTo(x, rowY); ctx.lineTo(x + width, rowY);
  }
  if (!hideNames) {
    ctx.moveTo(x + nameWidth, tableY); ctx.lineTo(x + nameWidth, y + height);
  }
  ctx.stroke();

  ctx.fillStyle = "#77708f";
  ctx.font = '400 22px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  if (hideNames) {
    ctx.fillText("答案", x + width / 2, tableY + headerHeight / 2);
  } else {
    ctx.fillText("姓名", x + nameWidth / 2, tableY + headerHeight / 2);
    ctx.fillText("答案", x + nameWidth + answerWidth / 2, tableY + headerHeight / 2);
  }

  for (let row = 0; row < 4; row++) {
    const rowY = tableY + headerHeight + row * rowHeight;
    if (!hideNames) {
      ctx.fillStyle = "#5e537f";
      ctx.font = '500 25px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(names[row], x + nameWidth / 2, rowY + rowHeight / 2);
    }

    ctx.fillStyle = "#4f4969";
    ctx.font = '400 23px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const answerX = x + nameWidth + 16;
    drawWrappedText(ctx, answers[row] || "", answerX, rowY + 14, answerWidth - 32, rowHeight - 28, 31);
  }

  ctx.restore();
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function drawSingleLine(ctx, text, x, y, maxWidth) {
  let value = String(text || "").replace(/\s*\n\s*/g, " ");
  if (!value) return;
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.textBaseline = "top";
    ctx.fillText(value, x, y);
    return;
  }
  while (value && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  ctx.textBaseline = "top";
  ctx.fillText(`${value}…`, x, y);
}

function drawWrappedText(ctx, text, x, y, maxWidth, maxHeight, lineHeight) {
  if (!String(text).trim()) return;
  const lines = [];
  String(text).split("\n").forEach(paragraph => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    let line = "";
    for (const character of paragraph) {
      const testLine = line + character;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = testLine;
      }
    }
    lines.push(line);
  });

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    visible[maxLines - 1] = `${last}…`;
  }
  visible.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
