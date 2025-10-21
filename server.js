const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;
const chatFile = path.join(__dirname, "chatlog.json");

app.use(express.static(path.join(__dirname, "public")));

function loadHistory() {
  if (fs.existsSync(chatFile)) return JSON.parse(fs.readFileSync(chatFile, "utf8"));
  return [];
}
function saveHistory(data) {
  fs.writeFileSync(chatFile, JSON.stringify(data, null, 2));
}

io.on("connection", (socket) => {
  console.log("🟣", socket.id, "connected");
  io.emit("userCount", io.engine.clientsCount);

  const hist = loadHistory();
  socket.emit("chat history", hist);

  socket.on("chat message", (msg) => {
    const h = [...hist, msg].slice(-200);
    saveHistory(h);
    io.emit("chat message", msg);
  });

  // --- WebRTC signaling ---
  socket.on("callSignal", (data) => {
    socket.broadcast.emit("callSignal", data);
  });

  socket.on("disconnect", () => {
    io.emit("userCount", io.engine.clientsCount);
    console.log("🔵", socket.id, "disconnected");
  });
});

server.listen(PORT, () => console.log(`🕶️ Shadow Chat running on port ${PORT}`));
