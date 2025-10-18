const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "shadow-secret", resave: false, saveUninitialized: true }));

const dbPath = path.join(__dirname, "data/users.json");
if (!fs.existsSync(dbPath)) fs.writeJsonSync(dbPath, {});
const readDB = () => fs.readJsonSync(dbPath);
const writeDB = (data) => fs.writeJsonSync(dbPath, data, { spaces: 2 });

// Home
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("index");
});

// Register
app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  if (db[username]) return res.send("❌ Username already exists.");
  const hash = await bcrypt.hash(password, 10);

  db[username] = {
    password: hash,
    messages: [],
    pfp: "/default_pfp.png",
    bio: "No bio yet."
  };
  writeDB(db);

  req.session.user = username;
  res.redirect("/dashboard");
});

// Login
app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  if (!db[username]) return res.send("❌ User not found.");

  const valid = await bcrypt.compare(password, db[username].password);
  if (!valid) return res.send("❌ Incorrect password.");

  req.session.user = username;
  res.redirect("/dashboard");
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const db = readDB();
  const user = db[req.session.user];
  res.render("dashboard", {
    username: req.session.user,
    messages: user.messages,
    pfp: user.pfp,
    bio: user.bio
  });
});

// Edit Profile
app.get("/editprofile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const db = readDB();
  const user = db[req.session.user];
  res.render("editprofile", { username: req.session.user, pfp: user.pfp, bio: user.bio });
});

app.post("/editprofile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const { pfp, bio } = req.body;
  const db = readDB();
  db[req.session.user].pfp = pfp || "/default_pfp.png";
  db[req.session.user].bio = bio || "No bio yet.";
  writeDB(db);
  res.redirect("/dashboard");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Anonymous page
app.get("/u/:username", (req, res) => {
  const { username } = req.params;
  const db = readDB();
  if (!db[username]) return res.status(404).send("User not found.");
  res.render("userpage", { username, pfp: db[username].pfp, bio: db[username].bio });
});

// Send anonymous message
app.post("/u/:username", (req, res) => {
  const { username } = req.params;
  const { message } = req.body;
  const db = readDB();
  if (!db[username]) return res.status(404).send("User not found.");

  db[username].messages.push({
    id: uuidv4(),
    text: message,
    time: new Date().toLocaleString()
  });
  writeDB(db);

  res.send("✅ Anonymous message sent!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🕶️ Shadow Chat running on port ${PORT}`));
