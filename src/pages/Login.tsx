import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { authAPI, memberAuthAPI } from "@/utils/api";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

const Login = () => {
  const [userType, setUserType] = useState<"state_admin" | "district_admin" | "group_admin" | "member" | "">("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handlePhoneChange = (value: string) => {
    // Only allow digits and max 10 characters
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    setPhone(cleaned);
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10 || !userType) return;

    setLoading(true);
    try {
      console.log('Sending OTP request with phone:', phone, 'userType:', userType);

      let result;
      if (userType === 'member') {
        result = await memberAuthAPI.sendOTP(phone);
      } else {
        result = await authAPI.sendOTP(phone, userType);
      }

      setShowOtp(true);
      setOtpExpiry(new Date(result.data.expiresAt));

      toast({
        title: "OTP Sent",
        description: result.message,
      });

      // Show demo OTP in development
      if (result.data.demoOTP) {
        toast({
          title: "Demo OTP",
          description: `Use OTP: ${result.data.demoOTP}`,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, ""); // Only digits
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length !== 4 || !userType) return;

    setLoading(true);
    try {
      console.log('Verifying OTP with phone:', phone, 'otp:', otpValue, 'userType:', userType);

      let result;
      if (userType === 'member') {
        result = await memberAuthAPI.verifyOTP(phone, otpValue);
      } else {
        result = await authAPI.verifyOTP(phone, otpValue, userType);
      }

      const userData = userType === 'member' ? result.data.member : result.data.user;
      login(result.data.token, userData, userType);

      toast({
        title: "Login Successful",
        description: result.message,
      });

      // Navigate to different dashboard based on user type
      if (userType === 'member') {
        navigate("/member-dashboard");
      } else {
        navigate(getHomeRouteByRole(userData?.role));
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify OTP. Please try again.",
        variant: "destructive"
      });

      // Clear OTP on error
      setOtp(["", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      let result;
      if (userType === 'member') {
        result = await memberAuthAPI.resendOTP(phone);
      } else {
        result = await authAPI.resendOTP(phone, userType);
      }

      setOtpExpiry(new Date(result.data.expiresAt));
      setOtp(["", "", "", ""]);

      toast({
        title: "OTP Resent",
        description: result.message,
      });

      // Show demo OTP in development
      if (result.data.demoOTP) {
        toast({
          title: "Demo OTP",
          description: `Use OTP: ${result.data.demoOTP}`,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 glass border-none overflow-hidden relative rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary/60" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
            <img src="/logo.jpg" alt="SOLIDARITY" className="h-[72px] object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground/80">I am a</label>
            <select
              className="w-full px-4 py-3 rounded-xl bg-background/50 border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 outline-none hover:bg-background/80"
              value={userType}
              onChange={(e) => setUserType(e.target.value as any)}
              disabled={showOtp}
            >
              <option value="" disabled className="text-muted-foreground">Select your role</option>
              <option value="state_admin">State Admin</option>
              <option value="district_admin">District Admin</option>
              <option value="group_admin">Area Admin</option>
              <option value="member">Member</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground/80">Mobile Number</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-muted-foreground font-medium">+91</span>
                <div className="w-px h-5 bg-border"></div>
              </div>
              <Input
                type="tel"
                placeholder="0000 000 000"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={10}
                disabled={showOtp || !userType}
                className="pl-20 py-6 rounded-xl bg-background/50 border-input transition-all duration-200 focus:bg-background hover:bg-background/80 text-lg tracking-wide"
              />
            </div>
            {phone && phone.length !== 10 && (
              <p className="text-xs text-destructive mt-1.5 font-medium animate-in fade-in slide-in-from-top-1">Please enter a valid 10-digit number</p>
            )}
          </div>

          {!showOtp ? (
            <Button
              onClick={handleSendOtp}
              className="w-full py-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-lg transition-all active:scale-[0.98] shadow-lg shadow-primary/20 mt-4"
              disabled={phone.length !== 10 || !userType || loading}
            >
              {loading ? "Sending..." : "Get OTP"}
            </Button>
          ) : (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground/80 text-center block">Enter the 4-digit OTP</label>
                <div className="flex gap-3 justify-center">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      id={`otp-${index}`}
                      type="tel"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl text-center text-2xl font-bold bg-background/50 border-input focus:bg-background transition-all hover:bg-background/80 ring-offset-background"
                      disabled={loading}
                    />
                  ))}
                </div>
                {otpExpiry && (
                  <p className="text-xs text-muted-foreground mt-3 text-center font-medium">
                    Code expires at {otpExpiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <Button
                onClick={handleVerifyOtp}
                className="w-full py-6 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-medium text-lg transition-all active:scale-[0.98] shadow-lg shadow-success/20"
                disabled={otp.join("").length !== 4 || loading}
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </Button>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOtp(false);
                    setOtp(["", "", "", ""]);
                    setOtpExpiry(null);
                  }}
                  className="flex-1 rounded-xl py-5 border-border/50 hover:bg-background/60 transition-colors"
                  disabled={loading}
                >
                  Change Number
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleResendOtp}
                  className="flex-1 rounded-xl py-5 bg-secondary/80 hover:bg-secondary transition-colors"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Resend"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Login;
