import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StateAdmin from "./pages/StateAdmin";
import DistrictAdmin from "./pages/DistrictAdmin";
import ManageDistricts from "./pages/ManageDistricts";
import ManageGroups from "./pages/ManageGroups";
import TransferApprovals from "./pages/TransferApprovals";
import MeetingAgenda from "./pages/MeetingAgenda";
import CreateMeetingAgenda from "./pages/CreateMeetingAgenda";
import MeetingDetail from "./pages/MeetingDetail";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import EditMemberDetails from "./pages/EditMemberDetails";
import AddMember from "./pages/AddMember";
import BulkImport from "./pages/BulkImport";
import Meetings from "./pages/Meetings";
import Requests from "./pages/Requests";
import Notifications from "./pages/Notifications";
import SendNotification from "./pages/SendNotification";
import EditNotification from "./pages/EditNotification";
import NotificationDetail from "./pages/NotificationDetail";
import BaithulDataView from "./pages/BaithulDataView";
import MembersGroupReport from "./pages/MembersGroupReport";

import AdminMeetingsView from "./pages/AdminMeetingsView";
import MemberDashboard from "./pages/MemberDashboard";
import PersonalTargets from "./pages/PersonalTargets";
import UserManagement from "./pages/UserManagement";
import RoleManagement from "./pages/RoleManagement";
import Leaders from "./pages/Leaders";
import Announcements from "./pages/Announcements";
import OrgFiles from "./pages/OrgFiles";
import Consolidation from "./pages/Consolidation";
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
            <Route path="/dashboard" element={<ProtectedRoute requiredRoles={['group_admin']}><Dashboard /></ProtectedRoute>} />
            <Route path="/state-admin" element={<ProtectedRoute requiredRoles={['state_admin']}><StateAdmin /></ProtectedRoute>} />
            <Route path="/state-admin/districts" element={<ProtectedRoute requiredRoles={['state_admin']}><ManageDistricts /></ProtectedRoute>} />
            <Route path="/state-admin/groups" element={<ProtectedRoute requiredRoles={['state_admin']}><ManageGroups /></ProtectedRoute>} />
            <Route path="/state-admin/transfer-approvals" element={<ProtectedRoute requiredRoles={['state_admin', 'district_admin']}><TransferApprovals /></ProtectedRoute>} />
            <Route path="/state-admin/meeting-agenda" element={<ProtectedRoute requiredRoles={['state_admin']}><MeetingAgenda /></ProtectedRoute>} />
            <Route path="/state-admin/create-meeting" element={<ProtectedRoute requiredRoles={['state_admin']}><CreateMeetingAgenda /></ProtectedRoute>} />
            <Route path="/state-admin/meeting/:id" element={<ProtectedRoute requiredRoles={['state_admin']}><MeetingDetail /></ProtectedRoute>} />
            <Route path="/state-admin/send-notification" element={<ProtectedRoute requiredRoles={['state_admin']}><SendNotification /></ProtectedRoute>} />
            <Route path="/state-admin/edit-notification/:id" element={<ProtectedRoute requiredRoles={['state_admin']}><EditNotification /></ProtectedRoute>} />
            <Route path="/state-admin/notification/:id" element={<ProtectedRoute requiredRoles={['state_admin']}><NotificationDetail /></ProtectedRoute>} />
            <Route path="/state-admin/baithul-data" element={<ProtectedRoute requiredRoles={['state_admin']}><BaithulDataView /></ProtectedRoute>} />
            <Route path="/state-admin/group-reports" element={<ProtectedRoute requiredRoles={['state_admin']}><MembersGroupReport /></ProtectedRoute>} />

            <Route path="/admin/meetings-view" element={<ProtectedRoute requiredRoles={['state_admin', 'district_admin']}><AdminMeetingsView /></ProtectedRoute>} />
            <Route path="/district-admin" element={<ProtectedRoute requiredRoles={['district_admin']}><DistrictAdmin /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
            <Route path="/member/:id" element={<ProtectedRoute><MemberDetail /></ProtectedRoute>} />
            <Route path="/member/:id/edit" element={<ProtectedRoute><EditMemberDetails /></ProtectedRoute>} />
            <Route path="/add-member" element={<ProtectedRoute><AddMember /></ProtectedRoute>} />
            <Route path="/bulk-import" element={<ProtectedRoute><BulkImport /></ProtectedRoute>} />
            <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/member-dashboard" element={<ProtectedRoute requiredRoles={['member']}><MemberDashboard /></ProtectedRoute>} />
            <Route path="/personal-targets" element={<ProtectedRoute requiredRoles={['state_admin']}><PersonalTargets /></ProtectedRoute>} />
            <Route path="/state-admin/users" element={<ProtectedRoute requiredRoles={['state_admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="/role-management" element={<ProtectedRoute requiredRoles={['state_admin', 'district_admin', 'group_admin']}><RoleManagement /></ProtectedRoute>} />
            <Route path="/leaders" element={<ProtectedRoute><Leaders /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
            <Route path="/org-files" element={<ProtectedRoute><OrgFiles /></ProtectedRoute>} />
            <Route path="/consolidation" element={<ProtectedRoute requiredRoles={['state_admin']}><Consolidation /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
