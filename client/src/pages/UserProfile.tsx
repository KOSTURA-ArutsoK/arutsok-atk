import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound, User } from "lucide-react";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadajte aktuálne heslo"),
    newPassword: z.string().min(6, "Nové heslo musí mať aspoň 6 znakov"),
    confirmPassword: z.string().min(1, "Potvrďte nové heslo"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Heslá sa nezhodujú",
    path: ["confirmPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function UserProfile() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("POST", "/api/me/change-password", data),
    onSuccess: () => {
      toast({ title: "Heslo bolo úspešne zmenené" });
      setSuccess(true);
      form.reset();
    },
    onError: async (err: any) => {
      let msg = "Nepodarilo sa zmeniť heslo";
      try {
        const body = await err?.response?.json?.();
        if (body?.message) msg = body.message;
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    setSuccess(false);
    mutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const displayName =
    [appUser?.firstName, appUser?.lastName].filter(Boolean).join(" ") ||
    appUser?.username ||
    "Používateľ";

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-profile-title">
          Môj profil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nastavenia vášho účtu
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Informácie o účte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Meno</span>
            <span className="font-medium" data-testid="text-profile-name">{displayName}</span>
          </div>
          {appUser?.email && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 shrink-0">E-mail</span>
              <span className="font-medium" data-testid="text-profile-email">{appUser.email}</span>
            </div>
          )}
          {appUser?.role && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Rola</span>
              <span className="font-medium capitalize" data-testid="text-profile-role">{appUser.role}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            Zmena hesla
          </CardTitle>
          <CardDescription>
            Heslo musí mať aspoň 6 znakov.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aktuálne heslo</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        data-testid="input-current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nové heslo</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        data-testid="input-new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potvrdiť nové heslo</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {success && (
                <p className="text-sm text-emerald-500 font-medium" data-testid="text-password-success">
                  Heslo bolo úspešne zmenené.
                </p>
              )}

              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-change-password"
                className="w-full"
              >
                {mutation.isPending ? "Ukladám..." : "Zmeniť heslo"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
