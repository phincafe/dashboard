import React, { useState } from "react";

export default function PasswordGate({ children }) {
  const correctPassword = import.env.VITE_DASHBOARD_PASSWORD;
  const [input, setInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const tryLogin = () => {
    if (input === correctPassword) {
      setUnlocked(true);
      sessionStorage.setItem("dashboardUnlocked", "1");
    } else {
      alert("Incorrect password");
    }
  };

  React.useEffect(() => {
    if (sessionStorage.getItem("dashboardUnlocked") === "1") {
      setUnlocked(true);
    }
  }, []);

  if (!unlocked) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white"
      }}>
        <h2>🔐 Enter Password</h2>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #555",
            marginBottom: 12,
            width: 200
          }}
        />
        <button onClick={tryLogin} style={{
          padding: "10px 20px",
          borderRadius: 6,
          background: "#1f2937",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}>Login</button>
      </div>
    );
  }

  return children;
}
