const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
localStorage.setItem("shadow_username", username);

let peerConnection, localStream, isGroup = false;

// === Entry ===
document.getElementById("enter-btn").onclick = () => {
  document.getElementById("enter-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("profile-name").textContent = username;
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

// === Chat ===
socket.on("chatHistory", msgs => msgs.forEach(addMsg));
socket.on("chatMessage", addMsg);
document.getElementById("send-btn").onclick = sendMsg;
function sendMsg(){
  const text = document.getElementById("message-input").value.trim();
  if(!text) return;
  socket.emit("chatMessage",{user:username,text,time:Date.now()});
  document.getElementById("message-input").value="";
}
function addMsg({user,text}){
  const div=document.createElement("div");
  div.classList.add("message");
  if(user===username)div.classList.add("self");
  div.innerHTML=`<b>${user}:</b> ${text}`;
  const m=document.getElementById("messages");
  m.appendChild(div);
  m.scrollTop=m.scrollHeight;
}

// === File Upload ===
document.getElementById("file-btn").onclick=()=>fileInput.click();
const fileInput=document.getElementById("file-input");
fileInput.onchange=async()=>{
  const file=fileInput.files[0]; if(!file)return;
  const fd=new FormData(); fd.append("file",file);
  const res=await fetch("/upload",{method:"POST",body:fd});
  const data=await res.json();
  const msg={user:username,text:`<img src="${data.data}" style="max-width:200px;border-radius:6px;">`,time:Date.now()};
  socket.emit("chatMessage",msg);
  fileInput.value="";
};

// === Profile ===
const pfp=document.getElementById("pfp");
const pfpUpload=document.getElementById("pfp-upload");
document.getElementById("change-pfp").onclick=()=>pfpUpload.click();
pfpUpload.onchange=()=>{
  const f=pfpUpload.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{pfp.src=r.result;localStorage.setItem("shadow_pfp",r.result);};
  r.readAsDataURL(f);
};
if(localStorage.getItem("shadow_pfp"))pfp.src=localStorage.getItem("shadow_pfp");
document.getElementById("save-username").onclick=()=>{
  const n=document.getElementById("edit-username").value.trim();
  if(n){username=n;localStorage.setItem("shadow_username",n);
    document.getElementById("profile-name").textContent=n;
    socket.emit("register",n);}
};

// === 1-on-1 Call ===
async function startPrivateCall(target){
  localStream=await navigator.mediaDevices.getUserMedia({audio:true});
  peerConnection=new RTCPeerConnection();
  localStream.getTracks().forEach(t=>peerConnection.addTrack(t,localStream));
  peerConnection.ontrack=e=>showRemote(e.streams[0]);
  peerConnection.onicecandidate=e=>{
    if(e.candidate)socket.emit("iceCandidate",{to:target,candidate:e.candidate});
  };
  const offer=await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("callUser",{to:target,offer});
}

socket.on("incomingCall",async({from,offer})=>{
  localStream=await navigator.mediaDevices.getUserMedia({audio:true});
  peerConnection=new RTCPeerConnection();
  localStream.getTracks().forEach(t=>peerConnection.addTrack(t,localStream));
  peerConnection.ontrack=e=>showRemote(e.streams[0]);
  peerConnection.onicecandidate=e=>{
    if(e.candidate)socket.emit("iceCandidate",{to:from,candidate:e.candidate});
  };
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const ans=await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(ans);
  socket.emit("answerCall",{to:from,answer:ans});
});
socket.on("callAnswered",async({answer})=>{
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});
socket.on("iceCandidate",({candidate})=>{
  if(peerConnection)peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
function showRemote(stream){
  const vid=document.getElementById("remoteVideo");
  vid.srcObject=stream; vid.style.display="block";
}
document.getElementById("end-call-btn").onclick=()=>{
  if(peerConnection)peerConnection.close();
  document.getElementById("remoteVideo").style.display="none";
};

// === Group Audio (demo loopback, not perfect WebRTC mesh) ===
document.getElementById("group-join-btn").onclick=async()=>{
  isGroup=true;
  localStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const ctx=new AudioContext();
  const src=ctx.createMediaStreamSource(localStream);
  const dest=ctx.createMediaStreamDestination();
  src.connect(dest);
  const recorder=new MediaRecorder(dest.stream);
  recorder.ondataavailable=(e)=>{
    if(e.data.size>0)socket.emit("groupAudio",e.data);
  };
  recorder.start(500);
};
socket.on("groupAudio",(data)=>{
  const url=URL.createObjectURL(new Blob([data],{type:"audio/webm"}));
  new Audio(url).play();
});
document.getElementById("group-leave-btn").onclick=()=>{
  isGroup=false;
  if(localStream)localStream.getTracks().forEach(t=>t.stop());
};

// === Background Particles ===
const c=document.getElementById("bgParticles"),ctx=c.getContext("2d");
function resize(){c.width=innerWidth;c.height=innerHeight;}window.onresize=resize;resize();
let p=[];function add(){p.push({x:Math.random()*c.width,y:0,v:Math.random()*2+1,s:Math.random()*2+1,l:200});}
function loop(){
  ctx.clearRect(0,0,c.width,c.height);
  p.forEach((a,i)=>{a.y+=a.v;a.l--;ctx.beginPath();ctx.arc(a.x,a.y,a.s,0,6.28);
    ctx.fillStyle=`rgba(128,0,255,${Math.random()*0.5})`;ctx.fill();
    if(a.l<=0||a.y>c.height)p.splice(i,1);});
  requestAnimationFrame(loop);
}
setInterval(add,100);loop();
