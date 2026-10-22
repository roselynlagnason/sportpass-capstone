import { useState } from "react";
import { Trophy, ArrowLeft, Upload, Check } from "lucide-react";
import { apiFetch } from "../lib/api";

interface RegisterPageProps {
  onBack: () => void;
}

interface InputFieldProps {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function InputField({ label, value, type = "text", placeholder, onChange }: InputFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
        style={{
          background: "var(--input-background)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      />
    </div>
  );
}

export function RegisterPage({ onBack }: RegisterPageProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

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
  };

  const handleRegister = async () => {
    if (
      !form.firstName ||
      !form.lastName ||
      !form.studentId ||
      !form.email ||
      !form.year ||
      !form.password ||
      !form.confirmPassword
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    if (form.password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (!agreed) {
      alert("Please agree to the terms and conditions.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("student_id", form.studentId);
      formData.append("first_name", form.firstName);
      formData.append("last_name", form.lastName);
      formData.append("email", form.email);
      formData.append("password", form.password);
      formData.append("year_level", form.year);
      formData.append("gender", form.gender);
      formData.append("section", form.section);
      formData.append("contact", form.contact);

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

      alert("Registration successful!");
      onBack();
    } catch (error) {
      alert("Cannot connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
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

        <div className="rounded-2xl p-7 shadow-2xl" style={{ background: "rgba(255,255,255,0.95)" }}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Personal Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <InputField label="First Name" value={form.firstName} placeholder="Juan" onChange={(v) => update("firstName", v)} />
                <InputField label="Last Name" value={form.lastName} placeholder="Dela Cruz" onChange={(v) => update("lastName", v)} />
              </div>

              <InputField label="Student ID" value={form.studentId} placeholder="202310259" onChange={(v) => update("studentId", v)} />
              <InputField label="Email Address" value={form.email} type="email" placeholder="surname.name@cec.edu.ph" onChange={(v) => update("email", v)} />
              <InputField
                  label="Contact Number"
                  value={form.contact}
                  placeholder="+63 912 345 6789"
                  onChange={(v) => update("contact", v)}
                />

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Gender
                  </label>

                  <select
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              <div>
                
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Profile Photo</label>

                <label
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors block"
                  style={{ borderColor: "var(--border)" }}
                >
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 2 * 1024 * 1024) {
                        alert("Photo must be less than 2MB.");
                        return;
                      }

                      setProfilePhoto(file);
                    }}
                  />

                  <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {profilePhoto ? profilePhoto.name : "Click to upload photo"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Academic Information</h2>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Department</label>
                <input
                  value="Computer Studies Department"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none opacity-80"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Course</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Year Level</label>
                  <select
                    value={form.year}
                    onChange={(e) => update("year", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="">Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <InputField label="Section" value={form.section} placeholder="A, B, C..." onChange={(v) => update("section", v)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-foreground mb-4">Account Setup</h2>

              <InputField label="Create Password" value={form.password} type="password" placeholder="Min. 8 characters" onChange={(v) => update("password", v)} />
              <InputField label="Confirm Password" value={form.confirmPassword} type="password" placeholder="Re-enter password" onChange={(v) => update("confirmPassword", v)} />

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
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the terms and conditions of SPORTPASS
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => (step === 1 ? onBack() : setStep((s) => s - 1))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold text-foreground hover:bg-muted transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <ArrowLeft size={15} />
              {step === 1 ? "Back to Login" : "Previous"}
            </button>

            <button
              type="button"
              onClick={() => (step < 3 ? setStep((s) => s + 1) : handleRegister())}
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