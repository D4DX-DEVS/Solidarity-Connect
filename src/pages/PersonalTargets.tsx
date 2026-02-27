import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
import { Target, Plus, Edit, Trash2, Calendar, ArrowLeft, Clock } from "lucide-react";

interface PersonalTarget {
  _id: string;
  title: string;
  description: string;
  category: string;
  targetAudience: string;
  status: string;
  startDate: string;
  endDate: string;
  instructions?: string;
  rewards?: string;
  createdBy: { name: string; role: string };
  createdAt: string;
}

// Format a Date to "yyyy-MM-ddTHH:mm" for datetime-local input
const toDatetimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocal(d);
};

const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocal(d);
};

const PersonalTargets = () => {
  const navigate = useNavigate();
  const [targets, setTargets] = useState<PersonalTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PersonalTarget | null>(null);
  const { userRole } = useAuth();
  const { toast } = useToast();

  const canManageTargets = userRole === 'state_admin';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    startDate: defaultStart(),
    endDate: defaultEnd(),
    active: true,
    targetAudience: 'all_users' as string,
    instructions: '',
    rewards: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const targetsData = await apiCall('/personal-targets');
      setTargets(targetsData.data);
    } catch {
      toast({ title: "Error", description: "Failed to load targets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast({ title: "Invalid dates", description: "End date must be after start date", variant: "destructive" });
      return;
    }

    try {
      const endpoint = editingTarget ? `/personal-targets/${editingTarget._id}` : '/personal-targets';
      const method = editingTarget ? 'PUT' : 'POST';

      const start = new Date(formData.startDate);
      const targetData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        status: formData.active ? 'active' : 'inactive',
        targetType: 'monthly',
        targetValue: 1,
        unit: 'times',
        targetAudience: formData.targetAudience,
        instructions: formData.instructions,
        rewards: formData.rewards,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString()
      };

      await apiCall(endpoint, { method, body: JSON.stringify(targetData) });

      toast({ title: "Success", description: `Target ${editingTarget ? 'updated' : 'created'} successfully` });
      setIsCreateDialogOpen(false);
      setEditingTarget(null);
      resetForm();
      fetchData();
    } catch {
      toast({ title: "Error", description: `Failed to ${editingTarget ? 'update' : 'create'} target`, variant: "destructive" });
    }
  };

  const handleDelete = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    try {
      await apiCall(`/personal-targets/${targetId}`, { method: 'DELETE' });
      toast({ title: "Success", description: "Target deleted successfully" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to delete target", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'other',
      startDate: defaultStart(),
      endDate: defaultEnd(),
      active: true,
      targetAudience: 'all_users',
      instructions: '',
      rewards: ''
    });
  };

  const openEditDialog = (target: PersonalTarget) => {
    setEditingTarget(target);
    setFormData({
      title: target.title,
      description: target.description,
      category: target.category,
      startDate: toDatetimeLocal(new Date(target.startDate)),
      endDate: toDatetimeLocal(new Date(target.endDate)),
      active: target.status === 'active',
      targetAudience: target.targetAudience || 'all_users',
      instructions: target.instructions || '',
      rewards: target.rewards || ''
    });
    setIsCreateDialogOpen(true);
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    return {
      start: `${fmt(startDate)}, ${fmtTime(startDate)}`,
      end: `${fmt(endDate)}, ${fmtTime(endDate)}`
    };
  };

  const isCurrentlyActive = (target: PersonalTarget) => {
    const now = new Date();
    return target.status === 'active' &&
      new Date(target.startDate) <= now &&
      new Date(target.endDate) >= now;
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

  const AUDIENCE_LABELS: Record<string, string> = {
    all_users: 'All Users',
    members_only: 'Members Only',
    group_admins: 'Group Admins',
    area_admins: 'Area Admins',
    district_admins: 'District Admins'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading targets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Personal Targets</h1>
            <p className="text-sm text-muted-foreground">Create and manage targets for users</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
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
                  <DialogTitle>{editingTarget ? 'Edit Target' : 'Create New Target'}</DialogTitle>
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

                  {/* Start & End Date with Time */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="startDate">Start Date & Time *</Label>
                      <Input
                        id="startDate"
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date & Time *</Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="active" className="text-sm font-medium">Active Status</Label>
                      <p className="text-xs text-muted-foreground">
                        Target is visible only when active and within the date range
                      </p>
                    </div>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                  </div>

                  <div>
                    <Label>Target Audience *</Label>
                    <Select
                      value={formData.targetAudience}
                      onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_users">All Users</SelectItem>
                        <SelectItem value="members_only">Members Only</SelectItem>
                        <SelectItem value="group_admins">Group Admins Only</SelectItem>
                        <SelectItem value="area_admins">Area Admins Only</SelectItem>
                        <SelectItem value="district_admins">District Admins Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="instructions">Instructions (Optional)</Label>
                    <Textarea
                      id="instructions"
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      placeholder="How to complete this target..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="rewards">Rewards (Optional)</Label>
                    <Input
                      id="rewards"
                      value={formData.rewards}
                      onChange={(e) => setFormData({ ...formData, rewards: e.target.value })}
                      placeholder="Reward for completing this target..."
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

        {/* Targets Grid */}
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
            targets.map((target) => {
              const active = isCurrentlyActive(target);
              const { start, end } = formatDateRange(target.startDate, target.endDate);
              return (
                <Card key={target._id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`absolute top-0 right-0 w-3 h-3 rounded-bl-lg ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl flex-shrink-0">{getCategoryIcon(target.category)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight truncate">{target.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{target.description}</p>
                      </div>
                    </div>

                    {/* Date range */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          <span className="font-medium">From:</span> {start}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          <span className="font-medium">To:</span> {end}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={active ? 'default' : 'secondary'}
                          className={`text-xs px-2 py-0.5 ${
                            active ? 'bg-green-600' :
                            target.status === 'active' && new Date(target.startDate) > new Date() ? 'bg-amber-500 text-white' :
                            target.status === 'active' && new Date(target.endDate) < new Date() ? 'bg-gray-400 text-white' : ''
                          }`}
                        >
                          {active ? 'Active' :
                            target.status === 'active' && new Date(target.startDate) > new Date() ? 'Scheduled' :
                            target.status === 'active' && new Date(target.endDate) < new Date() ? 'Expired' :
                            'Inactive'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {AUDIENCE_LABELS[target.targetAudience] || target.targetAudience}
                        </span>
                      </div>
                      {canManageTargets && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(target)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(target._id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTargets;
