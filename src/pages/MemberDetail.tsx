import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Phone, Mail, Calendar, Droplet, Briefcase, GraduationCap, MapPin, User, Wallet, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { membersAPI, baithulMaalAPI } from "@/utils/api";
import { format } from "date-fns";

const MemberDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [member, setMember] = useState<any>(null);
  const [baithulMaalData, setBaithulMaalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingCert, setDownloadingCert] = useState(false);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        setLoading(true);
        
        // Fetch member details
        const memberResult = await membersAPI.getMember(id!);
        setMember(memberResult.data);
        
        // Fetch Baithul Maal data
        try {
          const baithulResult = await baithulMaalAPI.getMemberPayments(id!);
          setBaithulMaalData(baithulResult.data);
        } catch (error) {
          console.log('No Baithul Maal data found');
        }
        
      } catch (error) {
        console.error('Error fetching member data:', error);
        toast({
          title: "Error",
          description: "Failed to load member details",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMemberData();
    }
  }, [id, toast]);

  const handleDownloadCertificate = async () => {
    try {
      setDownloadingCert(true);
      
      // Create certificate HTML
      const certificateHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Membership Certificate - ${member.name}</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Georgia', serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .certificate {
              background: white;
              padding: 60px;
              max-width: 800px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              border: 20px solid #f8f9fa;
              position: relative;
            }
            .certificate::before {
              content: '';
              position: absolute;
              top: 30px;
              left: 30px;
              right: 30px;
              bottom: 30px;
              border: 3px solid #667eea;
              pointer-events: none;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
            }
            .logo {
              font-size: 48px;
              color: #667eea;
              margin-bottom: 10px;
            }
            .org-name {
              font-size: 32px;
              font-weight: bold;
              color: #333;
              margin: 10px 0;
            }
            .cert-title {
              font-size: 24px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin: 20px 0;
            }
            .content {
              text-align: center;
              margin: 40px 0;
            }
            .intro-text {
              font-size: 18px;
              color: #555;
              margin-bottom: 30px;
            }
            .member-name {
              font-size: 42px;
              font-weight: bold;
              color: #667eea;
              margin: 30px 0;
              text-decoration: underline;
              text-decoration-color: #764ba2;
            }
            .details {
              margin: 40px 0;
              text-align: left;
              display: inline-block;
            }
            .detail-row {
              display: flex;
              margin: 15px 0;
              font-size: 16px;
            }
            .detail-label {
              font-weight: bold;
              color: #333;
              min-width: 180px;
            }
            .detail-value {
              color: #555;
            }
            .footer {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature {
              text-align: center;
            }
            .signature-line {
              border-top: 2px solid #333;
              width: 200px;
              margin: 40px auto 10px;
            }
            .signature-label {
              font-size: 14px;
              color: #666;
            }
            .issue-date {
              text-align: center;
              margin-top: 40px;
              font-size: 14px;
              color: #666;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              color: rgba(102, 126, 234, 0.05);
              font-weight: bold;
              pointer-events: none;
              z-index: 0;
            }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="watermark">SOLIDARITY</div>
            <div class="header">
              <div class="logo">🤝</div>
              <div class="org-name">Solidarity Organization</div>
              <div class="cert-title">Membership Certificate</div>
            </div>
            
            <div class="content">
              <p class="intro-text">This is to certify that</p>
              <div class="member-name">${member.name}</div>
              
              <div class="details">
                <div class="detail-row">
                  <span class="detail-label">Member ID:</span>
                  <span class="detail-value">${member._id}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value">${member.status}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Group:</span>
                  <span class="detail-value">${member.group?.name || 'N/A'} (${member.group?.code || 'N/A'})</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">District:</span>
                  <span class="detail-value">${member.district?.name || 'N/A'} (${member.district?.code || 'N/A'})</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${member.phone}</span>
                </div>
                ${member.email ? `
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${member.email}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Member Since:</span>
                  <span class="detail-value">${member.createdAt ? format(new Date(member.createdAt), 'MMMM dd, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-label">Group Admin</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-label">District Admin</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-label">State Admin</div>
              </div>
            </div>
            
            <div class="issue-date">
              Certificate issued on ${format(new Date(), 'MMMM dd, yyyy')}
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Create a blob and download
      const blob = new Blob([certificateHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Membership_Certificate_${member.name.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Membership certificate downloaded successfully. Open the HTML file in a browser and print to PDF."
      });
    } catch (error) {
      console.error('Certificate download error:', error);
      toast({
        title: "Error",
        description: "Failed to download certificate",
        variant: "destructive"
      });
    } finally {
      setDownloadingCert(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Not provided"}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-6">
        <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Member Details</h1>
          </div>
        </header>
        <main className="p-4 space-y-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
              <Skeleton className="h-8 w-48 mx-auto mb-2" />
              <Skeleton className="h-6 w-24 mx-auto" />
            </CardContent>
          </Card>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </main>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background pb-6">
        <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Member Details</h1>
          </div>
        </header>
        <main className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">Member Not Found</h3>
              <p className="text-muted-foreground mb-4">The member you're looking for doesn't exist.</p>
              <Button onClick={() => navigate("/members")}>Back to Members</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Member Details</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Header Card */}
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{member.name}</h2>
            <Badge
              variant={member.status === "Active" ? "default" : "secondary"}
              className={
                member.status === "Active" ? "bg-success" :
                member.status === "Applicant" ? "bg-orange-100 text-orange-800" :
                member.status === "Abroad" ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-800"
              }
            >
              {member.status}
            </Badge>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <a href={`tel:${member.phone}`}>
                <Button size="sm" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              </a>
              {member.email && (
                <a href={`mailto:${member.email}`}>
                  <Button size="sm" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </a>
              )}
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadCertificate}
                disabled={downloadingCert}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingCert ? "Downloading..." : "Certificate"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <InfoRow icon={Phone} label="Phone Number" value={member.phone} />
            <InfoRow icon={Mail} label="Email" value={member.email} />
            <InfoRow icon={MapPin} label="Address" value={member.address} />
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Personal Information</h3>
            <InfoRow icon={Calendar} label="Date of Birth" value={member.dateOfBirth ? format(new Date(member.dateOfBirth), 'MMM dd, yyyy') : 'Not provided'} />
            <InfoRow icon={User} label="Age" value={member.age ? `${member.age} years` : 'Not provided'} />
            <InfoRow icon={Droplet} label="Blood Group" value={member.bloodGroup} />
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Professional Information</h3>
            <InfoRow icon={Briefcase} label="Profession" value={member.profession} />
            <InfoRow icon={GraduationCap} label="Education" value={member.education} />
          </CardContent>
        </Card>

        {/* Organization Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Organization Details</h3>
            <InfoRow icon={MapPin} label="District" value={member.district?.name || 'Not assigned'} />
            <InfoRow icon={User} label="Group" value={member.group?.name || 'Not assigned'} />
            <InfoRow icon={Calendar} label="Joined Date" value={member.createdAt ? format(new Date(member.createdAt), 'MMM dd, yyyy') : 'Not available'} />
          </CardContent>
        </Card>

        {/* Baithul Maal Information */}
        {baithulMaalData && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Baithul Maal - Monthly Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">₹{baithulMaalData.monthlyAmount || 0}</p>
                  <p className="text-xs text-muted-foreground">Monthly Amount</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">₹{baithulMaalData.totalCollected || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Collected</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">₹{baithulMaalData.totalPaid || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">₹{baithulMaalData.balance || 0}</p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
              </div>

              {/* Monthly Payment Records */}
              {baithulMaalData.payments && baithulMaalData.payments.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-3">All Monthly Payments</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead>Payment Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {baithulMaalData.payments.map((payment: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {payment.month || format(new Date(payment.paymentDate || payment.createdAt), 'MMMM')}
                            </TableCell>
                            <TableCell>
                              {payment.year || format(new Date(payment.paymentDate || payment.createdAt), 'yyyy')}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              ₹{payment.amount}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className={payment.status === 'paid' ? 'bg-green-600' : 'bg-yellow-600'}>
                                {payment.status || 'paid'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {payment.paymentDate ? format(new Date(payment.paymentDate), 'MMM dd, yyyy') : 
                               payment.createdAt ? format(new Date(payment.createdAt), 'MMM dd, yyyy') : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground text-center">
                    Total Records: {baithulMaalData.payments.length}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No payment records found
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Meeting Attendance */}
        {member.meetingAttendance && member.meetingAttendance.length > 0 ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting Attendance - All Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{member.meetingAttendance.length}</p>
                  <p className="text-xs text-muted-foreground">Total Meetings</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {member.meetingAttendance.filter((a: any) => a.status === 'present').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {member.meetingAttendance.filter((a: any) => a.status === 'absent').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meeting</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.meetingAttendance.map((attendance: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm font-medium">
                          {attendance.meetingTitle || attendance.meeting?.title || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {attendance.sessionTitle || attendance.session?.title || '-'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {attendance.date ? format(new Date(attendance.date), 'MMM dd, yyyy') :
                           attendance.scheduledDate ? format(new Date(attendance.scheduledDate), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {attendance.status === 'present' ? (
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">Present</span>
                            </div>
                          ) : attendance.status === 'absent' ? (
                            <div className="flex items-center justify-center gap-1">
                              <XCircle className="h-5 w-5 text-red-600" />
                              <span className="text-xs text-red-600 font-medium">Absent</span>
                            </div>
                          ) : attendance.status === 'abroad' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-5 w-5 text-blue-600" />
                              <span className="text-xs text-blue-600 font-medium">Abroad</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-5 w-5 text-yellow-600" />
                              <span className="text-xs text-yellow-600 font-medium">{attendance.status || 'Unknown'}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 text-sm text-muted-foreground text-center">
                Total Attendance Records: {member.meetingAttendance.length} | 
                Attendance Rate: {member.meetingAttendance.length > 0 
                  ? Math.round((member.meetingAttendance.filter((a: any) => a.status === 'present').length / member.meetingAttendance.length) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4 text-muted-foreground">
                No attendance records found
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate(`/member/${member._id}/edit`)}
            variant="outline"
            className="w-full"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Request
          </Button>
          <Button
            onClick={() => navigate('/members')}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>
      </main>
    </div>
  );
};

export default MemberDetail;
