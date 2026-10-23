import { useEffect, useState } from "react";
import { Layout, type Screen, type Role } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { StudentManagement } from "./components/StudentManagement";
import { ActivityManagement } from "./components/ActivityManagement";
import { PerformanceTracking } from "./components/PerformanceTracking";
import { DigitalPassport } from "./components/DigitalPassport";
import { Rankings } from "./components/Rankings";
import { Attendance } from "./components/Attendance";
import { FineMonitoring } from "./components/FineMonitoring";
import { Notifications } from "./components/Notifications";
import { StudentProfile } from "./components/StudentProfile";
import { Reports } from "./components/Reports";
import { Settings } from "./components/Settings";
import { StudentQRCode } from "./components/StudentQRCode";
import { AttendanceHistory } from "./components/AttendanceHistory";
import { MyFines } from "./components/MyFines";
import { ActivityScanner } from "./components/ActivityScanner";
import { StudentActivities } from "./components/StudentActivities";
import { SportfestDays } from "./components/SportfestDays";
import { applyPrimaryColor, loadSettings } from "./lib/settings";

// Pages each role may open. The current page is kept in the address bar
// (e.g. #/students) so refreshing keeps you on it and the phone's Back
// button goes to the previous page instead of leaving the system.
const SCREENS: Record<Role, Screen[]> = {
  admin: [
    "admin-dashboard", "students", "activities", "sportfest-days", "attendance",
    "fines", "performance", "rankings", "notifications", "reports", "settings",
  ],
  student: [
    "student-dashboard", "qr-code", "attendance-history", "activities", "activity-scanner",
    "passport", "performance", "rankings", "my-fines", "notifications", "profile",
  ],
};

const homeFor = (r: Role): Screen => (r === "student" ? "student-dashboard" : "admin-dashboard");

function screenFromHash(r: Role): Screen {
  const name = window.location.hash.replace(/^#\/?/, "") as Screen;
  return SCREENS[r].includes(name) ? name : homeFor(r);
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [screen, setScreenState] = useState<Screen>("student-dashboard");

  const setScreen = (next: Screen) => {
    if (window.location.hash !== `#/${next}`) {
      window.history.pushState(null, "", `#/${next}`);
    }
    setScreenState(next);
  };

  useEffect(() => {
    if (!loggedIn) return;
    const onBack = () => setScreenState(screenFromHash(role));
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [loggedIn, role]);
  // Bumped when saved settings arrive, so reward titles etc. re-render.
  const [, setSettingsVersion] = useState(0);

  useEffect(() => {
    applyPrimaryColor();
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadSettings().then(() => setSettingsVersion((v) => v + 1));
    }
  }, [loggedIn]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        const r: Role = user.role === "admin" ? "admin" : "student";
        const start = screenFromHash(r);
        window.history.replaceState(null, "", `#/${start}`);
        setRole(r);
        setLoggedIn(true);
        setScreenState(start);
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
  }, []);

  const handleLogin = (selectedRole: Role) => {
    setRole(selectedRole);
    setLoggedIn(true);
    window.history.replaceState(null, "", `#/${homeFor(selectedRole)}`);
    setScreenState(homeFor(selectedRole));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setLoggedIn(false);
    setRegistering(false);
    setRole("student");
    setScreenState("student-dashboard");
    window.history.replaceState(null, "", window.location.pathname);
  };

  if (!loggedIn) {
    if (registering) return <RegisterPage onBack={() => setRegistering(false)} />;
    return <LoginPage onLogin={handleLogin} onRegister={() => setRegistering(true)} />;
  }

  const renderScreen = () => {
    switch (screen) {
      case "admin-dashboard": return <AdminDashboard setScreen={setScreen} />;
      case "students": return <StudentManagement />;
      case "activities":
        return role === "admin" ? <ActivityManagement /> : <StudentActivities setScreen={setScreen} />;
      case "sportfest-days": return <SportfestDays setScreen={setScreen} />;
      case "attendance": return <Attendance setScreen={setScreen} />;
      case "fines": return <FineMonitoring setScreen={setScreen} />;
      case "rankings": return <Rankings />;
      case "reports": return <Reports />;
      case "settings": return <Settings />;

      case "student-dashboard": return <StudentDashboard setScreen={setScreen} />;
      case "qr-code": return <StudentQRCode />;
      case "attendance-history": return <AttendanceHistory />;
      case "passport": return <DigitalPassport />;
      case "my-fines": return <MyFines />;
      case "notifications": return <Notifications />;
      case "profile": return <StudentProfile />;
      case "activity-scanner": return <ActivityScanner />;

      case "performance": return <PerformanceTracking />;

      default:
        return role === "student"
          ? <StudentDashboard setScreen={setScreen} />
          : <AdminDashboard setScreen={setScreen} />;
    }
  };

  return (
    <Layout
      currentScreen={screen}
      setScreen={setScreen}
      role={role}
      onLogout={handleLogout}
    >
      {renderScreen()}
    </Layout>
  );
}