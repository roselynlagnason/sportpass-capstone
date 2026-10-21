import { useState } from "react";
import { Trophy, Eye, EyeOff, AlertCircle } from "lucide-react";
import type { Role } from "./Layout";
import { apiFetch } from "../lib/api";



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

 const handleLogin = async () => {
  setError("");

  if (!email || !password) {
    setError("Please enter your email and password.");
    return;
  }

  try {
    setLoading(true);

    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Login failed.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    onLogin(data.user.role);
  } catch (error) {
    setError("Cannot connect to server.");
  } finally {
    setLoading(false);
  }
};

  

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
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
        <div className="rounded-2xl p-7 shadow-2xl" style={{ background: "rgba(255,255,255,0.97)" }}>
          <h2 className="font-heading font-bold text-foreground text-lg mb-1">Log In to SportPass</h2>
          <p className="text-muted-foreground text-sm mb-5">Enter your credentials to continue</p>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm" style={{ background: "#FEF2F2", color: "#EF4444" }}>
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-foreground mb-1.5 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              placeholder="yourname@sportpass.edu.ph"
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none pr-11"
                style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                placeholder="Enter password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass(p => !p)}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-heading font-bold text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in...
              </>
            ) : "Log In"}
          </button>

          {/* <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs text-muted-foreground mb-2.5 text-center font-semibold">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fillDemo("admin")}
                className="py-2 px-3 rounded-xl border text-xs font-semibold text-left transition-all hover:border-primary hover:bg-primary/5"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="font-bold" style={{ color: "var(--primary)" }}>Administrator</p>
                <p className="text-muted-foreground text-xs mt-0.5 truncate">admin@sportpass.edu.ph</p>
              </button>
              <button
                onClick={() => fillDemo("student")}
                className="py-2 px-3 rounded-xl border text-xs font-semibold text-left transition-all hover:border-accent hover:bg-accent/5"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="font-bold" style={{ color: "var(--accent)" }}>Student</p>
                <p className="text-muted-foreground text-xs mt-0.5 truncate">student@sportpass.edu.ph</p>
              </button>
            </div>
          </div> */}

          <p className="text-center text-xs text-muted-foreground mt-5">
            New student?{" "}
            <button onClick={onRegister} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              Register here
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Forgot your password? Ask a sportfest administrator to reset it.
          </p>
        </div>

        <p className="text-center text-white/25 text-xs mt-6">
          ©Nexify 2026 Cristal e-College · Department of Computer Studies
        </p>
      </div>
    </div>
  );
}
