const socket = io();

// ==== Fireworks ====
const canvas = document.getElementById("fireworkCanvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth; canvas.height = innerHeight;
let fws=[];
function rand(a,b){return Math.random()*(b-a)+a}
function Firework(){this.x=rand(0,canvas.width);this.y=canvas.height;this.targetY=rand(canvas.height*0.3,canvas.height*0.6);this.color=`hsl(${rand(250,300)},100%,70%)`;this.velY=rand(4,7);}
Firework.prototype.update=function(){this.y-=this.velY;if(this.y<this.targetY)this.done=true;}
Firework.prototype.draw=function(){ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,2,0,Math.PI*2);ctx.fill();}
function loop(){ctx.fillStyle="rgba(0,0,0,0.2)";ctx.fillRect(0,0,canvas.width,canvas.height);
if(Math.random()<0.05)fws.push(new Firework());
fws.forEach((fw,i)=>{fw.update();fw.draw();if(fw.done)fws.splice(i,1);});
requestAnimationFrame(loop);}
loop();

// ==== Tabs ====
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
  tab.classList.add("active");document.getElementById(tab.dataset.tab).classList.add("active");};
});

// ==== Profile ====
const username=document.getElementById("username"),pfpUrl=document.getElementById("pfpUrl"),
pfpPreview=document.getElementById("pfpPreview"),saveProfile=document.getElementById("saveProfile"),
status=document.getElementById("status");
saveProfile.onclick=()=>{const n=username.value.trim();const p=pfpUrl.value.trim()||"default_pfp.png";
if(!n)return alert("Enter username!");localStorage.setItem("shadow_username",n);localStorage.setItem("shadow_pfp",p);
pfpPreview.src=p;status.textContent=`✅ Saved as ${n}`;}
window.onload=()=>{const n=localStorage.getItem("shadow_username"),p=localStorage.getItem("shadow_pfp");
if(n)username.value=n;if(p){pfpUrl.value=p;pfpPreview.src=p;}}

// ==== Chat ====
const chatLog=document.getElementById("chatLog"),msg=document.getElementById("message"),
sendBtn=document.getElementById("sendBtn"),onlineCount=document.getElementById("onlineCount");
sendBtn.onclick=sendMessage;msg.addEventListener("keypress",e=>{if(e.key==="Enter")sendMessage();});
socket.on("userCount",c=>onlineCount.textContent=`🟢 Online Users: ${c}`);
socket.on("chat history",h=>h.forEach(renderMsg));
socket.on("chat message",renderMsg);
function sendMessage(){
  const t=msg.value.trim();if(!t)return;
  const m={name:localStorage.getItem("shadow_username")||"Anon",
           pfp:localStorage.getItem("shadow_pfp")||"default_pfp.png",
           text:t,time:new Date().toLocaleTimeString()};
  socket.emit("chat message",m);msg.value="";
}
function renderMsg(m){
  const div=document.createElement("div");div.className="message";
  div.innerHTML=`<img src="${m.pfp}" class="pfp"><div><strong>${m.name}</strong>
  <span style="font-size:0.7em;opacity:0.7;">${m.time}</span><br>${parseMedia(m.text)}</div>`;
  chatLog.appendChild(div);chatLog.scrollTop=chatLog.scrollHeight;
}
function parseMedia(t){
  if(t.match(/\.(jpeg|jpg|gif|png)$/i))return `<img src="${t}" class="media">`;
  if(t.match(/\.(mp4|webm)$/i))return `<video src="${t}" controls class="media"></video>`;
  if(t.startsWith("http"))return `<a href="${t}" target="_blank">${t}</a>`;
  return t;
}

// ==== Call ====
let peer,localStream;
const startCall=document.getElementById("startCall"),
endCall=document.getElementById("endCall"),
localVideo=document.getElementById("localVideo"),
remoteVideo=document.getElementById("remoteVideo");

startCall.onclick=async()=>{
  localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  localVideo.srcObject=localStream;
  peer=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
  localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));
  peer.ontrack=e=>remoteVideo.srcObject=e.streams[0];
  peer.onicecandidate=e=>{if(e.candidate)socket.emit("callSignal",{type:"candidate",candidate:e.candidate});};
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  socket.emit("callSignal",{type:"offer",offer});
};
endCall.onclick=()=>{if(peer){peer.close();peer=null;}
if(localStream)localStream.getTracks().forEach(t=>t.stop());
localVideo.srcObject=null;remoteVideo.srcObject=null;};

socket.on("callSignal",async d=>{
  if(!peer){
    peer=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    peer.ontrack=e=>remoteVideo.srcObject=e.streams[0];
    peer.onicecandidate=e=>{if(e.candidate)socket.emit("callSignal",{type:"candidate",candidate:e.candidate});};
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    localVideo.srcObject=localStream;
    localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));
  }
  if(d.type==="offer"){await peer.setRemoteDescription(d.offer);
    const ans=await peer.createAnswer();await peer.setLocalDescription(ans);
    socket.emit("callSignal",{type:"answer",answer:ans});}
  else if(d.type==="answer"){await peer.setRemoteDescription(d.answer);}
  else if(d.type==="candidate"&&d.candidate){await peer.addIceCandidate(d.candidate);}
});
