"use client";
/**
 * Realtime Demo Page
 * - Logs in (JWT in localStorage), connects to Socket.IO namespace at /ws
 * - Joins a room (e.g., job:<id>), sends/receives chat messages
 * - Shows presence and applies simple client-side rate-limits UI
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useLocalToken } from "../useLocalToken";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "../components/Toast";

function RealtimePageContent() {
  const [email, setEmail] = useState("provider@example.com");
  const [password, setPassword] = useState("password123");
  const [nameField, setNameField] = useState("Provider User");
  const [role, setRole] = useState<"CUSTOMER" | "PROVIDER" | "ADMIN">(
    "PROVIDER",
  );
  const [token, setToken] = useLocalToken();
  const [me, setMe] = useState<{
    id: string;
    email: string;
    name?: string;
  } | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [online, setOnline] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qpRoom = search.get("room") || undefined;
  const [room, setRoom] = useState<string>(qpRoom || "job:demo");
  const { push } = useToast();

  // Load saved room if no query param
  useEffect(() => {
    if (qpRoom) return;
    try {
      const saved = localStorage.getItem("realtime:room");
      if (saved) setRoom(saved);
    } catch {}
  }, [qpRoom]);

  // Sync room to URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(search.toString());
      params.set("room", room);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      localStorage.setItem("realtime:room", room);
    } catch {}
  }, [room, pathname, router, search]);
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      room: string;
      userId: string;
      content: string;
      ts: string;
      user?: { id: string; email: string; name?: string };
    }>
  >([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);
  const pingRef = useRef<any>(null);
  const [typingCooldownUntil, setTypingCooldownUntil] = useState<number | null>(
    null,
  );
  const [chatCooldownUntil, setChatCooldownUntil] = useState<number | null>(
    null,
  );
  const [, forceTick] = useState(0);

  // heartbeat to update cooldown countdown
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // load persisted cooldowns from localStorage
  useEffect(() => {
    try {
      const tRaw = localStorage.getItem("rt:typingCooldownUntil");
      const cRaw = localStorage.getItem("rt:chatCooldownUntil");
      const now = Date.now();
      const tNum = tRaw ? Number(tRaw) : 0;
      const cNum = cRaw ? Number(cRaw) : 0;
      if (tNum > now) setTypingCooldownUntil(tNum);
      if (cNum > now) setChatCooldownUntil(cNum);
    } catch {}
  }, []);

  // persist cooldowns
  useEffect(() => {
    try {
      if (typingCooldownUntil)
        localStorage.setItem(
          "rt:typingCooldownUntil",
          String(typingCooldownUntil),
        );
      else localStorage.removeItem("rt:typingCooldownUntil");
    } catch {}
  }, [typingCooldownUntil]);

  useEffect(() => {
    try {
      if (chatCooldownUntil)
        localStorage.setItem("rt:chatCooldownUntil", String(chatCooldownUntil));
      else localStorage.removeItem("rt:chatCooldownUntil");
    } catch {}
  }, [chatCooldownUntil]);

  const typingCooldownLeft = typingCooldownUntil
    ? Math.max(0, Math.ceil((typingCooldownUntil - Date.now()) / 1000))
    : 0;
  const chatCooldownLeft = chatCooldownUntil
    ? Math.max(0, Math.ceil((chatCooldownUntil - Date.now()) / 1000))
    : 0;
  const typingDisabled = typingCooldownLeft > 0;
  const chatDisabled = chatCooldownLeft > 0;

  const connect = async () => {
    if (!token) return alert("Login first to fetch JWT");
    if (socketRef.current) socketRef.current.disconnect();
    const s = io("http://localhost:3001/ws", {
      extraHeaders: { Authorization: `Bearer ${token}` },
    });
    socketRef.current = s;
    s.on("connect", () => {
      setStatus("Connected");
      push("WebSocket connected", "success");
      // Start presence ping every 30s
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        s.emit("presence:ping");
      }, 30000);
    });
    s.on("disconnect", () => {
      setStatus("Disconnected");
      push("WebSocket disconnected", "error");
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
    });
    s.on("presence:update", (p: { online: string[] }) =>
      setOnline(p.online || []),
    );
    s.on("chat:message", (m: any) =>
      setMessages((prev) => [...prev.slice(-49), m]),
    );
    s.on(
      "rate_limit",
      (p: { kind: "typing" | "chat"; ttl?: number; limit?: number }) => {
        const ttl = Number(p.ttl || 5);
        if (p.kind === "typing")
          setTypingCooldownUntil(Date.now() + ttl * 1000);
        if (p.kind === "chat") setChatCooldownUntil(Date.now() + ttl * 1000);
        const msg = p.kind === "typing" ? "Typing throttled" : "Chat throttled";
        setStatus(`${msg}; wait ~${ttl}s`);
        push(`${msg}; wait ~${ttl}s`, "error");
      },
    );
  };

  const login = async () => {
    setStatus("Logging in...");
    const res = await fetch("http://localhost:3001/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    const t = data.access_token as string | undefined;
    if (!t) {
      setStatus("Login failed");
      push("Login failed", "error");
      return;
    }
    setToken(t);
    setStatus("Login ok");
    push("Login ok", "success");
    try {
      const meRes = await fetch("http://localhost:3001/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        setMe({ id: meData.id, email: meData.email, name: meData.name });
      }
    } catch {}
  };

  const signup = async () => {
    setStatus("Signing up...");
    const res = await fetch("http://localhost:3001/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: nameField, role }),
    });
    if (!res.ok) {
      setStatus("Signup failed");
      push("Signup failed", "error");
      return;
    }
    // Auto-login after signup
    await login();
  };

  const fetchHistory = async (cursorId?: string) => {
    const keyMatch = /^job:(.+)$/.exec(room);
    if (!keyMatch) return;
    const url = new URL(
      `http://localhost:3001/jobs/${encodeURIComponent(keyMatch[1])}/messages`,
    );
    url.searchParams.set("take", "50");
    if (cursorId) url.searchParams.set("cursorId", cursorId);
    const res = await fetch(url.toString());
    const data = await res.json();
    const items = (data.items || []) as Array<any>;
    setMessages(
      items.map((m) => ({
        id: m.id,
        room,
        userId: m.userId,
        content: m.content,
        ts: m.createdAt,
        user: m.user,
      })),
    );
    setNextCursor(data.nextCursor);
  };

  const joinRoom = async () => {
    socketRef.current?.emit("room:join", room);
    await fetchHistory();
    push(`Joined ${room}`, "success");
  };
  const leaveRoom = () => {
    socketRef.current?.emit("room:leave", room);
    push(`Left ${room}`, "info");
  };
  const typing = (isTyping: boolean) => {
    if (typingDisabled) return;
    socketRef.current?.emit("typing", { room, isTyping });
  };
  const sendChat = () => {
    const content = chatInput.trim();
    if (!content) return;
    if (chatDisabled) {
      setStatus(`Chat throttled; wait ~${chatCooldownLeft}s`);
      push(`Chat throttled; wait ~${chatCooldownLeft}s`, "error");
      return;
    }
    socketRef.current?.emit("chat:send", { room, content });
    setChatInput("");
    push("Message sent", "success");
  };

  return (
    <div className="container font-sans">
      <h1 className="flex items-center gap-12">
        Realtime Demo
        <span title={`Online users`} className="pill pill-online">
          {online.length} online
        </span>
      </h1>
      <p>Status: {status}</p>
      <div className="grid-6 items-center">
        <input
          className="col-span-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
        />
        <input
          className="col-span-2"
          value={nameField}
          onChange={(e) => setNameField(e.target.value)}
          placeholder="name"
        />
        <select
          className="col-span-1"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="PROVIDER">PROVIDER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <input
          className="col-span-2"
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        <button className="col-span-1" onClick={signup}>
          Signup
        </button>
        <button className="col-span-1" onClick={login}>
          Login
        </button>
        <button className="col-span-1" onClick={connect} disabled={!token}>
          Connect WS
        </button>
      </div>
      <div className="mt-16">
        <div>Token: {token ? `${token.slice(0, 16)}...` : "—"}</div>
      </div>
      <div className="divider" />
      <div className="flex gap-8 items-center">
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="room (e.g., job:123)"
        />
        <button onClick={joinRoom}>Join</button>
        <button onClick={leaveRoom}>Leave</button>
        <button
          onMouseDown={() => typing(true)}
          onMouseUp={() => typing(false)}
          disabled={typingDisabled}
          title={
            typingDisabled
              ? `Typing cooldown: ${typingCooldownLeft}s`
              : "Emit typing while pressed"
          }
        >
          {typingDisabled
            ? `Hold to type (cd ${typingCooldownLeft}s)`
            : "Hold to type"}
        </button>
      </div>
      <h3 className="mt-16">Online</h3>
      <pre className="pre">{JSON.stringify(online, null, 2)}</pre>
      <div>
        <button onClick={() => socketRef.current?.emit("presence:ping")}>
          Ping presence now
        </button>
      </div>

      <h3>Chat</h3>
      <div className="flex gap-8 items-center">
        <input
          className="flex-1"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={`Message as ${me?.name || email || "you"} to ${room}${chatDisabled ? ` (cd ${chatCooldownLeft}s)` : ""}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !chatDisabled) sendChat();
          }}
        />
        <button
          onClick={sendChat}
          disabled={chatDisabled}
          title={
            chatDisabled
              ? `Chat cooldown: ${chatCooldownLeft}s`
              : "Send message"
          }
        >
          {chatDisabled ? `Send (cd ${chatCooldownLeft}s)` : "Send"}
        </button>
      </div>
      <div className="mt-8">
        <button disabled={!nextCursor} onClick={() => fetchHistory(nextCursor)}>
          Load older
        </button>
      </div>
      <div className="chat-box">
        {messages.map((m) => {
          const isMine = me?.id && m.userId === me.id;
          const who = isMine
            ? "You"
            : m.user?.name || m.user?.email || m.userId.slice(0, 6);
          return (
            <div key={m.id} className={`msg-row ${isMine ? "right" : "left"}`}>
              <div
                className={`bubble ${isMine ? "bubble-mine" : "bubble-other"}`}
              >
                <div className="font-12 text-muted">
                  {who} • {new Date(m.ts).toLocaleTimeString()}
                </div>
                <div className="font-14">{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RealtimePage() {
  return (
    <Suspense
      fallback={<div className="container">Loading realtime console...</div>}
    >
      <RealtimePageContent />
    </Suspense>
  );
}
