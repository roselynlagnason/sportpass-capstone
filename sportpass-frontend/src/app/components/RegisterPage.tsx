import { useEffect, useState } from "react";
import { Trophy, ArrowLeft, Upload, Check, AlertCircle, X, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "../lib/api";
import { alertDialog, confirmDialog } from "../lib/dialog";

interface RegisterPageProps {
  onBack: () => void;
}

interface InputFieldProps {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  maxLength?: number;
  onChange: (value: string) => void;
}

const fieldStyle = (error?: string) => ({
  background: "var(--input-background)",
  borderColor: error ? "#EF4444" : "var(--border)",
  color: "var(--foreground)",
});

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs mt-1" style={{ color: "#DC2626" }}>{text}</p>;
}

function RequiredLabel({ text }: { text: string }) {
  return (
    <label className="text-sm font-semibold text-foreground mb-1.5 block">
      {text} <span style={{ color: "#EF4444" }}>*</span>
    </label>
  );
}

function InputField({ label, value, type = "text", placeholder, error, autoComplete, inputMode, maxLength, onChange }: InputFieldProps) {
  return (
    <div>
      <RequiredLabel text={label} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={!!error}
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
        style={fieldStyle(error)}
      />
      <FieldError text={error} />
    </div>
  );
}

// Standard password rules, checked live while the student types.
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p) => /\d/.test(p) },
  { label: "One special character (e.g. ! @ # $ %)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { label: "No spaces", test: (p) => p.length > 0 && !/\s/.test(p) },
];
const passwordProblems = (p: string) => PASSWORD_RULES.filter((r) => !r.test(p));

interface PasswordFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}

// Password input with a show/hide button.
function PasswordField({ label, value, placeholder, error, onChange }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <RequiredLabel text={label} />
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          maxLength={64}
          aria-invalid={!!error}
          className="w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm outline-none transition-all"
          style={fieldStyle(error)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError text={error} />
    </div>
  );
}

