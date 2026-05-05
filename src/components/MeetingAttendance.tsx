import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/app/AppShell';
import { Users, Check, X, Search, Plus } from 'lucide-react';
import { meetingsApi } from '@/lib/meetings';
import { useToast } from '@/hooks/use-toast';

interface Member {
  _id: string;
  name: string;
  phone: string;
  status: string;
  isApproved: boolean;
}

interface MeetingAttendanceProps {
  meeting: any;
  userGroup: any;
  onRefresh: () => void;
}

export const MeetingAttendance = ({ meeting, userGroup, onRefresh }: MeetingAttendanceProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [guests, setGuests] = useState<Array<{ name: string; phone?: string }>>([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Load group members and existing guests
  useEffect(() => {
    const loadData = async () => {
      if (!userGroup?._id || members.length > 0) return; // Prevent repeated calls
      
      try {
        const response = await meetingsApi.getGroupMembers(userGroup._id);
        const membersList = response.data || [];
        setMembers(membersList);
        
        // Initialize attendance with smart defaults
        const initialAttendance: Record<string, 'present' | 'absent'> = {};
        membersList.forEach((member: Member) => {
          const existingAttendance = meeting.attendance?.find((a: any) => a.member === member._id);
          if (existingAttendance) {
            initialAttendance[member._id] = existingAttendance.status === 'abroad' ? 'absent' : existingAttendance.status;
          } else {
            // Smart defaults: Present for Active+Approved, Absent for others
            if (member.status === 'Active' && member.isApproved) {
              initialAttendance[member._id] = 'present';
            } else {
              initialAttendance[member._id] = 'absent'; // Inactive or abroad members default to absent
            }
          }
        });
        setAttendance(initialAttendance);

        // Load existing attendance and guest data from the new models
        try {
          const attendanceResponse = await meetingsApi.getAttendance(meeting._id);
          
          if (attendanceResponse.success) {
            // Update attendance from database records
            const dbAttendance: Record<string, 'present' | 'absent'> = {};
            attendanceResponse.data.memberAttendance.forEach((record: any) => {
              dbAttendance[record.member._id] = record.status === 'late' ? 'present' : record.status;
            });
            
            // Merge with smart defaults for members not in database
            membersList.forEach((member: Member) => {
              if (!dbAttendance[member._id]) {
                if (member.status === 'Active' && member.isApproved) {
                  dbAttendance[member._id] = 'present';
                } else {
                  dbAttendance[member._id] = 'absent';
                }
              }
            });
            
            setAttendance(dbAttendance);

            // Load existing guests
            if (attendanceResponse.data.guestAttendance) {
              const existingGuests = attendanceResponse.data.guestAttendance.map((guest: any) => ({
                name: guest.name,
                phone: guest.phone || ''
              }));
              setGuests(existingGuests);
            }
          }
        } catch (error) {
          console.log('No existing attendance data, using defaults');
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load group members",
          variant: "destructive"
        });
      }
    };

    loadData();
  }, [userGroup?._id, meeting._id]); // Depend on both userGroup and meeting

  const handleAttendanceChange = async (memberId: string, status: 'present' | 'absent') => {
    try {
      setLoading(true);
      
      // Call API with correct parameter order: (meetingId, status, memberId)
      await meetingsApi.markAttendance(meeting._id, status, memberId);
      
      // Update local state
      setAttendance(prev => ({ ...prev, [memberId]: status }));
      
      toast({
        title: "Success",
        description: "Attendance saved to database"
      });
      
      // Refresh meeting data
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save attendance to database",
        variant: "destructive"
      });
      console.error('Attendance error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = async () => {
    if (!newGuestName.trim()) return;

    try {
      setLoading(true);
      
      // Add guest to database via API
      await meetingsApi.addMeetingGuest(meeting._id, {
        name: newGuestName.trim(),
        phone: '',
        status: 'present'
      });
      
      // Add to local state
      const newGuest = { name: newGuestName.trim(), phone: '' };
      setGuests(prev => [...prev, newGuest]);
      setNewGuestName('');
      
      toast({
        title: "Success",
        description: "Guest added successfully"
      });
      
      // Refresh meeting data
      onRefresh();
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to add guest",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm)
  );

  const attendanceStats = {
    total: members.length,
    present: Object.values(attendance).filter(status => status === 'present').length,
    absent: Object.values(attendance).filter(status => status === 'absent').length,
  };

  return (
    <div className="space-y-4">
      {/* Attendance Summary */}
      <SectionCard title="Meeting Attendance" description="Mark attendance for members and add any guest participants.">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Meeting Attendance
              </h3>
              <p className="text-sm text-muted-foreground">
                Mark attendance for all members
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="data-strip border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-green-700">{attendanceStats.present}</div>
                <div className="text-xs font-medium text-green-600">Present</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <div className="data-strip border-red-200 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-red-700">{attendanceStats.absent}</div>
                <div className="text-xs font-medium text-red-600">Absent</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <div className="data-strip border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-blue-700">{attendanceStats.total}</div>
                <div className="text-xs font-medium text-blue-600">Total</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 pl-11"
          />
        </div>
      </SectionCard>

      {/* Members List */}
      <div className="space-y-3">
        {filteredMembers.map((member) => {
          const currentStatus = attendance[member._id] || 'absent';
          return (
            <Card key={member._id} className="surface-card overflow-hidden transition-all duration-200 hover:shadow-md">
              <div className="p-3">
                <div className="flex items-center gap-3">
                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                        currentStatus === 'present' ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-semibold text-foreground">
                            {member.name}
                          </h4>
                          {member.status !== 'Active' && (
                            <Badge variant="outline" className="text-xs shrink-0 px-2 py-0.5">
                              {member.status}
                            </Badge>
                          )}
                          {!member.isApproved && (
                            <Badge variant="secondary" className="text-xs shrink-0 px-2 py-0.5">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {member.phone}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Attendance Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Tick and Cross Buttons */}
                    <button
                      onClick={() => handleAttendanceChange(member._id, 'present')}
                      disabled={loading}
                      className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                        currentStatus === 'present'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-muted text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleAttendanceChange(member._id, 'absent')}
                      disabled={loading}
                      className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                        currentStatus === 'absent'
                          ? 'bg-red-500 text-white shadow-md'
                          : 'bg-muted text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    
                    {/* Status Indicator */}
                    <div className={`w-3 h-3 rounded-full ${
                      currentStatus === 'present' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Add Guest Input */}
        <Card className="surface-card border-2 border-dashed border-border/80 bg-muted/20 transition-colors hover:border-border">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Add guest participant..."
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddGuest();
                  }
                }}
                className="flex-1 bg-background shadow-sm"
              />
              <Button 
                onClick={handleAddGuest}
                disabled={loading || !newGuestName.trim()}
                className="sm:shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Guest
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Guests */}
      {guests.length > 0 && (
        <Card className="surface-card mt-6 overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h4 className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="h-4 w-4" />
              Guest Participants ({guests.length})
            </h4>
          </div>
          <div className="p-4">
            <div className="grid gap-3">
              {guests.map((guest, index) => (
                <div key={index} className="data-strip flex items-center justify-between p-3">
                  <div className="font-medium text-foreground">
                    {guest.name}
                  </div>
                  <Badge>
                    Guest
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};