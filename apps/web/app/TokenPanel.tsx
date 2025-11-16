"use client";
import { useState } from "react";
import { useLocalToken } from "./useLocalToken";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export function TokenPanel() {
  const [token, setToken] = useLocalToken();
  const [email, setEmail] = useState("customer@example.com");
  const [password, setPassword] = useState("password123");
  const [status, setStatus] = useState("");

  const login = async () => {
    setStatus("Logging in...");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data?.access_token) {
        setToken(data.access_token);
        setStatus("OK");
      } else {
        setStatus(`Error ${res.status}`);
      }
    } catch {
      setStatus("Network error");
    }
  };

  const logout = () => {
    setToken("");
    setStatus("");
  };

  return (
    <div className="token-panel">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="w-200"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="password"
        className="w-140"
      />
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
      <span className="status-muted">
        {status || (token ? "Token set" : "No token")}
      </span>
    </div>
  );
}
