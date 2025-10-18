import { useState } from "react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [username, setUsername] = useState("");
  const [link, setLink] = useState("");

  const register = async () => {
    const res = await fetch(`${API}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "1234" }),
    });
    const data = await res.json();
    setLink(`${window.location.origin}${data.link}`);
  };

  return (
    <div className="container">
      <h1>🌌 Shadow Chat</h1>
      <input
        placeholder="Enter username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={register}>Create Account</button>
      {link && <p>Your shareable link: <a href={link}>{link}</a></p>}
    </div>
  );
}
