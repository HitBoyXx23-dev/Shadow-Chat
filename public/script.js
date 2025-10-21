const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
localStorage.setItem("shadow_username", username);

let peerConnection;
let localStream;
let isGroup = false;

// Enter
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("profile-name").textContent = username;
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

// Active Users
const userList = document.getElementById("user-list");
socket.on("userList", users => {
  userList.innerHTML = "";
  users.forEach(u => {
    if (u === username) return;
    const li = document.createElement("li");
    li.textContent = u;
    li.onclick = () => startPrivateCall(u);
    userList.appendChild(li);
  });
});

// Chat
socket.on("chatHistory", msgs => msgs.forEach(addMsg));
document.getElementById("send-btn").onclick = () => {
  const text = document.getElementById("message-input").value.trim();
  if (!text) return;
  socket.emit("chatMessage", { user: username, text, time: Date.now() });
  document.getElementById("message-input").value = "";
};
socket.on("chatMessage", addMsg);
function addMsg({ user, text }) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (user === username) div.classList.add("self");
  div.innerHTML = `<b>${user}:</b> ${text}`;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop =
    document.getElementById("messages").scrollHeight;
}

// === WebRTC Private Call ===
async function startPrivateCall(target) {
  isGroup = false;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  peerConnection.ontrack = e => showRemote(e.streams[0]);
  peerConnection.onicecandidate = e => {
    if (e.candidate)
      socket.emit("iceCandidate", { to: target, candidate: e.candidate });
  };
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("callUser", { to: target, offer });
}

// === Group Call ===
document.getElementById("group-join-btn").onclick = async () => {
  isGroup = true;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  document.getElementById("localVideo").srcObject = localStream;
  document.getElementById("localVideo").style.display = "block";
  socket.emit("joinGroup", username);
};
document.getElementById("group-leave-btn").onclick = () => {
  socket.emit("leaveGroup", username);
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  document.getElementById("localVideo").style.display = "none";
};

// Incoming Calls
socket.on("incomingCall", async ({ from, offer }) => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  peerConnection.ontrack = e => showRemote(e.streams[0]);
  peerConnection.onicecandidate = e => {
    if (e.candidate)
      socket.emit("iceCandidate", { to: from, candidate: e.candidate });
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

function showRemote(stream) {
  const vid = document.getElementById("remoteVideo");
  vid.srcObject = stream;
  vid.style.display = "block";
}

// Group audio streaming
socket.on("groupAudio", async ({ id, audioData }) => {
  if (isGroup) {
    const blob = new Blob([audioData], { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  }
});

// End Call
document.getElementById("end-call-btn").onclick = () => {
  if (peerConnection) peerConnection.close();
  document.getElementById("remoteVideo").style.display = "none";
};

// Background Particles
const canvas = document.getElementById("bgParticles");
const ctx = canvas.getContext("2d");
let parts = [];
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener("resize", resize);
resize();
class Particle {
  constructor(x, y, vx, vy, s, l, c) {
    Object.assign(this, { x, y, vx, vy, s, l, c });
  }
  update() { this.x += this.vx; this.y += this.vy; this.l--; }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
    ctx.fillStyle = this.c;
    ctx.fill();
  }
}
function add() {
  const x = Math.random() * canvas.width;
  const size = Math.random() * 2 + 1;
  const vy = Math.random() * 2 + 1;
  const c = `rgba(128,0,255,${Math.random() * 0.5})`;
  parts.push(new Particle(x, 0, 0, vy, size, 200, c));
}
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  parts.forEach((p, i) => {
    p.update(); p.draw();
    if (p.l <= 0 || p.y > canvas.height) parts.splice(i, 1);
  });
  requestAnimationFrame(loop);
}
loop();
setInterval(add, 100);
