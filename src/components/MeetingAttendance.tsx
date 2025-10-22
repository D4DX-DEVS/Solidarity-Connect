import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Check, X, Clock, Search, Plus } from 'lucide-react';
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
      <Card className="p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Meeting Attendance
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mark attendance for all members
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-green-700 dark:text-green-300">{attendanceStats.present}</div>
                <div className="text-xs font-medium text-green-600 dark:text-green-400">Present</div>
              </div>
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">{attendanceStats.absent}</div>
                <div className="text-xs font-medium text-red-600 dark:text-red-400">Absent</div>
              </div>
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{attendanceStats.total}</div>
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total</div>
              </div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search members by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-colors"
          />
        </div>
      </Card>

      {/* Members List */}
      <div className="space-y-3">
        {filteredMembers.map((member) => {
          const currentStatus = attendance[member._id] || 'absent';
          return (
            <Card key={member._id} className="overflow-hidden hover:shadow-md transition-all duration-200 border bg-white dark:bg-gray-900">
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
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
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
                          : 'bg-gray-100 text-green-600 hover:bg-green-50 dark:bg-gray-800 dark:text-green-400 dark:hover:bg-green-900/20'
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
                          : 'bg-gray-100 text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20'
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
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
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
                className="flex-1 border-0 bg-white dark:bg-gray-900 shadow-sm"
              />
              <Button 
                onClick={handleAddGuest}
                disabled={loading || !newGuestName.trim()}
                className="sm:shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
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
        <Card className="mt-6 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-4 py-3 border-b">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Guest Participants ({guests.length})
            </h4>
          </div>
          <div className="p-4">
            <div className="grid gap-3">
              {guests.map((guest, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="font-medium text-purple-900 dark:text-purple-100">
                    {guest.name}
                  </div>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
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