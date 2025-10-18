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

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Load / Save chat history
function loadChatHistory() {
  try {
    if (fs.existsSync(chatFile)) {
      return JSON.parse(fs.readFileSync(chatFile, "utf8"));
    }
    return [];
  } catch (err) {
    console.error("❌ Error loading chat history:", err);
    return [];
  }
}

function saveChatHistory(history) {
  try {
    fs.writeFileSync(chatFile, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("❌ Error saving chat history:", err);
  }
}

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  console.log("🟣 User connected:", socket.id);

  // Update & broadcast user count
  io.emit("userCount", io.engine.clientsCount);

  // Send chat history to new user
  const history = loadChatHistory();
  socket.emit("chat history", history);

  // Incoming message
  socket.on("chat message", (msg) => {
    console.log("💬", msg.name, ":", msg.text);

    const updated = [...history, msg].slice(-200);
    saveChatHistory(updated);

    io.emit("chat message", msg);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("🔵 User disconnected:", socket.id);
    io.emit("userCount", io.engine.clientsCount);
  });
});

server.listen(PORT, () =>
  console.log(`🕶️ Shadow Chat global server running on port ${PORT}`)
);
