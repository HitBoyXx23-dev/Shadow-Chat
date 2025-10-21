const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// temp memory upload
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// persistent chat
const CHAT_FILE = path.join(__dirname, "chatHistory.json");
let chat = fs.existsSync(CHAT_FILE)
  ? JSON.parse(fs.readFileSync(CHAT_FILE, "utf8") || "[]")
  : [];

let users = {}; // socket.id → username

io.on("connection", (socket) => {
  socket.on("register", (user) => {
    users[socket.id] = user;
    io.emit("userList", Object.values(users));
    socket.emit("chatHistory", chat);
  });

  socket.on("chatMessage", (msg) => {
    chat.push(msg);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2));
    io.emit("chatMessage", msg);
  });

  // --- WebRTC signalling for group audio ---
  socket.on("joinGroup", () => {
    socket.join("group");
    socket.to("group").emit("user-joined", socket.id);
  });

  socket.on("offer", ({ offer, to }) => io.to(to).emit("offer", { offer, from: socket.id }));
  socket.on("answer", ({ answer, to }) => io.to(to).emit("answer", { answer, from: socket.id }));
  socket.on("candidate", ({ candidate, to }) => io.to(to).emit("candidate", { candidate, from: socket.id }));

  socket.on("leaveGroup", () => {
    socket.leave("group");
    socket.to("group").emit("user-left", socket.id);
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
    socket.to("group").emit("user-left", socket.id);
  });
});

server.listen(PORT, () =>
  console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`)
);
