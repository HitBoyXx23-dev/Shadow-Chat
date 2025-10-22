// === SOCKET SETUP ===
const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
let pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
localStorage.setItem("shadow_username", username);

let localStream;
let screenStream;
let peers = {}; // group calls
let privatePC = null;
let privateTarget = null;
let isMuted = false;
let isSharing = false;
let privateMuted = false;
let privateSharing = false;
let privateScreen = null;

// === AUDIO UNLOCK (mobile) ===
document.body.addEventListener(
  "click",
  () => {
    const a = new Audio();
    a.muted = true;
    a.play().catch(() => {});
  },
  { once: true }
);

// === BANNER SYSTEM ===
const banner = document.getElementById("banner");
function showBanner(msg, color = "#8000ff") {
  banner.textContent = msg;
  banner.style.background = color;
  banner.style.opacity = "1";
  setTimeout(() => (banner.style.opacity = "0"), 3000);
}

// === ENTER SCREEN ===
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("profile-name").textContent = username;
  document.getElementById("pfp").src = pfp;
  socket.emit("register", username);
};

// === TABS ===
document.querySelectorAll("#nav-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#nav-tabs button")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
  });
});

// === ACTIVE USERS ===
const userList = document.getElementById("user-list");
const userCount = document.getElementById("user-count");
const privateUserList = document.getElementById("private-user-list");

socket.on("userList", (users) => {
  userList.innerHTML = users.map((u) => `<li>${u}</li>`).join("");
  userCount.textContent = `Active: ${users.length}`;

  privateUserList.innerHTML = users
    .filter((u) => u !== username)
    .map(
      (u) =>
        `<li>${u} <button class="privateCallBtn" data-user="${u}">📞 Call</button></li>`
    )
    .join("");

  document.querySelectorAll(".privateCallBtn").forEach((btn) => {
    btn.onclick = () => startPrivateCall(btn.dataset.user);
  });
});

// === CHAT ===
socket.on("chatHistory", (msgs) => msgs.forEach(addMsg));
socket.on("chatMessage", addMsg);

document.getElementById("send-btn").onclick = sendMsg;

function sendMsg() {
  const text = document.getElementById("message-input").value.trim();
  if (!text) return;
  const msg = { user: username, pfp, text, time: Date.now() };
  socket.emit("chatMessage", msg);
  document.getElementById("message-input").value = "";
}

function addMsg({ user, pfp, text }) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (user === username) div.classList.add("self");
  div.innerHTML = `<img src="${pfp}" class="pfp"><div class="text"><b>${user}:</b><br>${text}</div>`;
  const msgBox = document.getElementById("messages");
  msgBox.appendChild(div);
  msgBox.scrollTo({ top: msgBox.scrollHeight, behavior: "smooth" });
}

// === FILE UPLOAD ===
const fileInput = document.getElementById("file-input");
document.getElementById("file-btn").onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  const msg = {
    user: username,
    pfp,
    text: `<img src="${data.data}" style="max-width:250px;border-radius:6px;">`,
    time: Date.now(),
  };
  socket.emit("chatMessage", msg);
  fileInput.value = "";
};

// === PROFILE ===
const pfpEl = document.getElementById("pfp");
document.getElementById("change-pfp").onclick = () =>
  document.getElementById("pfp-upload").click();
document.getElementById("pfp-upload").onchange = () => {
  const f = document.getElementById("pfp-upload").files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    pfpEl.src = r.result;
    localStorage.setItem("shadow_pfp", r.result);
    pfp = r.result;
  };
  r.readAsDataURL(f);
};
document.getElementById("save-username").onclick = () => {
  const n = document.getElementById("edit-username").value.trim();
  if (n) {
    username = n;
    localStorage.setItem("shadow_username", n);
    document.getElementById("profile-name").textContent = n;
    socket.emit("register", n);
  }
};

// === GROUP CALL ===
async function createPeerConnection(id) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  peers[id] = pc;

  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (e) => {
    const stream = e.streams[0];
    if (stream.getVideoTracks().length) {
      const v = document.createElement("video");
      v.srcObject = stream;
      v.autoplay = true;
      v.playsInline = true;
      v.style.width = "80%";
      v.style.border = "2px solid #8000ff";
      v.style.borderRadius = "10px";
      document.getElementById("remote-videos").appendChild(v);
      stream.getTracks().forEach(
        (t) => (t.onended = () => v.remove())
      );
    } else {
      const a = new Audio();
      a.srcObject = stream;
      a.autoplay = true;
    }
  };

  pc.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("candidate", { candidate: e.candidate, to: id });
  };
  return pc;
}

