import { useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Clock3,
  Fingerprint,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { cn } from "@/lib/utils";
import { authAPI, memberAuthAPI } from "@/utils/api";

type UserType = "state_admin" | "district_admin" | "group_admin" | "member" | "";

const roleOptions = [
  {
    value: "state_admin",
    label: "State Admin",
    hint: "State level",
    icon: Building2,
  },
  {
    value: "district_admin",
    label: "District Admin",
    hint: "District level",
    icon: MapPinned,
  },
  {
    value: "group_admin",
    label: "Area Admin",
    hint: "Area level",
    icon: ShieldCheck,
  },
  {
    value: "member",
    label: "Member",
    hint: "Personal access",
    icon: UserRound,
  },
] as const satisfies ReadonlyArray<{
  value: Exclude<UserType, "">;
  label: string;
  hint: string;
  icon: typeof Building2;
}>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Something went wrong. Please try again.";
}

function getAvailableRoles(error: unknown): string[] | undefined {
  if (typeof error === "object" && error !== null && "availableRoles" in error) {
    const roles = (error as { availableRoles?: unknown }).availableRoles;
    if (Array.isArray(roles)) {
      return roles as string[];
    }
  }
  return undefined;
}

const roleLabelMap: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
  member: "Member",
};

const Login = () => {
  const [userType, setUserType] = useState<UserType>("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const roleOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    setPhone(cleaned);
  };

  const handleRoleSelect = (value: Exclude<UserType, "">) => {
    setUserType(value);
  };

  const handleRoleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = userType ? roleOptions.findIndex((option) => option.value === userType) : 0;

    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % roleOptions.length;
      handleRoleSelect(roleOptions[nextIndex].value);
      roleOptionRefs.current[nextIndex]?.focus();
      return;
    }

    if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const previousIndex = (currentIndex - 1 + roleOptions.length) % roleOptions.length;
      handleRoleSelect(roleOptions[previousIndex].value);
      roleOptionRefs.current[previousIndex]?.focus();
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleRoleSelect(roleOptions[index].value);
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10 || !userType) return;

    setLoading(true);
    try {
      let result;
      if (userType === "member") {
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
      console.error("Send OTP error:", error);

      const availableRoles = getAvailableRoles(
        typeof error === "object" && error !== null && "data" in error
          ? (error as { data?: unknown }).data
          : error
      );

      if (availableRoles && availableRoles.length > 0) {
        const selectedLabel = roleLabelMap[userType] || userType;
        toast({
          title: "Invalid role",
          description: `${selectedLabel} is not your role. Please select the correct role to continue.`,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Error",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, "");
    setOtp(newOtp);

    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
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
      let result;
      if (userType === "member") {
        result = await memberAuthAPI.verifyOTP(phone, otpValue);
      } else {
        result = await authAPI.verifyOTP(phone, otpValue, userType);
      }

      const userData = userType === "member" ? result.data.member : result.data.user;
      login(result.data.token, userData, userType);

      toast({
        title: "Login Successful",
        description: result.message,
      });

      // Navigate to different dashboard based on user type
      if (userType === "member") {
        navigate("/member-dashboard");
      } else {
        navigate(getHomeRouteByRole(userData?.role));
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });

      setOtp(["", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      let result;
      if (userType === "member") {
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

      if (result.data.demoOTP) {
        toast({
          title: "Demo OTP",
          description: `Use OTP: ${result.data.demoOTP}`,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-start justify-center overflow-x-hidden overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-rose-50/30 px-4 py-4 sm:px-6 sm:py-6 [@media(min-height:860px)]:items-center">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-violet-500/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] backdrop-blur-xl lg:grid lg:min-h-[700px] lg:grid-cols-[1.05fr_1fr]">
        {/* Left panel — brand */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          {/* Dark gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          {/* Accent glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-[80px]" />
            <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[60px]" />
          </div>
          {/* Subtle grid */}
          <div className="pointer-events-none absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMC44IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+')]" />

          {/* Top — Logo */}
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] px-6 py-5 backdrop-blur-md">
              <img src="/logo.jpg" alt="SOLIDARITY" className="h-28 w-40 rounded-xl object-contain shadow-lg" />
              <div>
                <span className="block text-xl font-bold tracking-tight text-white">SOLIDARITY</span>
                <span className="block text-xs font-medium text-slate-400">Organization Portal</span>
              </div>
            </div>
          </div>

          {/* Middle — Hero text */}
          <div className="relative z-10">
            <h1 className="text-[3.5rem] font-extrabold leading-[1.05] tracking-tight text-white">
              Welcome<br />Back<span className="text-primary">.</span>
            </h1>
            <p className="mt-5 max-w-[20rem] text-base leading-relaxed text-slate-300/90">
              Secure access to your organization portal with OTP verification.
            </p>
          </div>

          {/* Bottom — Trust badges */}
          <div className="relative z-10 space-y-2.5">
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">End-to-end encrypted</p>
                <p className="text-[11px] text-slate-400">256-bit security protocol</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">OTP verified access</p>
                <p className="text-[11px] text-slate-400">One-time password every session</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <LockKeyhole className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">Private & protected</p>
                <p className="text-[11px] text-slate-400">Your data stays on our servers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="relative flex flex-col justify-center px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-[420px]">
            {/* Mobile header */}
            <div className={cn("flex flex-col items-center text-center lg:items-start lg:text-left", showOtp ? "mb-5 lg:mb-6" : "mb-6 lg:mb-8")}>
              <div className={cn("mb-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm lg:hidden", showOtp && "hidden")}>
                <img src="/logo.jpg" alt="SOLIDARITY" className="h-12 w-12 rounded-xl object-contain" />
                <div>
                  <span className="block text-lg font-bold tracking-tight text-slate-900">SOLIDARITY</span>
                  <span className="block text-[11px] font-medium text-slate-400">Organization Portal</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.06] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary lg:self-start">
                <LockKeyhole className="h-3 w-3" />
                Secure Sign In
              </div>

              <h2 className={cn("mt-4 text-[1.65rem] font-bold tracking-tight text-slate-900 sm:text-[1.85rem]", showOtp && "text-xl sm:text-2xl")}>
                {showOtp ? "Verify your identity" : "Sign in to your account"}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 sm:text-sm">
                {showOtp
                  ? "Enter the 4-digit code sent to your phone."
                  : "Select your role and enter your mobile number."}
              </p>
            </div>

            <div className={cn("space-y-5", showOtp && "space-y-4")}>
              {/* Role selection */}
              <div className={cn("space-y-3", showOtp && "space-y-2")}>
                <label id="user-role" className="text-[13px] font-semibold text-slate-600">
                  Select your role
                </label>
                <div role="radiogroup" aria-labelledby="user-role" className="grid grid-cols-2 gap-2.5">
                  {roleOptions.map((option, index) => {
                    const isActive = userType === option.value;
                    const Icon = option.icon;
                    const isTabStop = userType ? isActive : index === 0;

                    return (
                      <button
                        key={option.value}
                        ref={(element) => {
                          roleOptionRefs.current[index] = element;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`${option.label} ${option.hint}`}
                        tabIndex={isTabStop ? 0 : -1}
                        onClick={() => handleRoleSelect(option.value)}
                        onKeyDown={(event) => handleRoleKeyDown(index, event)}
                        disabled={showOtp}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                          isActive
                            ? "border-primary/30 bg-gradient-to-br from-primary/[0.05] to-primary/[0.02] shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.2)]"
                            : "border-slate-200/80 bg-white shadow-sm hover:border-slate-300 hover:shadow-md",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                            isActive
                              ? "bg-primary/12 text-primary shadow-sm"
                              : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className={cn("block text-[13px] font-semibold leading-tight", isActive ? "text-slate-900" : "text-slate-700")}>
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {option.hint}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-all duration-200",
                            isActive
                              ? "border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                              : "border-slate-300",
                          )}
                        >
                          {isActive && (
                            <span className="flex h-full w-full items-center justify-center">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone input */}
              <div className="space-y-2.5">
                <label htmlFor="login-phone" className="text-[13px] font-semibold text-slate-600">Mobile Number</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2.5 text-sm text-slate-500">
                    <Smartphone className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">+91</span>
                    <div className="h-5 w-px bg-slate-200" />
                  </div>
                  <Input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter your number"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    maxLength={10}
                    disabled={showOtp || !userType}
                    className="h-[52px] rounded-2xl border-slate-200/80 bg-slate-50/60 pl-[7rem] text-[15px] font-medium tracking-wide shadow-sm transition-all duration-200 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/10 disabled:opacity-50"
                  />
                </div>
                {phone && phone.length !== 10 && (
                  <p className="text-xs font-medium text-destructive">Enter a valid 10-digit mobile number</p>
                )}
              </div>

              {!showOtp ? (
                <Button
                  onClick={handleSendOtp}
                  className="h-[52px] w-full rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.4)] transition-all duration-200 hover:shadow-[0_12px_28px_-4px_hsl(var(--primary)/0.5)] active:scale-[0.98]"
                  disabled={phone.length !== 10 || !userType || loading}
                >
                  <span>{loading ? "Sending OTP..." : "Continue"}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* OTP info banner */}
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Smartphone className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[13px] text-slate-600">
                      Code sent to <span className="font-semibold text-slate-800">+91 {phone}</span>
                    </p>
                  </div>

                  {/* OTP inputs */}
                  <fieldset className="space-y-3">
                    <legend className="sr-only">Enter OTP</legend>
                    <div className="flex justify-center gap-3.5">
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          id={`otp-${index}`}
                          type="tel"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          aria-label={`OTP digit ${index + 1} of 4`}
                          className="h-[56px] w-[56px] rounded-2xl border-slate-200/80 bg-slate-50/60 text-center text-xl font-bold text-slate-900 shadow-sm transition-all duration-200 focus-visible:border-primary/40 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15"
                          disabled={loading}
                        />
                      ))}
                    </div>
                    {otpExpiry && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                        <Clock3 className="h-3 w-3" />
                        <span>
                          Expires at {otpExpiry.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </fieldset>

                  <Button
                    onClick={handleVerifyOtp}
                    className="h-[52px] w-full rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.4)] transition-all duration-200 hover:shadow-[0_12px_28px_-4px_hsl(var(--primary)/0.5)] active:scale-[0.98]"
                    disabled={otp.join("").length !== 4 || loading}
                  >
                    <span>{loading ? "Verifying..." : "Verify & Sign In"}</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOtp(false);
                        setOtp(["", "", "", ""]);
                        setOtpExpiry(null);
                      }}
                      className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
                      disabled={loading}
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                </div>
              )}

              {/* Security note */}
              <div className={cn("flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5", showOtp && "hidden sm:flex")}>
                <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                <p className="text-xs leading-relaxed text-slate-500">
                  Your connection is secure. OTP will be sent to your registered number only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
