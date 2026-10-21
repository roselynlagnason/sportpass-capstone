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

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [screen, setScreen] = useState<Screen>("student-dashboard");
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
      const user = JSON.parse(savedUser);
      setRole(user.role);
      setLoggedIn(true);
      setScreen(user.role === "student" ? "student-dashboard" : "admin-dashboard");
    }
  }, []);

  const handleLogin = (selectedRole: Role) => {
    setRole(selectedRole);
    setLoggedIn(true);
    setScreen(selectedRole === "student" ? "student-dashboard" : "admin-dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setLoggedIn(false);
    setRegistering(false);
    setRole("student");
    setScreen("student-dashboard");
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
        return role === "admin" ? <ActivityManagement /> : <StudentActivities />;
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