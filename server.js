const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

const PUBLIC = path.join(__dirname, "public");
app.use(express.static(PUBLIC));
app.use(express.json());

app.get("/", (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// === persistent chat ===
const CHAT_FILE = path.join(__dirname, "chatHistory.json");
let chat = fs.existsSync(CHAT_FILE)
  ? JSON.parse(fs.readFileSync(CHAT_FILE, "utf8") || "[]")
  : [];

// === track users ===
let users = {}; // socket.id -> username

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.emit("chatHistory", chat);
  socket.emit("userList", Object.values(users));

  socket.on("register", (name) => {
    users[socket.id] = name;
    io.emit("userList", Object.values(users));
  });

  socket.on("chatMessage", (msg) => {
    chat.push(msg);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2));
    io.emit("chatMessage", msg);
  });

  // 1-on-1 WebRTC
  socket.on("callUser", ({ to, offer }) => {
    const target = Object.keys(users).find(id => users[id] === to);
    if (target) io.to(target).emit("incomingCall", { from: users[socket.id], offer });
  });
  socket.on("answerCall", ({ to, answer }) => {
    const target = Object.keys(users).find(id => users[id] === to);
    if (target) io.to(target).emit("callAnswered", { from: users[socket.id], answer });
  });
  socket.on("iceCandidate", ({ to, candidate }) => {
    const target = Object.keys(users).find(id => users[id] === to);
    if (target) io.to(target).emit("iceCandidate", { from: users[socket.id], candidate });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
    console.log("disconnected:", socket.id);
  });
});

server.listen(PORT, () =>
  console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`)
);
