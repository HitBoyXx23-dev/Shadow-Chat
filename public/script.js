// === Shadow Chat Global Client ===
const socket = io();

// --- Elements ---
const usernameInput = document.getElementById("username");
const pfpUrlInput = document.getElementById("pfpUrl");
const saveBtn = document.getElementById("saveProfile");
const pfpPreview = document.getElementById("pfpPreview");
const status = document.getElementById("status");
const chatLog = document.getElementById("chatLog");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const onlineCount = document.getElementById("onlineCount");

// --- Tabs ---
const tabs = document.querySelectorAll(".tab");
const contents = document.querySelectorAll(".tab-content");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    contents.forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// === PROFILE ===
window.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("shadow_username");
  const savedPfp = localStorage.getItem("shadow_pfp");
  if (savedName) usernameInput.value = savedName;
  if (savedPfp) pfpUrlInput.value = savedPfp;
  pfpPreview.src = savedPfp || "default_pfp.png";
  if (savedName) status.textContent = `🕶️ Welcome back, ${savedName}`;
});

saveBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  const pfp = pfpUrlInput.value.trim() || "default_pfp.png";
  if (!name) return alert("Please enter a username!");
  localStorage.setItem("shadow_username", name);
  localStorage.setItem("shadow_pfp", pfp);
  pfpPreview.src = pfp;
  status.textContent = `✅ Profile saved as ${name}`;
});

// === CHAT ===
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const name = localStorage.getItem("shadow_username") || "Anonymous";
  const pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
  const text = messageInput.value.trim();
  if (!text) return;

  const now = new Date();
  const formattedTime = now.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const msg = { name, pfp, text, time: formattedTime };
  socket.emit("chat message", msg);
  messageInput.value = "";
}

// --- Receive chat history ---
socket.on("chat history", (history) => {
  chatLog.innerHTML = "";
  history.forEach(addMessageToLog);
  localStorage.setItem("shadow_chat_history", JSON.stringify(history));
});

// --- Receive new messages ---
socket.on("chat message", (msg) => {
  addMessageToLog(msg);
  let chatHistory = JSON.parse(localStorage.getItem("shadow_chat_history") || "[]");
  chatHistory.push(msg);
  if (chatHistory.length > 200) chatHistory.shift();
  localStorage.setItem("shadow_chat_history", JSON.stringify(chatHistory));
});

// --- Online users counter ---
socket.on("userCount", (count) => {
  onlineCount.textContent = `🟢 Online Users: ${count}`;
});

// --- Helper to render message ---
function addMessageToLog(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `
    <img src="${msg.pfp}" alt="pfp">
    <div>
      <strong>${msg.name}</strong>
      <span style="font-size:0.7em;opacity:0.7;"> ${msg.time || ""}</span><br>
      <span>${escapeHTML(msg.text)}</span>
    </div>
  `;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
  );
}

// === FALLING PURPLE PARTICLES + ROCKET FIREWORK ===
const canvas = document.getElementById('fireworkCanvas');
const ctx = canvas.getContext('2d');
let fireworks = [];
let ambient = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function createAmbient() {
  ambient = [];
  for (let i = 0; i < 70; i++) {
    ambient.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      s: Math.random() * 0.5 + 0.2,
      c: `rgba(${100 + Math.random()*100},0,${200 + Math.random()*55},${0.2 + Math.random()*0.5})`
    });
  }
}
createAmbient();

function createRocket(x, y) {
  fireworks.push({
    x, y,
    vy: -8 - Math.random() * 4,
    exploded: false,
    color: `hsl(${260 + Math.random()*40}, 100%, 70%)`
  });
}

function explode(x, y, color) {
  for (let i = 0; i < 60; i++) {
    fireworks.push({
      x, y,
      r: Math.random() * 2 + 1,
      c: color,
      s: Math.random() * 5 + 2,
      a: Math.random() * Math.PI * 2,
      alpha: 1
    });
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ambient particles
  ctx.save();
  ambient.forEach(p => {
    p.y += p.s;
    if (p.y > canvas.height) p.y = -10;
    ctx.beginPath();
    ctx.fillStyle = p.c;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.c;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Fireworks
  fireworks.forEach((f, i) => {
    if (!f.exploded && f.vy !== undefined) {
      f.y += f.vy;
      f.vy += 0.2;
      ctx.beginPath();
      ctx.fillStyle = f.color;
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (f.vy >= 0) {
        f.exploded = true;
        explode(f.x, f.y, f.color);
      }
    } else if (f.alpha !== undefined) {
      f.x += Math.cos(f.a) * f.s;
      f.y += Math.sin(f.a) * f.s;
      f.alpha -= 0.02;
      if (f.alpha <= 0) fireworks.splice(i, 1);
      ctx.beginPath();
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.c;
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  requestAnimationFrame(animate);
}
animate();

// Firework trigger
const header = document.querySelector('header');
if (header) {
  header.addEventListener('mouseenter', () => {
    const rect = header.getBoundingClientRect();
    createRocket(rect.left + rect.width / 2, rect.top + rect.height);
  });
}