document.getElementById("joinCall").onclick = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    socket.emit("joinGroup");
    showBanner("🔊 Joined group call", "#4b0082");
  } catch {
    showBanner("❌ Microphone access denied", "crimson");
  }
};

document.getElementById("leaveCall").onclick = () => {
  socket.emit("leaveGroup");
  Object.values(peers).forEach((pc) => pc.close());
  peers = {};
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  stopScreenShare();
  showBanner("❌ Left group call", "#a020f0");
};

document.getElementById("muteMic").onclick = () => {
  if (!localStream) return showBanner("⚠️ Not in call");
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach((track) => (track.enabled = !isMuted));
  document.getElementById("muteMic").textContent = isMuted
    ? "🔇 Unmute"
    : "🎤 Mute";
  showBanner(isMuted ? "🎙️ Mic muted" : "🎤 Mic unmuted", "#8000ff");
};

// === SCREEN SHARE (FIXED) ===
const shareBtn = document.getElementById("shareScreen");

shareBtn.onclick = async () => {
  if (isSharing) return stopScreenShare();
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    isSharing = true;
    showBanner("🖥️ Started screen share", "#a020f0");

    for (const id in peers) {
      const sender = peers[id]
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender)
        sender.replaceTrack(screenStream.getVideoTracks()[0]);
      else
        screenStream.getTracks().forEach((track) =>
          peers[id].addTrack(track, screenStream)
        );
    }

    const preview = document.getElementById("screen-preview");
    preview.innerHTML = "";
    const video = document.createElement("video");
    video.srcObject = screenStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.width = "80%";
    video.style.border = "2px solid #8000ff";
    video.style.borderRadius = "10px";
    preview.appendChild(video);

    screenStream.getTracks().forEach((t) => (t.onended = stopScreenShare));
    shareBtn.textContent = "🛑 Stop Sharing";
  } catch (err) {
    console.error(err);
    showBanner("❌ Screen share cancelled", "crimson");
  }
};

function stopScreenShare() {
  if (!isSharing || !screenStream) return;
  screenStream.getTracks().forEach((t) => t.stop());
  screenStream = null;
  isSharing = false;
  for (const id in peers) {
    const sender = peers[id]
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");
    if (sender && localStream?.getVideoTracks().length)
      sender.replaceTrack(localStream.getVideoTracks()[0]);
  }
  document.getElementById("screen-preview").innerHTML = "";
  shareBtn.textContent = "🖥️ Share Screen";
  showBanner("🛑 Stopped screen share", "#4b0082");
}

// === PRIVATE 1-on-1 CALL ===
async function startPrivateCall(targetName) {
  if (privatePC) return showBanner("⚠️ Already in a private call", "orange");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    privateTarget = targetName;
    privatePC = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach((t) => privatePC.addTrack(t, localStream));

    privatePC.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream.getVideoTracks().length) {
        const v = document.createElement("video");
        v.srcObject = stream;
        v.autoplay = true;
        v.playsInline = true;
        v.style.width = "80%";
        v.style.border = "2px solid #8000ff";
        v.style.borderRadius = "10px";
        document.getElementById("private-remote").appendChild(v);
      } else {
        const a = new Audio();
        a.srcObject = stream;
        a.autoplay = true;
      }
    };

    privatePC.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("privateCandidate", { candidate: e.candidate, to: targetName });
    };

    const offer = await privatePC.createOffer();
    await privatePC.setLocalDescription(offer);
    socket.emit("privateOffer", { offer, to: targetName, from: username });
    showBanner(`📞 Calling ${targetName}...`, "#4b0082");
  } catch {
    showBanner("❌ Mic access denied", "crimson");
  }
}