// Live checklist + strength bar under the password.
function PasswordChecklist({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const total = PASSWORD_RULES.length;
  const strength = !password ? "" : passed <= 3 ? "Weak" : passed < total ? "Fair" : "Strong";
  const color = strength === "Strong" ? "#16A34A" : strength === "Fair" ? "#F59E0B" : "#EF4444";
  return (
    <div className="-mt-1 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(passed / total) * 100}%`, background: password ? color : "transparent" }}
          />
        </div>
        {strength && (
          <span className="text-xs font-semibold" style={{ color }}>
            {strength}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className="flex items-center gap-1.5 text-xs" style={{ color: ok ? "#16A34A" : "var(--muted-foreground)" }}>
              {ok ? <Check size={12} /> : <X size={12} />}
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only school email addresses can register.
const SCHOOL_DOMAIN = "cec.edu.ph";
// Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes allowed)
const PH_MOBILE_RE = /^(09|\+639)\d{9}$/;
// School student ID numbers: exactly 9 digits, e.g. 202310259.
const STUDENT_ID_RE = /^\d{9}$/;
const STUDENT_ID_MSG = "Student ID must be exactly 9 digits, like 202310259.";
const ID_TAKEN_MSG = "This student ID is already registered. If it's yours, log in instead.";

type IdStatus = "idle" | "checking" | "ok" | "taken" | "error";

// Asks the server whether this student ID is free.
async function fetchIdStatus(id: string): Promise<IdStatus> {
  try {
    const res = await apiFetch(`/api/auth/check-student-id/${encodeURIComponent(id)}`);
    if (!res.ok) return "error";
    const data = await res.json();
    if (!data.valid) return "idle";
    return data.available ? "ok" : "taken";
  } catch {
    return "error";
  }
}

export function RegisterPage({ onBack }: RegisterPageProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Show the chosen photo, and free the preview when it changes.
  useEffect(() => {
    if (!profilePhoto) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(profilePhoto);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profilePhoto]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
    email: "",
    year: "",
    gender: "",
    section: "",
    contact: "",
    password: "",
    confirmPassword: "",
  });

  // Live check: is this student ID already registered?
  const [idStatus, setIdStatus] = useState<IdStatus>("idle");
  useEffect(() => {
    const id = form.studentId.trim();
    if (!STUDENT_ID_RE.test(id)) {
      setIdStatus("idle");
      return;
    }
    setIdStatus("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const status = await fetchIdStatus(id);
      if (cancelled) return;
      setIdStatus(status);
      if (status === "taken") setErrors((p) => ({ ...p, studentId: ID_TAKEN_MSG }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.studentId]);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Checks the fields on one step; returns the problems found.
  const validateStep = (which: number): Errors => {
    const e: Errors = {};
    const t = (v: string) => v.trim();

    if (which === 1) {
      if (!t(form.firstName)) e.firstName = "Enter your first name.";
      if (!t(form.lastName)) e.lastName = "Enter your last name.";
      if (!t(form.studentId)) e.studentId = "Enter your student ID.";
      else if (!STUDENT_ID_RE.test(t(form.studentId))) e.studentId = STUDENT_ID_MSG;
      else if (idStatus === "taken") e.studentId = ID_TAKEN_MSG;
      if (!t(form.email)) e.email = "Enter your email address.";
      else if (!EMAIL_RE.test(t(form.email))) e.email = `Enter a valid email, like santos.maria@${SCHOOL_DOMAIN}.`;
      else if (!t(form.email).toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`))
        e.email = `Use your school email address (ending in @${SCHOOL_DOMAIN}).`;
      const phone = form.contact.replace(/[\s-]/g, "");
      if (!phone) e.contact = "Enter your contact number.";
      else if (!PH_MOBILE_RE.test(phone)) e.contact = "Enter an 11-digit mobile number, like 09171234567.";
      if (!form.gender) e.gender = "Select your gender.";
      if (!profilePhoto) e.photo = "Upload a profile photo.";
    }

    if (which === 2) {
      if (!form.year) e.year = "Select your year level.";
      if (!t(form.section)) e.section = "Enter your section.";
    }

    if (which === 3) {
      if (!form.password) e.password = "Create a password.";
      else if (passwordProblems(form.password).length > 0)
        e.password = "Your password doesn't meet all the requirements below.";
      if (!form.confirmPassword) e.confirmPassword = "Re-enter your password.";
      else if (form.password && form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
      if (!agreed) e.agreed = "Please agree to the terms to continue.";
    }

    return e;
  };

  const goNext = async () => {
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // Make sure the student ID was checked before leaving step 1.
    if (step === 1 && idStatus !== "ok") {
      setIdStatus("checking");
      const status = await fetchIdStatus(form.studentId.trim());
      setIdStatus(status);
      if (status === "taken") {
        setErrors((p) => ({ ...p, studentId: ID_TAKEN_MSG }));
        return;
      }
      // If the check itself failed (e.g. offline), the server still refuses
      // duplicates when the form is submitted, so let the student continue.
    }
    if (step < 3) setStep((s) => s + 1);
    else handleRegister();
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((p) => ({ ...p, photo: "Use a JPG, PNG or WEBP image." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((p) => ({ ...p, photo: "Photo must be 2 MB or smaller." }));
      return;
    }
    setProfilePhoto(file);
    setErrors((p) => {
      const next = { ...p };
      delete next.photo;
      return next;
    });
  };

  const handleRegister = async () => {
    // Re-check every step in case something was cleared after moving on.
    for (const n of [1, 2, 3]) {
      const found = validateStep(n);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(n);
        return;
      }
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("student_id", form.studentId.trim());
      formData.append("first_name", form.firstName.trim());
      formData.append("last_name", form.lastName.trim());
      formData.append("email", form.email.trim());
      formData.append("password", form.password);
      formData.append("year_level", form.year);
      formData.append("gender", form.gender);
      formData.append("section", form.section.trim().toUpperCase());
      formData.append("contact", form.contact.replace(/[\s-]/g, ""));

      if (profilePhoto) {
        formData.append("profile_photo", profilePhoto);
      }

      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alertDialog(data.message || "Registration failed.");
        return;
      }

      alertDialog({ title: "Registration successful", message: "Your account is ready. You can now log in.", tone: "success" });
      onBack();
    } catch (error) {
      alertDialog("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1E3A6E 0%, #2563EB 50%, #1E293B 100%)",
      }}
    >
      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-heading font-bold">Student Registration</h1>
          <p className="text-white/60 text-sm mt-1">SPORTPASS · Cristal e-College</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background:
                    step > s ? "#10B981" : step === s ? "var(--primary)" : "rgba(255,255,255,0.15)",
                }}
              >
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-green-400" : "bg-white/20"}`} />}
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-16 text-xs text-white/50 mb-6">
          <span className={step === 1 ? "text-white font-semibold" : ""}>Personal Info</span>
          <span className={step === 2 ? "text-white font-semibold" : ""}>Academic Info</span>
          <span className={step === 3 ? "text-white font-semibold" : ""}>Account Setup</span>
        </div>

        <div className="rounded-2xl p-5 sm:p-7 shadow-2xl" style={{ background: "rgba(255,255,255,0.95)" }}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Personal Information</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="First Name" value={form.firstName} placeholder="e.g. Maria" autoComplete="given-name" error={errors.firstName} onChange={(v) => update("firstName", v)} />
                <InputField label="Last Name" value={form.lastName} placeholder="e.g. Santos" autoComplete="family-name" error={errors.lastName} onChange={(v) => update("lastName", v)} />
              </div>

              <div>
                <InputField label="Student ID" value={form.studentId} placeholder="e.g. 202310259" inputMode="numeric" maxLength={9} error={errors.studentId} onChange={(v) => update("studentId", v.replace(/\D/g, "").slice(0, 9))} />
                {!errors.studentId && (
                  <p className="text-xs mt-1" style={{ color: idStatus === "ok" ? "#16A34A" : "var(--muted-foreground)" }} aria-live="polite">
                    {idStatus === "checking"
                      ? "Checking student ID…"
                      : idStatus === "ok"
                      ? "✓ Student ID is available"
                      : form.studentId.length > 0 && form.studentId.length < 9
                      ? `${form.studentId.length}/9 digits`
                      : "9 digits, numbers only"}
                  </p>
                )}
              </div>
              <InputField label="School Email Address" value={form.email} type="email" placeholder="e.g. santos.maria@cec.edu.ph" autoComplete="email" inputMode="email" error={errors.email} onChange={(v) => update("email", v)} />
              <InputField
                  label="Contact Number"
                  value={form.contact}
                  type="tel"
                  placeholder="e.g. 0917 123 4567"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={16}
                  error={errors.contact}
                  onChange={(v) => update("contact", v)}
                />

                <div>
                  <RequiredLabel text="Gender" />
                  <select
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                    aria-invalid={!!errors.gender}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={fieldStyle(errors.gender)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <FieldError text={errors.gender} />
                </div>
              <div>
                
                <RequiredLabel text="Profile Photo" />

                {photoPreview ? (
                  <div
                    className="flex items-center gap-4 p-3 rounded-xl border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <img
                      src={photoPreview}
                      alt="Your profile photo"
                      className="w-20 h-20 rounded-full object-cover flex-shrink-0 border-2"
                      style={{ borderColor: "var(--primary)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{profilePhoto?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profilePhoto ? `${(profilePhoto.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <label
                          className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-muted"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Change
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                            onChange={(e) => {
                              pickPhoto(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setProfilePhoto(null)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50"
                        >
                          <X size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                <label
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors block"
                  style={{ borderColor: errors.photo ? "#EF4444" : "var(--border)" }}
                >
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={(e) => {
                      pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />

                  <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tap to upload a clear photo of your face</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP, up to 2 MB</p>
                </label>
                )}
                <FieldError text={errors.photo} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Academic Information</h2>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Program</label>
                <input
                  value="BS Information Technology (BSIT)"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none opacity-80"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <RequiredLabel text="Year Level" />
                  <select
                    value={form.year}
                    onChange={(e) => update("year", e.target.value)}
                    aria-invalid={!!errors.year}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={fieldStyle(errors.year)}
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                  <FieldError text={errors.year} />
                </div>

                <InputField label="Section" value={form.section} placeholder="e.g. A" maxLength={10} error={errors.section} onChange={(v) => update("section", v)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Account Setup</h2>

              <PasswordField label="Create Password" value={form.password} placeholder="e.g. Sportpass@2026" error={errors.password} onChange={(v) => update("password", v)} />
              <PasswordChecklist password={form.password} />
              <PasswordField label="Confirm Password" value={form.confirmPassword} placeholder="Type it again" error={errors.confirmPassword} onChange={(v) => update("confirmPassword", v)} />
              {form.confirmPassword && !errors.confirmPassword && (
                <p className="-mt-2 text-xs" style={{ color: form.password === form.confirmPassword ? "#16A34A" : "#EF4444" }}>
                  {form.password === form.confirmPassword ? "✓ Passwords match" : "Passwords do not match yet"}
                </p>
              )}

              <div
                className="rounded-xl p-4"
                style={{
                  background: "#EFF6FF",
                  borderLeft: "3px solid var(--primary)",
                }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--primary)" }}>
                  Account Terms
                </p>
                <p className="text-xs text-muted-foreground">
                  By creating an account, you agree to use SPORTPASS only for authorized Sportfest activities.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked) setErrors((p) => { const n = { ...p }; delete n.agreed; return n; });
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the terms and conditions of SPORTPASS
                </span>
              </label>
              <FieldError text={errors.agreed} />
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl mt-5 text-sm" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>Please complete the fields marked in red. All fields are required.</span>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                if (step === 1) onBack();
                else setStep((s) => s - 1);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold text-foreground hover:bg-muted transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <ArrowLeft size={15} />
              {step === 1 ? "Back to Login" : "Previous"}
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              }}
            >
              {loading ? "Creating Account..." : step < 3 ? "Continue" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}