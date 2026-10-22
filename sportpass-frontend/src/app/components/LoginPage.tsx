import { useEffect, useRef, useState } from "react";
import { Trophy, Eye, EyeOff, AlertCircle } from "lucide-react";
import type { Role } from "./Layout";
import { apiFetch, API_BASE } from "../lib/api";

interface LoginPageProps {
  onLogin: (role: Role) => void;
  onRegister: () => void;
}

export function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [slowServer, setSlowServer] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The free online server sleeps when unused. Wake it while the user types.
  useEffect(() => {
    fetch(`${API_BASE}/`).catch(() => {});
    return () => {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    };
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setSlowServer(false);
    slowTimer.current = setTimeout(() => setSlowServer(true), 5000);

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Login failed. Please try again.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      onLogin(data.user.role);
    } catch {
      setError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlowServer(false);
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F2450 0%, #1E3A6E 40%, #2563EB 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20" style={{ background: "var(--accent)", filter: "blur(80px)" }} />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 rounded-full opacity-15" style={{ background: "#3B82F6", filter: "blur(100px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "var(--accent)", filter: "blur(120px)" }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl" style={{ background: "var(--accent)" }}>
            <Trophy size={40} className="text-white" />
          </div>
          <h1 className="text-white text-3xl font-heading font-bold tracking-tight">SPORTPASS</h1>
          <p className="text-white/55 text-sm mt-1.5 font-body">Smart Sportfest Passport System</p>
          
        </div>

        {/* Card */}
        <form onSubmit={handleLogin} noValidate className="rounded-2xl p-6 sm:p-7 shadow-2xl" style={{ background: "rgba(255,255,255,0.97)" }}>
          <h2 className="font-heading font-bold text-foreground text-lg mb-1">Log In to SportPass</h2>
          <p className="text-muted-foreground text-sm mb-5">Use the email and password you registered with.</p>

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="login-email" className="text-sm font-semibold text-foreground mb-1.5 block">Email Address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none pr-11"
                style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                placeholder="Enter password"
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass(p => !p)}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-heading font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-80 disabled:cursor-wait shadow-lg flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Logging in…
              </>
            ) : "Log In"}
          </button>

          {slowServer && (
            <p className="text-xs text-muted-foreground text-center mt-3" aria-live="polite">
              The server is waking up after being idle. This can take up to a minute; please wait.
            </p>
          )}


          <p className="text-center text-xs text-muted-foreground mt-5">
            New student?{" "}
            <button type="button" onClick={onRegister} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              Register here
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Forgot your password? Ask a sportfest administrator to reset it.
          </p>
        </form>

        <p className="text-center text-white/50 text-xs mt-6">
          © 2026 Nexify · Cristal e-College · Department of Computer Studies
        </p>
      </div>
    </div>
  );
}
