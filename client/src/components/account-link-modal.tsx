import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Link, Mail, MessageSquare, ArrowRight, RefreshCw } from "lucide-react";

type ModalStep = "form" | "otp" | "success";

interface AccountLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccountLinkModal({ open, onClose, onSuccess }: AccountLinkModalProps) {
  const [step, setStep] = useState<ModalStep>("form");
  const [targetEmail, setTargetEmail] = useState("");
  const [rc, setRc] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initiateResult, setInitiateResult] = useState<{
    method: "email" | "sms";
    maskedTarget: string;
    targetName: string;
    isReactivation: boolean;
  } | null>(null);

  const resetForm = () => {
    setStep("form");
    setTargetEmail("");
    setRc("");
    setOtp("");
    setError(null);
    setInitiateResult(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!targetEmail.trim()) { setError("Zadajte email cieľového účtu"); return; }
    if (!rc.trim()) { setError("Zadajte vaše rodné číslo"); return; }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/account-link/initiate", {
        targetEmail: targetEmail.trim(),
        rc: rc.trim(),
      });
      const data = await res.json();
      setInitiateResult(data);
      setStep("otp");
    } catch (err: any) {
      const msg = err?.message || "";
      try {
        const parsed = JSON.parse(msg.replace(/^\d+:\s*/, ""));
        setError(parsed.message || "Chyba pri overovaní");
      } catch {
        setError("Chyba pri odosielaní žiadosti");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) { setError("OTP kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/account-link/verify", { otp: otp.trim() });
      setStep("success");
    } catch (err: any) {
      const msg = err?.message || "";
      try {
        const parsed = JSON.parse(msg.replace(/^\d+:\s*/, ""));
        setError(parsed.message || "Nesprávny OTP kód");
      } catch {
        setError("Nesprávny OTP kód");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    resetForm();
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        {step === "form" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle>Prepojiť nový účet</DialogTitle>
              <DialogDescription>
                Prepojte svoje kontexty — po prepojení môžete prepínať medzi nimi jedným klikom bez opakovaného prihlasovania.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitiate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="al-email">Email cieľového účtu</Label>
                <Input
                  id="al-email"
                  type="email"
                  placeholder="email@priklad.sk"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  autoFocus
                  data-testid="input-account-link-email"
                />
                <p className="text-xs text-muted-foreground">Email prihlásenia do druhého účtu v systéme ATK</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="al-rc">Vaše rodné číslo</Label>
                <Input
                  id="al-rc"
                  type="text"
                  placeholder="YYMMDD/XXXX"
                  value={rc}
                  onChange={(e) => setRc(e.target.value)}
                  data-testid="input-account-link-rc"
                />
                <p className="text-xs text-muted-foreground">Potvrdí, že oba kontexty patria vám. Nikde sa neukladá.</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                Potvrdením preberáte zodpovednosť za akcie vykonané v prepojenom kontexte.
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleClose} data-testid="button-account-link-cancel">
                  Zrušiť
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !targetEmail.trim() || !rc.trim()}
                  data-testid="button-account-link-submit"
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  {loading ? "Overujem..." : "Odoslať OTP"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "otp" && initiateResult && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                {initiateResult.method === "email" ? (
                  <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <DialogTitle>Zadajte overovací kód</DialogTitle>
              <DialogDescription>
                Kód bol odoslaný {initiateResult.method === "email" ? "na email" : "cez SMS"}{" "}
                <span className="font-semibold text-foreground">{initiateResult.maskedTarget}</span>
              </DialogDescription>
            </DialogHeader>

            {initiateResult.isReactivation && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-sm text-orange-800 dark:text-orange-300">
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Toto prepojenie bolo predtým prerušené. Overte sa znova pre jeho obnovenie.</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="text-muted-foreground text-xs mb-1">Prepájate s účtom</p>
              <p className="font-semibold">{initiateResult.targetName}</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="al-otp">6-ciferný kód</Label>
                <Input
                  id="al-otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="text-center text-2xl font-mono tracking-widest"
                  data-testid="input-account-link-otp"
                />
                <p className="text-xs text-muted-foreground text-center">Platnosť kódu vyprší o 10 minút</p>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep("form"); setError(null); setOtp(""); }} data-testid="button-account-link-back">
                  Späť
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={loading || otp.trim().length !== 6}
                  data-testid="button-account-link-verify"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {loading ? "Overujem..." : "Potvrdiť"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2 mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center">Kontexty prepojené</DialogTitle>
              <DialogDescription className="text-center">
                {initiateResult?.isReactivation
                  ? "Prepojenie bolo úspešne obnovené."
                  : "Nové prepojenie bolo vytvorené."}{" "}
                Môžete prepínať medzi kontextmi v hornej lište systému.
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSuccessClose} data-testid="button-account-link-done">
              Hotovo
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
