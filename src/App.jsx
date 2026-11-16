import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import StaffLoginPage from "./pages/auth/StaffLoginPage";

import ResidentDashboard from "./pages/resident/ResidentDashboard";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import WorkStatusBoard from "./pages/public/WorkStatusBoard";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/:role/login"
          element={<StaffLoginPage />}
        />

        <Route
          path="/resident"
          element={
            <ProtectedRoute allowedRole="resident">
              <ResidentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/technician"
          element={
            <ProtectedRoute allowedRole="technician">
              <TechnicianDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRole="manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Public page: login is not required */}
        <Route path="/work-status" element={<WorkStatusBoard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;