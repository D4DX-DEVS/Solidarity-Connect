import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/Login";
import RoleSelection from "./pages/RoleSelection";
import Dashboard from "./pages/Dashboard";
import StateAdmin from "./pages/StateAdmin";
import DistrictAdmin from "./pages/DistrictAdmin";
import ManageDistricts from "./pages/ManageDistricts";
import ManageGroups from "./pages/ManageGroups";
import TransferApprovals from "./pages/TransferApprovals";
import MeetingAgenda from "./pages/MeetingAgenda";
import CreateMeetingAgenda from "./pages/CreateMeetingAgenda";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import AddMember from "./pages/AddMember";
import BulkImport from "./pages/BulkImport";
import Meetings from "./pages/Meetings";
import Requests from "./pages/Requests";
import Notifications from "./pages/Notifications";
import SendNotification from "./pages/SendNotification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/role-selection" element={<RoleSelection />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/state-admin" element={<StateAdmin />} />
            <Route path="/state-admin/districts" element={<ManageDistricts />} />
            <Route path="/state-admin/groups" element={<ManageGroups />} />
            <Route path="/state-admin/transfer-approvals" element={<TransferApprovals />} />
            <Route path="/state-admin/meeting-agenda" element={<MeetingAgenda />} />
            <Route path="/state-admin/create-meeting" element={<CreateMeetingAgenda />} />
            <Route path="/state-admin/send-notification" element={<SendNotification />} />
            <Route path="/district-admin" element={<DistrictAdmin />} />
            <Route path="/members" element={<Members />} />
            <Route path="/member/:id" element={<MemberDetail />} />
            <Route path="/add-member" element={<AddMember />} />
            <Route path="/bulk-import" element={<BulkImport />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/notifications" element={<Notifications />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
