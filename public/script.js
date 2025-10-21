document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // ===== Tabs =====
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // ===== Profile =====
  const username = document.getElementById("username");
  const pfpUrl = document.getElementById("pfpUrl");
  const pfpPreview = document.getElementById("pfpPreview");
  const saveProfile = document.getElementById("saveProfile");
  const status = document.getElementById("status");

  saveProfile.onclick = () => {
    const n = username.value.trim();
    const p = pfpUrl.value.trim() || "default_pfp.png";
    if (!n) return alert("Enter username!");
    localStorage.setItem("shadow_username", n);
    localStorage.setItem("shadow_pfp", p);
    pfpPreview.src = p;
    status.textContent = `✅ Saved as ${n}`;
  };

  const savedName = localStorage.getItem("shadow_username");
  const savedPfp = localStorage.getItem("shadow_pfp");
  if (savedName) username.value = savedName;
  if (savedPfp) {
    pfpUrl.value = savedPfp;
    pfpPreview.src = savedPfp;
  }

  // ===== Chat =====
  const chatLog = document.getElementById("chatLog");
  const msg = document.getElementById("message");
  const sendBtn = document.getElementById("sendBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const onlineCount = document.getElementById("onlineCount");

  sendBtn.onclick = sendMessage;
  msg.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/upload", { method: "POST", body: data });
    const j = await res.json();
    sendMediaMessage(j.fileUrl);
  };

  socket.on("userCount", c => (onlineCount.textContent = `🟢 Online Users: ${c}`));
  socket.on("chat history", h => h.forEach(renderMsg));
  socket.on("chat message", renderMsg);

  function sendMessage() {
    const t = msg.value.trim();
    if (!t) return;
    const m = {
      name: localStorage.getItem("shadow_username") || "Anon",
      pfp: localStorage.getItem("shadow_pfp") || "default_pfp.png",
      text: t,
      time: new Date().toLocaleTimeString(),
    };
    socket.emit("chat message", m);
    msg.value = "";
  }

  function sendMediaMessage(url) {
    const m = {
      name: localStorage.getItem("shadow_username") || "Anon",
      pfp: localStorage.getItem("shadow_pfp") || "default_pfp.png",
      text: url,
      time: new Date().toLocaleTimeString(),
    };
    socket.emit("chat message", m);
  }

  function renderMsg(m) {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<img src="${m.pfp}" class="pfp">
      <div><strong>${m.name}</strong>
      <span style="font-size:0.7em;opacity:0.7;">${m.time}</span><br>${parseMedia(m.text)}</div>`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function parseMedia(t) {
    if (t.match(/\.(jpeg|jpg|gif|png)$/i)) return `<img src="${t}" class="media">`;
    if (t.match(/\.(mp4|webm)$/i)) return `<video src="${t}" controls class="media"></video>`;
    if (t.startsWith("http")) return `<a href="${t}" target="_blank">${t}</a>`;
    return t;
  }

  // ===== Call Feature =====
  let peer, localStream;
  const startCall = document.getElementById("startCall");
  const endCall = document.getElementById("endCall");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  startCall.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
    peer.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
    peer.onicecandidate = e => {
      if (e.candidate) socket.emit("callSignal", { type: "candidate", candidate: e.candidate });
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("callSignal", { type: "offer", offer });
  };

  endCall.onclick = () => {
    if (peer) peer.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  };

  socket.on("callSignal", async d => {
    if (!peer) {
      peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
      peer.onicecandidate = e => {
        if (e.candidate) socket.emit("callSignal", { type: "candidate", candidate: e.candidate });
      };
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
    }
    if (d.type === "offer") {
      await peer.setRemoteDescription(d.offer);
      const ans = await peer.createAnswer();
      await peer.setLocalDescription(ans);
      socket.emit("callSignal", { type: "answer", answer: ans });
    } else if (d.type === "answer") {
      await peer.setRemoteDescription(d.answer);
    } else if (d.type === "candidate" && d.candidate) {
      await peer.addIceCandidate(d.candidate);
    }
  });
});
