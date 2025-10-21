const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
let pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
localStorage.setItem("shadow_username", username);

let localStream;

// === Enter ===
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("chat-app").classList.remove("hidden");
  document.getElementById("username-display").textContent = username;
  document.getElementById("pfp").src = pfp;
  socket.emit("register", username);
};

// === Chat ===
socket.on("chatHistory", (history) => history.forEach(addMessage));
socket.on("chatMessage", addMessage);

document.getElementById("send-btn").onclick = sendMessage;
function sendMessage() {
  const msg = document.getElementById("message-input").value.trim();
  if (!msg) return;
  const message = { user: username, pfp, text: msg, time: Date.now() };
  socket.emit("chatMessage", message);
  document.getElementById("message-input").value = "";
}

function addMessage({ user, pfp, text }) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message");
  if (user === username) msgDiv.classList.add("self");
  msgDiv.innerHTML = `
    <img src="${pfp}" class="pfp">
    <div class="text"><b>${user}:</b><br>${text}</div>
  `;
  document.getElementById("messages").appendChild(msgDiv);
  document.getElementById("chat-container").scrollTop = document.getElementById("chat-container").scrollHeight;
}

// === File Upload ===
document.getElementById("file-btn").onclick = () => fileInput.click();
const fileInput = document.getElementById("file-input");
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  const message = { user: username, pfp, text: `<img src="${data.data}" style="max-width:250px;border-radius:6px;">`, time: Date.now() };
  socket.emit("chatMessage", message);
  fileInput.value = "";
};

// === Group Call ===
const remoteAudio = document.getElementById("remoteAudio");
let mediaRecorder;
document.getElementById("join-call").onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  socket.emit("joinGroup");

  const audioCtx = new AudioContext();
  const src = audioCtx.createMediaStreamSource(localStream);
  const dest = audioCtx.createMediaStreamDestination();
  src.connect(dest);

  mediaRecorder = new MediaRecorder(dest.stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) socket.emit("groupAudio", e.data);
  };
  mediaRecorder.start(500);
};

socket.on("groupAudio", (data) => {
  const blob = new Blob([data], { type: "audio/webm" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
});

document.getElementById("leave-call").onclick = () => {
  socket.emit("leaveGroup");
  if (mediaRecorder) mediaRecorder.stop();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
};

// === Background Particles ===
const c = document.getElementById("bgParticles");
const ctx = c.getContext("2d");
function resize() { c.width = innerWidth; c.height = innerHeight; }
resize(); window.onresize = resize;
let p = [];
function add() { p.push({ x: Math.random()*c.width, y:0, v:Math.random()*2+1, s:Math.random()*2+1, l:200 }); }
function loop() {
  ctx.clearRect(0,0,c.width,c.height);
  p.forEach((a,i)=>{a.y+=a.v;a.l--;
    ctx.beginPath();ctx.arc(a.x,a.y,a.s,0,6.28);
    ctx.fillStyle=`rgba(128,0,255,${Math.random()*0.5})`;ctx.fill();
    if(a.l<=0||a.y>c.height)p.splice(i,1);
  });
  requestAnimationFrame(loop);
}
setInterval(add,100);loop();
