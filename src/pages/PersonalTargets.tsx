import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/api";
import { Target, Plus, Edit, Trash2, Users, Calendar, TrendingUp } from "lucide-react";

interface PersonalTarget {
  _id: string;
  title: string;
  description: string;
  category: string;
  targetType: string;
  targetValue: number;
  unit: string;
  month: number;
  year: number;
  targetAudience: string;
  targetDistricts: Array<{ _id: string; name: string }>;
  targetGroups: Array<{ _id: string; name: string }>;
  status: string;
  startDate: string;
  endDate: string;
  instructions?: string;
  rewards?: string;
  createdBy: { name: string; role: string };
  createdAt: string;
}

interface District {
  _id: string;
  name: string;
}

interface Group {
  _id: string;
  name: string;
  district: string;
}

const PersonalTargets = () => {
  const [targets, setTargets] = useState<PersonalTarget[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PersonalTarget | null>(null);
  const { token, user, userRole } = useAuth();
  const { toast } = useToast();

  // Check if user has permission to create/edit targets
  const canManageTargets = userRole === 'state_admin';

  // Form state - Simplified for essential fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    active: true
  });

  // Use the common API utility

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [targetsData, districtsData, groupsData] = await Promise.all([
        apiCall('/personal-targets'),
        apiCall('/districts'),
        apiCall('/groups')
      ]);

      setTargets(targetsData.data);
      setDistricts(districtsData.data);
      setGroups(groupsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const endpoint = editingTarget ? `/personal-targets/${editingTarget._id}` : '/personal-targets';
      const method = editingTarget ? 'PUT' : 'POST';

      // Prepare simplified data for API
      const targetData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        month: formData.month,
        year: formData.year,
        status: formData.active ? 'active' : 'inactive',
        // Set default values for required fields
        targetType: 'monthly',
        targetValue: 1,
        unit: 'times',
        targetAudience: 'all',
        startDate: new Date(formData.year, formData.month - 1, 1).toISOString(),
        endDate: new Date(formData.year, formData.month, 0).toISOString()
      };

      await apiCall(endpoint, {
        method,
        body: JSON.stringify(targetData)
      });

      toast({
        title: "Success",
        description: `Target ${editingTarget ? 'updated' : 'created'} successfully`
      });

      setIsCreateDialogOpen(false);
      setEditingTarget(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving target:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingTarget ? 'update' : 'create'} target`,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;

    try {
      await apiCall(`/personal-targets/${targetId}`, { method: 'DELETE' });
      toast({
        title: "Success",
        description: "Target deleted successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting target:', error);
      toast({
        title: "Error",
        description: "Failed to delete target",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'other',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      active: true
    });
  };

  const openEditDialog = (target: PersonalTarget) => {
    setEditingTarget(target);
    setFormData({
      title: target.title,
      description: target.description,
      category: target.category,
      month: target.month,
      year: target.year,
      active: target.status === 'active'
    });
    setIsCreateDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'quran': return '📖';
      case 'hadith': return '📚';
      case 'prayer': return '🤲';
      case 'charity': return '💝';
      case 'knowledge': return '🎓';
      case 'community': return '🤝';
      default: return '🎯';
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading targets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 sm:h-8 sm:w-8" />
              <span className="hidden sm:inline">Personal Targets Management</span>
              <span className="sm:hidden">Targets</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Create and manage monthly targets for members</p>
            {!canManageTargets && (
              <p className="text-xs sm:text-sm text-amber-600 mt-1">
                ⚠️ You have read-only access. Only State Admins can create/edit targets.
              </p>
            )}
          </div>
          {canManageTargets && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingTarget(null); }} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Create Target</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTarget ? 'Edit Target' : 'Create New Target'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter target title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quran">📖 Quran</SelectItem>
                      <SelectItem value="hadith">📚 Hadith</SelectItem>
                      <SelectItem value="prayer">🤲 Prayer</SelectItem>
                      <SelectItem value="charity">💝 Charity</SelectItem>
                      <SelectItem value="knowledge">🎓 Knowledge</SelectItem>
                      <SelectItem value="community">🤝 Community</SelectItem>
                      <SelectItem value="other">🎯 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the target in detail"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="month">Select Month *</Label>
                    <Select value={formData.month.toString()} onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      min="2020"
                      max="2050"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="text-sm font-medium">
                      Active Status
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Target is currently active and visible to members
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTarget ? 'Update Target' : 'Create Target'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Targets List - Mobile Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No targets created yet</p>
                  {canManageTargets ? (
                    <p className="text-sm text-muted-foreground">Create your first target to get started</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Contact your State Admin to create targets</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            targets.map((target) => (
              <Card key={target._id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                {/* Status indicator */}
                <div className={`absolute top-0 right-0 w-3 h-3 rounded-bl-lg ${
                  target.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                
                <CardContent className="p-4">
                  {/* Header with icon and title */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl flex-shrink-0">
                      {getCategoryIcon(target.category)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate">
                        {target.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {target.description}
                      </p>
                    </div>
                  </div>

                  {/* Month and Year */}
                  <div className="flex items-center gap-1 mb-3">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {months[target.month - 1]} {target.year}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={target.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs px-2 py-1"
                    >
                      {target.status}
                    </Badge>
                    
                    {/* Action buttons for mobile */}
                    {canManageTargets && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditDialog(target)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(target._id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTargets;