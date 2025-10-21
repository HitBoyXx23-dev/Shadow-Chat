const socket = io();

let username = localStorage.getItem("shadow_username") || "Femboy";
localStorage.setItem("shadow_username", username);

let peerConnection;
let localStream;

document.getElementById("profile-name").textContent = username;

// Enter
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  socket.emit("register", username);
};

// Tabs
const navButtons = document.querySelectorAll("#nav-tabs button");
const tabs = document.querySelectorAll(".tab");
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    tabs.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
  });
});

// User List
const userListEl = document.getElementById("user-list");
socket.on("userList", (users) => {
  userListEl.innerHTML = "";
  users.forEach(name => {
    if (name === username) return;
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => startCall(name);
    userListEl.appendChild(li);
  });
});

// Chat
socket.on("chatHistory", (h) => h.forEach(addMessage));
document.getElementById("send-btn").onclick = () => {
  const msg = document.getElementById("message-input").value.trim();
  if (!msg) return;
  socket.emit("chatMessage", { user: username, text: msg, time: Date.now() });
  document.getElementById("message-input").value = "";
};
socket.on("chatMessage", addMessage);

function addMessage({ user, text }) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (user === username) div.classList.add("self");
  div.innerHTML = `<b>${user}:</b> ${text}`;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop =
    document.getElementById("messages").scrollHeight;
}

// File Upload
document.getElementById("file-btn").onclick = () => fileInput.click();
const fileInput = document.getElementById("file-input");
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  socket.emit("chatMessage", {
    user: username,
    text: `<img src="${data.data}" class="uploaded"/>`,
    time: Date.now(),
  });
  fileInput.value = "";
};

// Profile
const pfp = document.getElementById("pfp");
const pfpUpload = document.getElementById("pfp-upload");
document.getElementById("change-pfp").onclick = () => pfpUpload.click();
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

document.getElementById("save-username").onclick = () => {
  const newName = document.getElementById("edit-username").value.trim();
  if (newName) {
    username = newName;
    localStorage.setItem("shadow_username", username);
    document.getElementById("profile-name").textContent = username;
    socket.emit("register", username);
  }
};

// === WebRTC ===
async function startCall(targetUser) {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
  peerConnection.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("iceCandidate", { to: targetUser, candidate: e.candidate });
  };
  peerConnection.ontrack = (e) => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
    document.getElementById("remoteVideo").style.display = "block";
  };
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("callUser", { to: targetUser, offer });
}

socket.on("incomingCall", async ({ from, offer }) => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
  peerConnection.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("iceCandidate", { to: from, candidate: e.candidate });
  };
  peerConnection.ontrack = (e) => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
    document.getElementById("remoteVideo").style.display = "block";
  };
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answerCall", { to: from, answer });
});

socket.on("callAnswered", async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});
socket.on("iceCandidate", ({ candidate }) => {
  if (peerConnection)
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// End Call
document.getElementById("end-call-btn").onclick = () => {
  if (peerConnection) peerConnection.close();
  document.getElementById("remoteVideo").style.display = "none";
};

// Background Particles
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
