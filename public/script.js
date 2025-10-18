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

  // ✅ Accurate local date + time with AM/PM
  const now = new Date();
  const formattedTime = now.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true, // 👈 Adds AM/PM format
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
