import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Phone, Mail, Calendar, Droplet, Briefcase, GraduationCap, MapPin, User, Wallet, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
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
        } catch {
          setBaithulMaalData(null);
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
              <div class="logo"><img src="/logo.jpg" alt="Logo" style="height: 80px; width: auto; object-fit: contain;" /></div>
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
                <div class="signature-label">Area Admin</div>
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
    <div className="data-strip flex items-start gap-3 rounded-xl px-4 py-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Not provided"}</p>
      </div>
    </div>
  );

  const renderMemberStatus = (status: string) => {
    if (status === "Active") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{status}</span>
        </div>
      );
    }

    if (status === "Applicant") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden="true" />
          <span>{status}</span>
        </div>
      );
    }

    if (status === "Abroad") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
          <span>{status}</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-500" aria-hidden="true" />
        <span>{status}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <PageShell>
        <PageHero
          title="Member Details"
          subtitle="Loading the latest member profile and supporting records."
          eyebrow="Members"
          icon={<User className="h-6 w-6" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Members
            </Button>
          }
        />
        <SectionCard title="Preparing Member View" description="Fetching profile, contribution, and attendance data.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
              <Skeleton className="h-8 w-48 mx-auto mb-2" />
              <Skeleton className="h-6 w-24 mx-auto" />
            </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  if (!member) {
    return (
      <PageShell>
        <PageHero
          title="Member Details"
          subtitle="The requested member record could not be loaded."
          eyebrow="Members"
          icon={<User className="h-6 w-6" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Members
            </Button>
          }
        />
        <SectionCard title="Member Not Found" description="The member may have been removed or the link may be outdated.">
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">Member Not Found</h3>
              <p className="text-muted-foreground mb-4">The member you're looking for doesn't exist.</p>
              <Button onClick={() => navigate("/members")}>Back to Members</Button>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        title={member.name}
        subtitle={`${member.group?.name || "Group not assigned"} • ${member.district?.name || "District not assigned"}`}
        eyebrow="Member Profile"
        icon={<User className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/member/${member._id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Request
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Members
            </Button>
          </>
        }
        details={
          <>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
              <div className="mt-2">{renderMemberStatus(member.status)}</div>
            </div>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
              <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{member.phone}</span>
              </div>
            </div>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Joined</p>
              <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{member.createdAt ? format(new Date(member.createdAt), 'MMM dd, yyyy') : 'Unknown'}</span>
              </div>
            </div>
            <div className="min-w-[220px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick Actions</p>
              <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${member.phone}`}>
                <Button size="sm" variant="outline">
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
              </a>
              {member.email ? (
                <a href={`mailto:${member.email}`}>
                  <Button size="sm" variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                </a>
              ) : null}
              <Button size="sm" variant="outline" onClick={handleDownloadCertificate} disabled={downloadingCert}>
                <Download className="mr-2 h-4 w-4" />
                {downloadingCert ? "Downloading..." : "Certificate"}
              </Button>
            </div>
            </div>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Contact Information" description="Primary ways to reach and identify this member.">
          <div className="space-y-3">
            <InfoRow icon={Phone} label="Phone Number" value={member.phone} />
            <InfoRow icon={Mail} label="Email" value={member.email} />
            <InfoRow icon={MapPin} label="Address" value={member.address} />
          </div>
        </SectionCard>

        <SectionCard title="Personal Information" description="Identity and profile details saved for this member.">
          <div className="space-y-3">
            <InfoRow icon={Calendar} label="Date of Birth" value={member.dateOfBirth ? format(new Date(member.dateOfBirth), 'MMM dd, yyyy') : 'Not provided'} />
            <InfoRow icon={User} label="Age" value={member.age ? `${member.age} years` : 'Not provided'} />
            <InfoRow icon={Droplet} label="Blood Group" value={member.bloodGroup} />
          </div>
        </SectionCard>

        <SectionCard title="Professional Information" description="Occupation and education details recorded for the member.">
          <div className="space-y-3">
            <InfoRow icon={Briefcase} label="Profession" value={member.profession} />
            <InfoRow icon={GraduationCap} label="Education" value={member.education} />
          </div>
        </SectionCard>

        <SectionCard title="Organization Details" description="How this member is mapped into the organization structure.">
          <div className="space-y-3">
            <InfoRow icon={MapPin} label="District" value={member.district?.name || 'Not assigned'} />
            <InfoRow icon={User} label="Group" value={member.group?.name || 'Not assigned'} />
            <InfoRow icon={Calendar} label="Joined Date" value={member.createdAt ? format(new Date(member.createdAt), 'MMM dd, yyyy') : 'Not available'} />
          </div>
        </SectionCard>
      </div>

      {baithulMaalData ? (
        <SectionCard title="Baithul Maal" description="Contribution summary and monthly payment records.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-5">
            <MetricCard title="Monthly Amount" value={`₹${baithulMaalData.monthlyAmount || 0}`} icon={Wallet} tone="primary" />
            <MetricCard title="Total Collected" value={`₹${baithulMaalData.totalCollected || 0}`} icon={CheckCircle} tone="success" />
            <MetricCard title="Total Paid" value={`₹${baithulMaalData.totalPaid || 0}`} icon={XCircle} tone="danger" />
            <MetricCard title="Balance" value={`₹${baithulMaalData.balance || 0}`} icon={Wallet} tone="warning" />
          </div>

          {baithulMaalData.payments && baithulMaalData.payments.length > 0 ? (
            <div>
              <h4 className="mb-3 font-medium">All Monthly Payments</h4>
              <div className="overflow-x-auto rounded-xl border border-border/60 bg-card p-2">
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
              <div className="mt-3 text-center text-sm text-muted-foreground">
                Total Records: {baithulMaalData.payments.length}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card py-6 text-center text-muted-foreground">
              No payment records found
            </div>
          )}
        </SectionCard>
      ) : null}

      {member.meetingAttendance && member.meetingAttendance.length > 0 ? (
        <SectionCard title="Meeting Attendance" description="Full history of recorded meeting participation.">
          <div className="grid gap-3 md:grid-cols-3 mb-5">
            <MetricCard title="Total Meetings" value={String(member.meetingAttendance.length)} icon={Calendar} tone="primary" />
            <MetricCard title="Present" value={String(member.meetingAttendance.filter((a: any) => a.status === 'present').length)} icon={CheckCircle} tone="success" />
            <MetricCard title="Absent" value={String(member.meetingAttendance.filter((a: any) => a.status === 'absent').length)} icon={XCircle} tone="danger" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card p-2">
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
          <div className="mt-3 text-center text-sm text-muted-foreground">
            Total Attendance Records: {member.meetingAttendance.length} |
            {' '}Attendance Rate: {member.meetingAttendance.length > 0
              ? Math.round((member.meetingAttendance.filter((a: any) => a.status === 'present').length / member.meetingAttendance.length) * 100)
              : 0}%
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Meeting Attendance" description="Meeting participation history will appear here once records are available.">
          <div className="rounded-xl border border-border/60 bg-card py-6 text-center text-muted-foreground">
            No attendance records found
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
};

export default MemberDetail;
