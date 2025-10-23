import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  Shield,
  Building2,
  UserCog
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usersAPI, districtsAPI, groupsAPI } from "@/utils/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'state_admin' | 'district_admin' | 'group_admin';
  district?: {
    _id: string;
    name: string;
    code: string;
  };
  group?: {
    _id: string;
    name: string;
    code: string;
  };
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface District {
  _id: string;
  name: string;
  code: string;
}

interface Group {
  _id: string;
  name: string;
  code: string;
  district: string;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  stateAdmins: number;
  districtAdmins: number;
  groupAdmins: number;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    district: "",
    group: ""
  });

  const roleLabels = {
    state_admin: "State Admin", 
    district_admin: "District Admin",
    group_admin: "Group Admin"
  };

  const roleColors = {
    state_admin: "bg-blue-100 text-blue-800",
    district_admin: "bg-green-100 text-green-800", 
    group_admin: "bg-orange-100 text-orange-800"
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch users
      const usersResult = await usersAPI.getUsers({ limit: 100 });
      setUsers(usersResult.data);

      // Fetch user stats
      const statsResult = await usersAPI.getUserStats();
      setUserStats(statsResult.data.statistics);

      // Fetch districts - get all active districts without pagination limit
      const districtsResult = await districtsAPI.getDistricts({ limit: 100, isActive: true });
      setDistricts(districtsResult.data);

      // Fetch groups - get all active groups without pagination limit
      const groupsResult = await groupsAPI.getGroups({ limit: 100, isActive: true });
      setGroups(groupsResult.data);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async () => {
    try {
      const result = await usersAPI.createUser(formData);
      
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setShowCreateDialog(false);
      setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const result = await usersAPI.updateUser(editingUser._id, formData);
      
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setEditingUser(null);
      setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user", 
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const result = await usersAPI.toggleUserStatus(userId);
      
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const result = await usersAPI.deleteUser(userId);
      
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email || "",
      role: user.role,
      district: user.district?._id || "",
      group: user.group?._id || ""
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm) ||
                         (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = !roleFilter || roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = !statusFilter || statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });



  // Filter groups based on selected district - groups are loaded from models/database
  const filteredGroups = groups.filter(group => 
    !formData.district || group.district === formData.district
  );

  // Function to fetch groups for a specific district
  const fetchGroupsForDistrict = async (districtId: string) => {
    if (!districtId) {
      return;
    }
    
    setLoadingGroups(true);
    try {
      const result = await groupsAPI.getGroups({ district: districtId, limit: 100, isActive: true });
      
      // Update groups state with district-specific groups
      const districtGroups = result.data;
      setGroups(prevGroups => {
        // Remove existing groups for this district and add new ones
        const otherGroups = prevGroups.filter(g => g.district !== districtId);
        return [...otherGroups, ...districtGroups];
      });
    } catch (error) {
      console.error('Error fetching district groups:', error);
      toast({
        title: "Error",
        description: "Failed to load groups for selected district",
        variant: "destructive",
      });
    } finally {
      setLoadingGroups(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage admin users and permissions</p>
          </div>
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            Back
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Statistics Cards */}
        {userStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-primary">{userStats.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{userStats.activeUsers}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <UserCheck className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{userStats.stateAdmins}</p>
                    <p className="text-xs text-muted-foreground">State Admins</p>
                  </div>
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{userStats.districtAdmins}</p>
                    <p className="text-xs text-muted-foreground">District Admins</p>
                  </div>
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
              
              <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="state_admin">State Admin</SelectItem>
                    <SelectItem value="district_admin">District Admin</SelectItem>
                    <SelectItem value="group_admin">Group Admin</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card key={user._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>📱 {user.phone}</p>
                      {user.email && <p>✉️ {user.email}</p>}
                      {user.district && <p>🏢 {user.district.name}</p>}
                      {user.group && <p>👥 {user.group.name}</p>}
                      <p>📅 Created: {new Date(user.createdAt).toLocaleDateString()}</p>
                      {user.lastLogin && (
                        <p>🕒 Last login: {new Date(user.lastLogin).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(user._id)}>
                        {user.isActive ? (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteUser(user._id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {searchTerm || roleFilter || statusFilter 
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first user"
                }
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create/Edit User Dialog */}
      <Dialog open={showCreateDialog || !!editingUser} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingUser(null);
          setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Create New User"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91XXXXXXXXXX"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="state_admin">State Admin</SelectItem>
                  <SelectItem value="district_admin">District Admin</SelectItem>
                  <SelectItem value="group_admin">Group Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.role === 'district_admin' || formData.role === 'group_admin') && (
              <div>
                <Label htmlFor="district">District *</Label>
                <Select value={formData.district} onValueChange={(value) => {
                  setFormData({ ...formData, district: value, group: "" });
                  // Fetch groups for the selected district
                  if (value) {
                    fetchGroupsForDistrict(value);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name} ({district.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.role === 'group_admin' && formData.district && (
              <div>
                <Label htmlFor="group">Group *</Label>
                <Select 
                  value={formData.group} 
                  onValueChange={(value) => setFormData({ ...formData, group: value })} 
                  disabled={loadingGroups || filteredGroups.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      loadingGroups 
                        ? "Loading groups..." 
                        : filteredGroups.length === 0 
                          ? "No groups available" 
                          : "Select group"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredGroups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingGroups && (
                  <p className="text-sm text-muted-foreground mt-1">Loading groups for selected district...</p>
                )}
                {!loadingGroups && filteredGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">No groups available in this district</p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="flex-1"
                disabled={!formData.name || !formData.phone || !formData.role}
              >
                {editingUser ? "Update User" : "Create User"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingUser(null);
                  setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default UserManagement;