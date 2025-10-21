const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
let pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
localStorage.setItem("shadow_username", username);

let localStream;
let peers = {}; // peerConnections by socketId

// === Enter ===
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("profile-name").textContent = username;
  document.getElementById("pfp").src = pfp;
  socket.emit("register", username);
};

// === Tabs ===
document.querySelectorAll("#nav-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#nav-tabs button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
  });
});

// === Active Users ===
const userList = document.getElementById("user-list");
const userCount = document.getElementById("user-count");
socket.on("userList", users => {
  userList.innerHTML = users.map(u => `<li>${u}</li>`).join("");
  userCount.textContent = `Active: ${users.length}`;
});

// === Chat ===
socket.on("chatHistory", msgs => msgs.forEach(addMsg));
socket.on("chatMessage", addMsg);
document.getElementById("send-btn").onclick = sendMsg;
function sendMsg(){
  const text = document.getElementById("message-input").value.trim();
  if(!text) return;
  const msg = { user: username, pfp, text, time: Date.now() };
  socket.emit("chatMessage", msg);
  document.getElementById("message-input").value = "";
}
function addMsg({user,pfp,text}){
  const div=document.createElement("div");
  div.classList.add("message");
  if(user===username)div.classList.add("self");
  div.innerHTML=`<img src="${pfp}" class="pfp"><div class="text"><b>${user}:</b><br>${text}</div>`;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop=document.getElementById("messages").scrollHeight;
}

// === File Upload ===
const fileInput = document.getElementById("file-input");
document.getElementById("file-btn").onclick = () => fileInput.click();

fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();

  let html = "";
  if (file.type.startsWith("video/")) {
    html = `<video src="${data.data}" controls style="max-width:300px;border-radius:8px;"></video>`;
  } else if (file.type.startsWith("audio/")) {
    html = `<audio src="${data.data}" controls style="width:250px;"></audio>`;
  } else if (file.type.startsWith("image/")) {
    html = `<img src="${data.data}" style="max-width:250px;border-radius:6px;">`;
  } else {
    html = `<a href="${data.data}" download="${file.name}" style="color:#a020f0;">${file.name}</a>`;
  }

  const msg = { user: username, pfp, text: html, time: Date.now() };
  socket.emit("chatMessage", msg);
  fileInput.value = "";
};


// === Profile ===
const pfpEl=document.getElementById("pfp");
document.getElementById("change-pfp").onclick=()=>document.getElementById("pfp-upload").click();
document.getElementById("pfp-upload").onchange=()=>{
  const f=document.getElementById("pfp-upload").files[0];
  if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    pfpEl.src=r.result;
    localStorage.setItem("shadow_pfp",r.result);
    pfp=r.result;
  };
  r.readAsDataURL(f);
};
document.getElementById("save-username").onclick=()=>{
  const n=document.getElementById("edit-username").value.trim();
  if(n){
    username=n;localStorage.setItem("shadow_username",n);
    document.getElementById("profile-name").textContent=n;
    socket.emit("register",n);
  }
};

// === Call Notifications ===
const callTab = document.getElementById("call-tab");
function showNotice(msg, color="#8000ff") {
  const note = document.createElement("div");
  note.textContent = msg;
  note.style.cssText = `
    background:${color};color:white;padding:10px 15px;
    border-radius:8px;margin-top:15px;text-align:center;
    box-shadow:0 0 10px ${color};opacity:0;transition:opacity .3s;
  `;
  callTab.prepend(note);
  setTimeout(()=>note.style.opacity="1",50);
  setTimeout(()=>{note.style.opacity="0";setTimeout(()=>note.remove(),500)},3000);
}

// === WebRTC Group Audio ===
async function createPeerConnection(id) {
  const pc = new RTCPeerConnection();
  peers[id] = pc;
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.ontrack = e => { const a = new Audio(); a.srcObject = e.streams[0]; a.play(); };
  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("candidate", { candidate: e.candidate, to: id });
  };
  return pc;
}

document.getElementById("joinCall").onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  socket.emit("joinGroup");
  showNotice("🔊 You joined the call", "#4b0082");
};

socket.on("user-joined", async id => {
  const pc = await createPeerConnection(id);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { offer, to: id });
});

socket.on("offer", async ({ offer, from }) => {
  const pc = await createPeerConnection(from);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer, to: from });
});

socket.on("answer", async ({ answer, from }) => {
  await peers[from]?.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async ({ candidate, from }) => {
  if (peers[from]) await peers[from].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("user-left", id => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
});

document.getElementById("leaveCall").onclick = () => {
  socket.emit("leaveGroup");
  Object.values(peers).forEach(pc => pc.close());
  peers = {};
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  showNotice("❌ You left the call", "#a020f0");
};

// === Background Particles ===
const c=document.getElementById("bgParticles"),ctx=c.getContext("2d");
function resize(){c.width=innerWidth;c.height=innerHeight;}resize();window.onresize=resize;
let parts=[];function add(){parts.push({x:Math.random()*c.width,y:0,v:Math.random()*2+1,s:Math.random()*2+1,l:200});}
function loop(){ctx.clearRect(0,0,c.width,c.height);parts.forEach((p,i)=>{p.y+=p.v;p.l--;
ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,6.28);
ctx.fillStyle=`rgba(128,0,255,${Math.random()*0.5})`;ctx.fill();
if(p.l<=0||p.y>c.height)parts.splice(i,1);});requestAnimationFrame(loop);}
setInterval(add,100);loop();
