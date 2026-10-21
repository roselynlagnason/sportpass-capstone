import { useEffect, useState } from "react";
import { Search, Download, Eye, Edit2, Trash2 } from "lucide-react";
import { apiFetch, API_BASE } from "../lib/api";
import { downloadCSV, fileStamp } from "../lib/reports";

interface Student {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  year: string;
  section: string;
  email: string;
  gender: string;
  contact: string;
  department: string;
  course: string;
  photo: string | null;
  status: string;
  points: number;
  attendance: number;
}

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    contact: "",
    course: "",
    year_level: "",
    gender: "",
    section: "",
  });
  const [tempPassword, setTempPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const openEdit = (s: Student) => {
    setSelected(null);
    setEditError("");
    setEditForm({
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      email: s.email || "",
      contact: s.contact === "N/A" ? "" : s.contact || "",
      course: s.course || "",
      year_level: s.year || "",
      gender: s.gender === "N/A" ? "" : s.gender || "",
      section: s.section === "N/A" ? "" : s.section || "",
    });
    setTempPassword("");
    setEditing(s);
  };

  const resetPassword = async () => {
    if (!editing) return;
    if (!window.confirm(`Reset the password for ${editing.name}? Their current password will stop working.`)) return;

    try {
      const response = await apiFetch(
        `/api/auth/students/${encodeURIComponent(editing.id)}/reset-password`,
        { method: "PUT" }
      );
      const data = await response.json();
      if (!response.ok) {
        setEditError(data.message || "Failed to reset password.");
        return;
      }
      setTempPassword(data.temporary_password);
    } catch {
      setEditError("Cannot connect to server.");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.email.trim() || !editForm.year_level) {
      setEditError("First name, last name, email and year level are required.");
      return;
    }

    try {
      setSaving(true);
      setEditError("");
      const response = await apiFetch(`/api/auth/students/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditError(data.message || "Failed to update student.");
        return;
      }

      setEditing(null);
      fetchStudents();
    } catch {
      setEditError("Cannot connect to server.");
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (s: Student) => {
    if (!window.confirm(`Delete ${s.name} (${s.id})? This also removes their login account.`)) return;

    try {
      const response = await apiFetch(`/api/auth/students/${encodeURIComponent(s.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to delete student.");
        return;
      }

      if (selected?.id === s.id) setSelected(null);
      fetchStudents();
    } catch {
      alert("Cannot connect to server.");
    }
  };

  const exportStudents = () =>
    downloadCSV(`sportpass-students-${fileStamp()}`, [
      {
        heading: "Students",
        rows: filtered,
        columns: [
          { label: "Student ID", value: (s) => s.id },
          { label: "Last Name", value: (s) => s.last_name },
          { label: "First Name", value: (s) => s.first_name },
          { label: "Course", value: (s) => s.course },
          { label: "Year", value: (s) => s.year },
          { label: "Section", value: (s) => s.section },
          { label: "Gender", value: (s) => s.gender },
          { label: "Email", value: (s) => s.email },
          { label: "Contact", value: (s) => s.contact },
        ],
      },
    ]);

  const fetchStudents = async () => {
    try {
      const response = await apiFetch("/api/auth/students");
      const data = await response.json();

      const formatted = data.map((s: any) => ({
        id: s.student_id,
        name: `${s.first_name} ${s.last_name}`,
        first_name: s.first_name,
        last_name: s.last_name,
        year: s.year_level,
        section: s.section || "N/A",
        email: s.email,
        gender: s.gender || "N/A",
        contact: s.contact || "N/A",
        department: s.department || "Computer Studies Department",
        course: s.course || "",
        photo: s.profile_photo,
        status: "active",
        points: 0,
        attendance: 0,
      }));

      setStudents(formatted);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

 const filtered = students.filter((s) => {
  const keyword = search.toLowerCase();

  const matchesSearch =
    s.name.toLowerCase().includes(keyword) ||
    s.id.toLowerCase().includes(keyword) ||
    s.email.toLowerCase().includes(keyword);

  const matchesYear =
    yearFilter === "all" || s.year === yearFilter;

  const matchesGender =
    genderFilter === "all" || s.gender === genderFilter;

  return matchesSearch && matchesYear && matchesGender;
});

  const activeCount = students.filter((s) => s.status === "active").length;
  const avgPoints =
    students.length > 0
      ? Math.round(students.reduce((a, s) => a + s.points, 0) / students.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Student Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage registered students from the SPORTPASS database
          </p>
        </div>

        <button
          onClick={exportStudents}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download size={15} />
          Export
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: students.length.toString(),
            color: "#2563EB",
            icon: "👥",
          },
          {
            label: "Active",
            value: activeCount.toString(),
            color: "#10B981",
            icon: "✅",
          },
          {
            label: "Avg. Points",
            value: avgPoints.toString(),
            color: "#8B5CF6",
            icon: "⭐",
          },
          {
            label: "Department",
            value: "CS",
            color: "#F59E0B",
            icon: "🏫",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <span className="text-xl">{s.icon}</span>
            <p
              className="text-2xl font-heading font-bold mt-2"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search by name, student ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">All Year Levels</option>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {[
                  "Student",
                  "ID",
                  "Year & Section",
                  "Email",
                  "Contact",
                  "Points",
                  "Attendance",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    Loading students...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: `hsl(${i * 36}, 60%, 50%)` }}
                        >
                          {s.photo ? (
                            <img
                              src={`${API_BASE}/uploads/${s.photo}`}
                              alt={s.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            s.name.charAt(0)
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                          {s.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {s.id}
                    </td>

                    <td className="px-5 py-3.5 text-sm text-foreground whitespace-nowrap">
                      {s.year} – Section {s.section}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {s.email}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {s.contact}
                    </td>

                    <td className="px-5 py-3.5 text-sm font-bold text-foreground">
                      {s.points}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: s.attendance >= 90 ? "#10B981" : "#F59E0B",
                        }}
                      >
                        {s.attendance}%
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-50 text-green-600">
                        {s.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelected(s)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                          style={{ color: "var(--primary)" }}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.name}`}
                          className="p-1.5 rounded-lg hover:bg-yellow-50 transition-colors text-yellow-600"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => deleteStudent(s)}
                          aria-label={`Delete ${s.name}`}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-y-0 right-0 w-full sm:w-80 z-50 border-l overflow-y-auto p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "-4px 0 40px rgba(0,0,0,0.1)",
          }}
        >
          <button
            onClick={() => setSelected(null)}
            className="text-muted-foreground hover:text-foreground text-xl mb-4"
          >
            ×
          </button>

          <div className="text-center mb-5">
            <div
              className="w-16 h-16 rounded-full mx-auto overflow-hidden flex items-center justify-center text-white text-2xl font-bold mb-3"
              style={{ background: "var(--primary)" }}
            >
              {selected.photo ? (
                <img
                  src={`${API_BASE}/uploads/${selected.photo}`}
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                selected.name.charAt(0)
              )}
            </div>

            <h3 className="font-heading font-bold text-foreground">
              {selected.name}
            </h3>
            <p className="text-muted-foreground text-sm">{selected.id}</p>
          </div>

          <div className="space-y-3">
            {[
              { label: "Course", value: selected.course || "Not set" },
              { label: "Year & Section", value: `${selected.year} – Section ${selected.section}` },
              { label: "Email", value: selected.email },
              { label: "Contact", value: selected.contact },
              { label: "Department", value: selected.department },
              { label: "Points", value: `${selected.points} pts` },
              { label: "Attendance", value: `${selected.attendance}%` },
              { label: "Status", value: selected.status },
            ].map((f) => (
              <div
                key={f.label}
                className="flex justify-between gap-3 p-3 rounded-xl"
                style={{ background: "var(--muted)" }}
              >
                <span className="text-xs text-muted-foreground font-semibold">
                  {f.label}
                </span>
                <span className="text-xs font-bold text-foreground text-right">
                  {f.value}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => openEdit(selected)}
            className="mt-5 w-full py-2.5 rounded-xl text-white text-sm font-bold"
            style={{ background: "var(--primary)" }}
          >
            Edit Details
          </button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)" }}>
            <div className="flex items-center mb-1">
              <h3 className="font-heading font-bold text-foreground">Edit Student</h3>
              <button onClick={() => setEditing(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{editing.id} · The student ID and password can't be changed here.</p>

            <div className="space-y-3">
              {[
                { key: "first_name", label: "First name" },
                { key: "last_name", label: "Last name" },
                { key: "email", label: "Email" },
                { key: "contact", label: "Contact number" },
                { key: "section", label: "Section" },
              ].map((f) => (
                <div key={f.key}>
                  <label htmlFor={`edit-${f.key}`} className="text-sm font-semibold text-foreground mb-1.5 block">{f.label}</label>
                  <input
                    id={`edit-${f.key}`}
                    value={(editForm as any)[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-year" className="text-sm font-semibold text-foreground mb-1.5 block">Year level</label>
                  <select
                    id="edit-year"
                    value={editForm.year_level}
                    onChange={(e) => setEditForm({ ...editForm, year_level: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="">Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-gender" className="text-sm font-semibold text-foreground mb-1.5 block">Gender</label>
                  <select
                    id="edit-gender"
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="">Not set</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-course" className="text-sm font-semibold text-foreground mb-1.5 block">Course</label>
                <select
                  id="edit-course"
                  value={editForm.course}
                  onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <option value="">Not set</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSCS">BSCS</option>
                </select>
              </div>

              <div className="rounded-xl p-3 border" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">For students who forgot their password.</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-muted"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    Reset Password
                  </button>
                </div>
                {tempPassword && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: "#ECFDF5" }}>
                    <p className="text-xs" style={{ color: "#065F46" }}>
                      Temporary password (shown once). Give it to the student and ask them to change it under My Profile:
                    </p>
                    <p className="font-mono font-bold text-base mt-1 select-all" style={{ color: "#065F46" }}>{tempPassword}</p>
                  </div>
                )}
              </div>

              {editError && <p className="text-sm" style={{ color: "#EF4444" }}>{editError}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--primary)" }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}