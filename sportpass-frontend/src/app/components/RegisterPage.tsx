import { useEffect, useState } from "react";
import { Trophy, ArrowLeft, Upload, Check, AlertCircle, X } from "lucide-react";
import { apiFetch } from "../lib/api";

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

type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes allowed)
const PH_MOBILE_RE = /^(09|\+639)\d{9}$/;

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
      else if (!/^[0-9-]+$/.test(t(form.studentId))) e.studentId = "Use numbers only (dashes allowed).";
      if (!t(form.email)) e.email = "Enter your email address.";
      else if (!EMAIL_RE.test(t(form.email))) e.email = "Enter a valid email, like name@gmail.com.";
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
      else if (form.password.length < 8) e.password = "Use at least 8 characters.";
      if (!form.confirmPassword) e.confirmPassword = "Re-enter your password.";
      else if (form.password && form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
      if (!agreed) e.agreed = "Please agree to the terms to continue.";
    }

    return e;
  };

  const goNext = () => {
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
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
        alert(data.message || "Registration failed.");
        return;
      }

      alert("Registration successful! You can now log in.");
      onBack();
    } catch (error) {
      alert("Can't reach the server. Check your internet connection and try again.");
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

              <InputField label="Student ID" value={form.studentId} placeholder="e.g. 2024-00123" inputMode="numeric" maxLength={20} error={errors.studentId} onChange={(v) => update("studentId", v)} />
              <InputField label="Email Address" value={form.email} type="email" placeholder="e.g. maria.santos@gmail.com" autoComplete="email" inputMode="email" error={errors.email} onChange={(v) => update("email", v)} />
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

              <InputField label="Create Password" value={form.password} type="password" placeholder="At least 8 characters" autoComplete="new-password" error={errors.password} onChange={(v) => update("password", v)} />
              <InputField label="Confirm Password" value={form.confirmPassword} type="password" placeholder="Type it again" autoComplete="new-password" error={errors.confirmPassword} onChange={(v) => update("confirmPassword", v)} />

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