// === INCOMING PRIVATE CALL ===
socket.on("privateOffer", async ({ offer, from }) => {
  const popup = document.getElementById("call-popup");
  const callerName = document.getElementById("caller-name");
  callerName.textContent = from;
  popup.classList.remove("hidden");

  document.getElementById("acceptCall").onclick = async () => {
    popup.classList.add("hidden");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    privateTarget = from;
    privatePC = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach((t) => privatePC.addTrack(t, localStream));
    privatePC.ontrack = (e) => {
      const a = new Audio();
      a.srcObject = e.streams[0];
      a.autoplay = true;
    };
    privatePC.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("privateCandidate", { candidate: e.candidate, to: from });
    };
    await privatePC.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await privatePC.createAnswer();
    await privatePC.setLocalDescription(answer);
    socket.emit("privateAnswer", { answer, to: from });
    document.getElementById("endPrivateCall").classList.remove("hidden");
    showBanner(`✅ Connected with ${from}`, "#4b0082");
  };

  document.getElementById("rejectCall").onclick = () => {
    popup.classList.add("hidden");
    showBanner("❌ Call Rejected", "crimson");
  };
});

socket.on("privateAnswer", async ({ answer }) => {
  await privatePC?.setRemoteDescription(new RTCSessionDescription(answer));
  document.getElementById("endPrivateCall").classList.remove("hidden");
  showBanner("✅ Private call connected", "#4b0082");
});

socket.on("privateCandidate", async ({ candidate }) => {
  if (privatePC) await privatePC.addIceCandidate(new RTCIceCandidate(candidate));
});

// === PRIVATE CONTROLS ===
document.getElementById("mutePrivate").onclick = () => {
  if (!localStream) return showBanner("⚠️ Not in private call");
  privateMuted = !privateMuted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !privateMuted));
  document.getElementById("mutePrivate").textContent = privateMuted
    ? "🔇 Unmute"
    : "🎤 Mute";
  showBanner(privateMuted ? "🎙️ Mic muted" : "🎤 Mic unmuted", "#a020f0");
};

// === PRIVATE SCREEN SHARE ===
document.getElementById("sharePrivate").onclick = async () => {
  if (privateSharing) return stopPrivateShare();
  try {
    privateScreen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    privateSharing = true;
    privateScreen
      .getTracks()
      .forEach((track) => privatePC.addTrack(track, privateScreen));
    privateScreen.getTracks().forEach((t) => (t.onended = stopPrivateShare));
    document.getElementById("sharePrivate").textContent = "🛑 Stop Share";
    showBanner("🖥️ Sharing screen", "#4b0082");

    const preview = document.getElementById("private-preview");
    preview.innerHTML = "";
    const vid = document.createElement("video");
    vid.srcObject = privateScreen;
    vid.autoplay = true;
    vid.muted = true;
    vid.style.width = "80%";
    vid.style.border = "2px solid #8000ff";
    vid.style.borderRadius = "10px";
    preview.appendChild(vid);
  } catch {
    showBanner("❌ Screen share cancelled", "crimson");
  }
};

function stopPrivateShare() {
  if (!privateSharing || !privateScreen) return;
  privateScreen.getTracks().forEach((t) => t.stop());
  privateScreen = null;
  privateSharing = false;
  document.getElementById("sharePrivate").textContent = "🖥️ Share Screen";
  document.getElementById("private-preview").innerHTML = "";
  showBanner("🛑 Stopped sharing", "#a020f0");
}

document.getElementById("endPrivateCall").onclick = () => {
  if (privatePC) {
    privatePC.close();
    privatePC = null;
    privateTarget = null;
    showBanner("❌ Private call ended", "#a020f0");
  }
  document.getElementById("endPrivateCall").classList.add("hidden");
  stopPrivateShare();
};

// === SIGNALING ===
socket.on("user-joined", async (id) => {
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
  if (peers[from])
    await peers[from].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("user-left", (id) => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
});

// === MOBILE INPUT FIX ===
const messageInput = document.getElementById("message-input");
messageInput.addEventListener("focus", () => {
  setTimeout(() => {
    messageInput.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
});

// === PARTICLE BACKGROUND ===
const c = document.getElementById("bgParticles");
const ctx = c.getContext("2d");

function resize() {
  c.width = innerWidth;
  c.height = innerHeight;
}
resize();
window.onresize = resize;

let parts = [];
function add() {
  parts.push({
    x: Math.random() * c.width,
    y: 0,
    v: Math.random() * 2 + 1,
    s: Math.random() * 2 + 1,
    l: 200,
  });
}

function loop() {
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.y += p.v;
    p.l--;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(128,0,255,${Math.random() * 0.5})`;
    ctx.fill();
    if (p.l <= 0 || p.y > c.height) parts.splice(i, 1);
  }
  requestAnimationFrame(loop);
}

setInterval(add, 100);
loop();
