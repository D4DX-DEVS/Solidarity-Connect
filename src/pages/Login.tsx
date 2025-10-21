import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import logo from "@/assets/logo.png";

const Login = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = () => {
    if (phone.length === 10) {
      setShowOtp(true);
    }
  };

  const handleVerifyOtp = () => {
    // Mock login - in real app, verify OTP with backend
    if (otp.length === 6) {
      navigate("/role-selection");
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
            <label className="text-sm font-medium mb-2 block">Phone Number</label>
            <Input
              type="tel"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={10}
              disabled={showOtp}
            />
          </div>

          {!showOtp ? (
            <Button onClick={handleSendOtp} className="w-full bg-primary hover:bg-primary/90">
              Send OTP
            </Button>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Enter OTP</label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
              </div>
              <Button onClick={handleVerifyOtp} className="w-full bg-success hover:bg-success/90">
                Verify & Login
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowOtp(false)}
                className="w-full"
              >
                Change Number
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Login;
