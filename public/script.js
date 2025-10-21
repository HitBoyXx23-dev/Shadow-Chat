const socket = io();
const enterScreen = document.getElementById("enter-screen");
const chatContainer = document.getElementById("chat-container");
const usernameInput = document.getElementById("username");
const enterBtn = document.getElementById("enter-btn");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("file-input");
const fileBtn = document.getElementById("file-btn");
const userDisplay = document.getElementById("userDisplay");
const pfp = document.getElementById("pfp");

let username = "";
let localStream;
let peerConnection;
let isCalling = false;

enterBtn.onclick = () => {
  username = usernameInput.value.trim() || "Shadow";
  userDisplay.textContent = username;
  enterScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");
};

socket.on("chatHistory", (history) => {
  history.forEach(addMessage);
});

sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (msg) {
    const message = { user: username, text: msg, time: Date.now() };
    socket.emit("chatMessage", message);
    messageInput.value = "";
  }
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

// File Upload
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

// WebRTC Voice Calls
const callBtn = document.getElementById("call-btn");
const groupCallBtn = document.getElementById("group-call-btn");
const endCallBtn = document.getElementById("end-call-btn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

async function initCall() {
  if (isCalling) return;
  isCalling = true;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  localVideo.srcObject = localStream;
  localVideo.style.display = "block";

  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.style.display = "block";
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) socket.emit("candidate", event.candidate);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection();
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; remoteVideo.style.display = "block"; };
  peerConnection.onicecandidate = (e) => { if (e.candidate) socket.emit("candidate", e.candidate); };
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", (answer) => peerConnection.setRemoteDescription(answer));
socket.on("candidate", (candidate) => peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));

callBtn.onclick = () => initCall();
groupCallBtn.onclick = () => initCall();
endCallBtn.onclick = () => {
  if (peerConnection) peerConnection.close();
  localVideo.style.display = "none";
  remoteVideo.style.display = "none";
  isCalling = false;
};

// === Background + Hover Effects ===
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
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.life = life;
    this.color = color;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }
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
    p.update();
    p.draw();
    if (p.life <= 0 || p.y > canvas.height) particles.splice(i, 1);
  });
  requestAnimationFrame(animate);
}
animate();
setInterval(addFallingParticles, 100);

// Fireworks when hover over title
const shadowTitle = document.getElementById("shadowTitle");
shadowTitle.addEventListener("mouseenter", () => {
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    const x = window.innerWidth / 2;
    const y = 50;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const color = `rgba(170,0,255,${Math.random()})`;
    particles.push(new Particle(x, y, vx, vy, Math.random() * 3 + 2, 80, color));
  }
});
