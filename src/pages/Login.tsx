import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, type LoginAccount } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getRoleDisplay } from "@/lib/adminKinds";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { cn } from "@/lib/utils";
import { loginAPI } from "@/utils/api";

/**
 * Phone-first sign-in, mobile-first layout.
 *
 *   phone → code (WhatsApp) → pick an account
 *
 * One code covers the whole number; every account on it is listed to enter.
 */
type Step = "phone" | "otp" | "accounts";

const OTP_LENGTH = 4;
const RESEND_SECONDS = 60;

const serif = { fontFamily: '"Fraunces", Georgia, serif' } as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Something went wrong. Please try again.";
}

const STEP_ORDER: Step[] = ["phone", "otp", "accounts"];

const FLOW = [
  { title: "Enter your number", sub: "The one on WhatsApp" },
  { title: "Type the code", sub: "It arrives in seconds" },
  { title: "Pick your account", sub: "Every role, one login" },
];

const Login = () => {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [isTestPhone, setIsTestPhone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const navigate = useNavigate();
  const { login, isAuthenticated, userRole } = useAuth();
  const { toast } = useToast();

  // PWA cold start opens start_url "/" → /login even with a valid stored
  // session; send signed-in users straight to their home instead.
  useEffect(() => {
    if (isAuthenticated) navigate(getHomeRouteByRole(userRole), { replace: true });
  }, [isAuthenticated, userRole, navigate]);

  const phoneIsValid = /^[6-9]\d{9}$/.test(phone);
  const otpValue = otp.join("");
  const stepIndex = STEP_ORDER.indexOf(step);

  // Resend cooldown ticker.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  // Focus the first code box as soon as the code step opens.
  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  const failWith = useCallback(
    (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    },
    [toast]
  );

  const sendCode = async (resend = false) => {
    if (!phoneIsValid || loading) return;

    setLoading(true);
    try {
      const result = await loginAPI.sendOTP(phone, resend);
      setIsTestPhone(Boolean(result.data?.isTestPhone));
      setOtp(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      setStep("otp");
      toast({ title: resend ? "Code resent" : "Code sent", description: result.message });
    } catch (error) {
      failWith(error);
    } finally {
      setLoading(false);
    }
  };

  /** Enter a specific account: swap the ticket for a real session and route in. */
  const enterAccount = useCallback(
    async (account: LoginAccount, ticketValue: string) => {
      setEnteringId(account.id);
      try {
        const result = await loginAPI.selectAccount(ticketValue, account.id, account.type);
        const { token, user, member, userType } = result.data;
        const profile = account.type === "member" ? member : user;

        login(token, profile, userType);
        navigate(account.type === "member" ? "/member-dashboard" : getHomeRouteByRole(profile?.role));
      } catch (error) {
        failWith(error);
        setEnteringId(null);
      }
    },
    [failWith, login, navigate]
  );

  const verifyCode = async (code: string) => {
    if (code.length !== OTP_LENGTH || loading) return;

    setLoading(true);
    try {
      const result = await loginAPI.verifyOTP(phone, code);
      const found = (result.data?.accounts || []) as LoginAccount[];
      const issuedTicket: string = result.data?.ticket;

      setAccounts(found);
      setTicket(issuedTicket);

      // Nothing to choose between — go straight in.
      if (found.length === 1) {
        await enterAccount(found[0], issuedTicket);
        return;
      }
      setStep("accounts");
    } catch (error) {
      failWith(error);
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }

    // Handles both single keystrokes and a pasted / autofilled full code.
    const next = [...otp];
    for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i += 1) {
      next[index + i] = digits[i];
    }
    setOtp(next);

    const filledTo = Math.min(index + digits.length, OTP_LENGTH - 1);
    otpRefs.current[filledTo]?.focus();

    const joined = next.join("");
    if (joined.length === OTP_LENGTH && !joined.includes("")) {
      void verifyCode(joined);
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    if (event.key === "Enter") {
      event.preventDefault();
      void verifyCode(otpValue);
    }
  };

  const resetToPhone = () => {
    setStep("phone");
    setOtp(Array(OTP_LENGTH).fill(""));
    setAccounts([]);
    setTicket("");
    setSecondsLeft(0);
  };

  const heading = useMemo(() => {
    if (step === "phone") return { title: "Sign in", sub: "We'll send a one-time code to your WhatsApp." };
    if (step === "otp") return { title: "Check WhatsApp", sub: `Code sent to +91 ${phone}.` };
    return { title: "Choose an account", sub: "This number holds more than one role." };
  }, [step, phone]);

  return (
    <div className="min-h-[100dvh] bg-[#f6f2ec] text-stone-900 lg:grid lg:grid-cols-[47%_1fr] xl:grid-cols-[44%_1fr]">
      {/* ————— Brand panel — desktop only ————— */}
      <aside className="relative hidden overflow-hidden bg-[#191013] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        {/* Atmosphere: red ember glow + fine grid */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-[#e23636]/[0.16] blur-[120px]" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#e23636]/[0.09] blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          {/* Oversized watermark numeral of the current step */}
          <span
            aria-hidden
            className="absolute -bottom-16 -right-6 select-none text-[22rem] font-bold leading-none text-white/[0.035]"
            style={serif}
          >
            {stepIndex + 1}
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <img src="/logo.jpg" alt="" className="h-14 w-14 rounded-2xl object-contain ring-1 ring-white/10" />
          <div>
            <span className="block text-lg font-bold tracking-[0.18em] text-white">SOLIDARITY</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-stone-400">
              Organization Portal
            </span>
          </div>
        </div>

        <div className="relative z-10">
          <h1
            className="text-[3.4rem] font-semibold leading-[1.04] tracking-tight text-white xl:text-[4rem]"
            style={serif}
          >
            One number.
            <br />
            <span className="text-[#f0574f]">Every role.</span>
          </h1>

          {/* Live flow rail — highlights the step the user is on */}
          <ol className="mt-10 space-y-0">
            {FLOW.map((item, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <li key={item.title} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < FLOW.length - 1 && (
                    <span
                      className={cn(
                        "absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px",
                        done ? "bg-[#f0574f]/60" : "bg-white/10"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors duration-300",
                      active
                        ? "border-[#f0574f] bg-[#f0574f] text-white shadow-[0_0_24px_rgba(240,87,79,0.45)]"
                        : done
                          ? "border-[#f0574f]/60 bg-transparent text-[#f0574f]"
                          : "border-white/15 text-stone-500"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1">
                    <span
                      className={cn(
                        "block text-[15px] font-semibold transition-colors duration-300",
                        active ? "text-white" : done ? "text-stone-300" : "text-stone-500"
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-stone-500">{item.sub}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 backdrop-blur">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#f0574f]" />
          <p className="text-[13px] leading-relaxed text-stone-400">
            Codes are single-use and expire shortly after they&rsquo;re sent.
          </p>
        </div>
      </aside>

      {/* ————— Form panel ————— */}
      <main className="flex min-h-[100dvh] flex-col lg:min-h-0 lg:items-center lg:justify-center">
        <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-5 pb-6 pt-6 sm:justify-center sm:py-10 lg:flex-none lg:px-8">
          {/* Card on tablet+; bare, edge-to-edge form on phones */}
          <div className="flex flex-1 flex-col sm:flex-none sm:rounded-[1.75rem] sm:border sm:border-stone-200/80 sm:bg-white sm:p-9 sm:shadow-[0_24px_60px_-24px_rgba(28,18,16,0.18)] lg:p-10">
            {/* Brand row — hidden once the desktop panel shows it */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img src="/logo.jpg" alt="" className="h-11 w-11 rounded-xl object-contain ring-1 ring-stone-200" />
              <div>
                <span className="block text-[15px] font-bold tracking-[0.14em] text-stone-900">SOLIDARITY</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.24em] text-stone-400">
                  Organization Portal
                </span>
              </div>
              <span className="ml-auto rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold text-stone-500">
                {stepIndex + 1} / {FLOW.length}
              </span>
            </div>

            {step !== "phone" && (
              <button
                type="button"
                onClick={resetToPhone}
                disabled={Boolean(enteringId)}
                className="-ml-2 mb-4 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === "otp" ? "Change number" : "Start over"}
              </button>
            )}

            <header className="mb-7">
              <h2 className="text-[2rem] font-semibold tracking-tight text-stone-900 sm:text-[2.15rem]" style={serif}>
                {heading.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{heading.sub}</p>
            </header>

            {/* key={step} restarts the entrance animation on every step change */}
            <div key={step} className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              {step === "phone" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="login-phone" className="text-[13px] font-semibold text-stone-600">
                      Mobile number
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2.5 text-sm text-stone-500">
                        <Smartphone className="h-4 w-4 text-stone-400" />
                        <span className="font-semibold">+91</span>
                        <div className="h-5 w-px bg-stone-200" />
                      </div>
                      <Input
                        id="login-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void sendCode();
                          }
                        }}
                        maxLength={10}
                        className="h-14 rounded-2xl border-stone-200 bg-white pl-[6.5rem] text-base font-medium tracking-wide shadow-sm transition-shadow focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10"
                      />
                    </div>
                    {phone.length > 0 && !phoneIsValid && (
                      <p className="text-xs font-medium text-destructive">Enter a valid 10-digit mobile number.</p>
                    )}
                  </div>

                  <Button
                    onClick={() => void sendCode()}
                    disabled={!phoneIsValid || loading}
                    className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_10px_24px_-10px_rgba(226,54,54,0.55)] transition-all hover:shadow-[0_14px_30px_-10px_rgba(226,54,54,0.6)] active:scale-[0.99] disabled:shadow-none"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {loading ? "Sending code…" : "Send code"}
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>

                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs leading-relaxed text-stone-600">
                      Your code arrives on <span className="font-semibold text-stone-800">WhatsApp</span>. Make sure
                      this number is active on WhatsApp.
                    </p>
                  </div>
                </div>
              )}

              {step === "otp" && (
                <div className="space-y-6">
                  <fieldset>
                    <legend className="sr-only">Enter the {OTP_LENGTH}-digit code</legend>
                    <div className="flex justify-between gap-3 sm:justify-start">
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          ref={(el) => {
                            otpRefs.current[index] = el;
                          }}
                          type="tel"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                          disabled={loading}
                          className={cn(
                            "h-[66px] w-full max-w-[76px] flex-1 rounded-2xl border-stone-200 bg-white text-center text-2xl font-bold text-stone-900 shadow-sm transition-all",
                            "focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10",
                            digit && "border-primary/40 bg-primary/[0.03]"
                          )}
                        />
                      ))}
                    </div>
                  </fieldset>

                  {isTestPhone && (
                    <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                      Test number — use code <span className="font-bold">1234</span>.
                    </p>
                  )}

                  <Button
                    onClick={() => void verifyCode(otpValue)}
                    disabled={otpValue.length !== OTP_LENGTH || loading}
                    className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_10px_24px_-10px_rgba(226,54,54,0.55)] transition-all active:scale-[0.99] disabled:shadow-none"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {loading ? "Verifying…" : "Verify"}
                  </Button>

                  <div className="text-center text-sm text-stone-500">
                    {secondsLeft > 0 ? (
                      <span>
                        Resend available in{" "}
                        <span className="font-semibold tabular-nums text-stone-700">{secondsLeft}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void sendCode(true)}
                        disabled={loading}
                        className="font-semibold text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === "accounts" && (
                <div className="space-y-3">
                  {accounts.map((account) => {
                    const { icon: Icon } = getRoleDisplay(account.role, account.adminKind);
                    const isEntering = enteringId === account.id;
                    const isBusy = Boolean(enteringId);

                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => void enterAccount(account, ticket)}
                        disabled={isBusy}
                        className={cn(
                          "group flex w-full items-center gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4 text-left shadow-sm transition-all",
                          "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.99]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
                          isBusy && !isEntering && "opacity-50"
                        )}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-stone-900">
                            {account.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-stone-500">
                            {account.scope || account.name}
                          </span>
                        </span>

                        {isEntering ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-auto pt-8 sm:mt-0 lg:hidden">
              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400">
                <LockKeyhole className="h-3 w-3" />
                <span>Secure sign-in · codes are single-use</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
