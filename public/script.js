const socket = io();

// Profile elements
const usernameInput = document.getElementById("username");
const pfpUrlInput = document.getElementById("pfpUrl");
const saveBtn = document.getElementById("saveProfile");
const pfpPreview = document.getElementById("pfpPreview");
const status = document.getElementById("status");

// Chat elements
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const chatLog = document.getElementById("chatLog");

// Load saved profile
window.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("shadow_username");
  const savedPfp = localStorage.getItem("shadow_pfp");
  if (savedName) usernameInput.value = savedName;
  if (savedPfp) pfpUrlInput.value = savedPfp;
  pfpPreview.src = savedPfp || "default_pfp.png";
  if (savedName) status.textContent = `🕶️ Welcome back, ${savedName}`;
});

// Save profile
saveBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  const pfp = pfpUrlInput.value.trim() || "default_pfp.png";
  if (!name) return alert("Enter a username first!");
  localStorage.setItem("shadow_username", name);
  localStorage.setItem("shadow_pfp", pfp);
  pfpPreview.src = pfp;
  status.textContent = `✅ Profile saved as ${name}`;
});

// Send message
sendBtn.addEventListener("click", () => {
  const name = localStorage.getItem("shadow_username") || "Anonymous";
  const pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
  const text = messageInput.value.trim();
  if (!text) return;
  const msg = { name, pfp, text };
  socket.emit("chat message", msg);
  messageInput.value = "";
});

// Display messages from others
socket.on("chat message", (msg) => {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message");
  msgDiv.innerHTML = `
    <img src="${msg.pfp}" alt="pfp">
    <strong>${msg.name}:</strong> <span>${msg.text}</span>
  `;
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
});
