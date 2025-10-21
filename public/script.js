const socket = io();

// === Elements ===
const enterScreen = document.getElementById("enter-screen");
const appContainer = document.getElementById("app-container");
const navButtons = document.querySelectorAll("#nav-tabs button");
const tabs = document.querySelectorAll(".tab");
const profileName = document.getElementById("profile-name");
const changePfp = document.getElementById("change-pfp");
const pfpUpload = document.getElementById("pfp-upload");
const pfp = document.getElementById("pfp");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileBtn = document.getElementById("file-btn");
const fileInput = document.getElementById("file-input");
const editUsername = document.getElementById("edit-username");
const saveUsername = document.getElementById("save-username");

let username = localStorage.getItem("shadow_username") || "Femboy";
profileName.textContent = username;
localStorage.setItem("shadow_username", username);

// === Enter Screen ===
document.getElementById("enter-btn").onclick = () => {
  enterScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
};

// === Tab Navigation ===
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    tabs.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
  });
});

// === Change Username ===
saveUsername.onclick = () => {
  const newName = editUsername.value.trim();
  if (newName) {
    username = newName;
    localStorage.setItem("shadow_username", username);
    profileName.textContent = username;
    editUsername.value = "";
  }
};

// === Chat ===
socket.on("chatHistory", (history) => {
  history.forEach(addMessage);
});

sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (!msg) return;
  const message = { user: username, text: msg, time: Date.now() };
  socket.emit("chatMessage", message);
  messageInput.value = "";
};

socket.on("chatMessage", addMessage);

function addMessage({ user, text }) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message");
  if (user === username) msgDiv.classList.add("self");
  msgDiv.innerHTML = `<b>${user}:</b> ${text}`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// === File Upload ===
fileBtn.onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  const message = { user: username, text: `<img src="${data.data}" class="uploaded"/>`, time: Date.now() };
  socket.emit("chatMessage", message);
  fileInput.value = "";
};

// === Profile Picture ===
changePfp.onclick = () => pfpUpload.click();
pfpUpload.onchange = () => {
  const file = pfpUpload.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pfp.src = reader.result;
    localStorage.setItem("shadow_pfp", reader.result);
  };
  reader.readAsDataURL(file);
};
if (localStorage.getItem("shadow_pfp")) pfp.src = localStorage.getItem("shadow_pfp");

// === Background Purple Particles ===
const canvas = document.getElementById("bgParticles");
const ctx = canvas.getContext("2d");
let particles = [];
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class Particle {
  constructor(x, y, vx, vy, size, life, color) {
    Object.assign(this, { x, y, vx, vy, size, life, color });
  }
  update() { this.x += this.vx; this.y += this.vy; this.life--; }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

function addFallingParticles() {
  const x = Math.random() * canvas.width;
  const size = Math.random() * 2 + 1;
  const vy = Math.random() * 2 + 1;
  const color = `rgba(128,0,255,${Math.random() * 0.5})`;
  particles.push(new Particle(x, 0, 0, vy, size, 200, color));
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach((p, i) => {
    p.update(); p.draw();
    if (p.life <= 0 || p.y > canvas.height) particles.splice(i, 1);
  });
  requestAnimationFrame(animate);
}
animate();
setInterval(addFallingParticles, 100);
