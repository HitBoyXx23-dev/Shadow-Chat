const socket = io();
let username = localStorage.getItem("shadow_username") || "Femboy";
let pfp = localStorage.getItem("shadow_pfp") || "default_pfp.png";
localStorage.setItem("shadow_username", username);

let localStream, mediaRecorder;

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
socket.on("userList", users => {
  userList.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
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
const fileInput=document.getElementById("file-input");
document.getElementById("file-btn").onclick=()=>fileInput.click();
fileInput.onchange=async()=>{
  const file=fileInput.files[0]; if(!file)return;
  const formData=new FormData(); formData.append("file",file);
  const res=await fetch("/upload",{method:"POST",body:formData});
  const data=await res.json();
  const msg={user:username,pfp,text:`<img src="${data.data}" style="max-width:250px;border-radius:6px;">`,time:Date.now()};
  socket.emit("chatMessage",msg);
  fileInput.value="";
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

// === Group Call ===
document.getElementById("group-join-btn").onclick=async()=>{
  localStream=await navigator.mediaDevices.getUserMedia({audio:true});
  socket.emit("joinGroup");
  const ctx=new AudioContext();
  const src=ctx.createMediaStreamSource(localStream);
  const dest=ctx.createMediaStreamDestination();
  src.connect(dest);
  mediaRecorder=new MediaRecorder(dest.stream);
  mediaRecorder.ondataavailable=(e)=>{
    if(e.data.size>0)socket.emit("groupAudio",e.data);
  };
  mediaRecorder.start(500);
};
socket.on("groupAudio",(data)=>{
  const blob=new Blob([data],{type:"audio/webm"});
  const url=URL.createObjectURL(blob);
  new Audio(url).play();
});
document.getElementById("group-leave-btn").onclick=()=>{
  socket.emit("leaveGroup");
  if(mediaRecorder)mediaRecorder.stop();
  if(localStream)localStream.getTracks().forEach(t=>t.stop());
};

// === Background Particles ===
const c=document.getElementById("bgParticles"),ctx=c.getContext("2d");
function resize(){c.width=innerWidth;c.height=innerHeight;}resize();window.onresize=resize;
let parts=[];
function add(){parts.push({x:Math.random()*c.width,y:0,v:Math.random()*2+1,s:Math.random()*2+1,l:200});}
function loop(){
  ctx.clearRect(0,0,c.width,c.height);
  parts.forEach((p,i)=>{p.y+=p.v;p.l--;
    ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,6.28);
    ctx.fillStyle=`rgba(128,0,255,${Math.random()*0.5})`;ctx.fill();
    if(p.l<=0||p.y>c.height)parts.splice(i,1);
  });
  requestAnimationFrame(loop);
}
setInterval(add,100);loop();
