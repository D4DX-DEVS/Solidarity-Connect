import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const Login = () => {
  const [userType, setUserType] = useState<"state_admin" | "district_admin" | "group_admin" | "">("");
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
      
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          userType
        })
      });

      const result = await response.json();

      if (response.ok) {
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
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to send OTP",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
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
      
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          otp: otpValue,
          userType
        })
      });

      const result = await response.json();

      if (response.ok) {
        login(result.data.token, result.data.user);
        
        toast({
          title: "Login Successful",
          description: result.message,
        });

        navigate("/dashboard");
      } else {
        toast({
          title: "Error",
          description: result.message || "Invalid OTP",
          variant: "destructive"
        });
        
        // Clear OTP on error
        setOtp(["", "", "", ""]);
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast({
        title: "Error",
        description: "Failed to verify OTP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          userType
        })
      });

      const result = await response.json();

      if (response.ok) {
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
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to resend OTP",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast({
        title: "Error",
        description: "Failed to resend OTP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="SOLIDARITY" className="h-16 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Members Management</h1>
          <p className="text-muted-foreground text-sm mt-2">Login with mobile OTP</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">User Type</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={userType}
              onChange={(e) => setUserType(e.target.value as any)}
              disabled={showOtp}
            >
              <option value="">Select User Type</option>
              <option value="state_admin">State Admin</option>
              <option value="district_admin">District Admin</option>
              <option value="group_admin">Members Group Admin</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">+91</span>
              <Input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={10}
                disabled={showOtp || !userType}
                className="pl-12"
              />
            </div>
            {phone && phone.length !== 10 && (
              <p className="text-xs text-destructive mt-1">Please enter 10 digits</p>
            )}
          </div>

          {!showOtp ? (
            <Button 
              onClick={handleSendOtp} 
              className="w-full bg-primary hover:bg-primary/90"
              disabled={phone.length !== 10 || !userType || loading}
            >
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Enter OTP</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      id={`otp-${index}`}
                      type="tel"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-12 text-center text-lg font-semibold"
                      disabled={loading}
                    />
                  ))}
                </div>
                {otpExpiry && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    OTP expires at {otpExpiry.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleVerifyOtp} 
                className="w-full bg-success hover:bg-success/90"
                disabled={otp.join("").length !== 4 || loading}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowOtp(false);
                    setOtp(["", "", "", ""]);
                    setOtpExpiry(null);
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Change Number
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResendOtp}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Resend OTP"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Login;
