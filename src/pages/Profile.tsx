import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, Lock } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface ProfileData {
  full_name: string;
  email: string;
  phone: string | null;
  turma: string | null;
  estrutura_vendedor: string | null;
  tipo_pj: string | null;
  possui_contador: boolean | null;
  caixa: number | null;
  hub_logistico: string | null;
  sistemas_externos: string | null;
  mentoria_status: string | null;
}

export default function Profile() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfileData(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar os dados do perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setPasswordErrors({});
      const validation = passwordSchema.safeParse(passwordForm);
      
      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0] as string] = error.message;
          }
        });
        setPasswordErrors(errors);
        return;
      }

      setIsChangingPassword(true);

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Senha atual incorreta" });
        setIsChangingPassword(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Senha alterada com sucesso",
        description: "Sua senha foi atualizada",
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-foreground mb-2">
              Meu Perfil
            </h1>
            <p className="text-foreground-secondary">
              Gerencie suas informações pessoais e configurações de conta
            </p>
          </div>

          <div className="space-y-6">
            {/* Personal Information Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  <CardTitle>Informações Pessoais</CardTitle>
                </div>
                <CardDescription>
                  Seus dados cadastrados na plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground-secondary">Nome Completo</Label>
                    <p className="text-foreground font-medium mt-1">{profileData?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-foreground-secondary">Email</Label>
                    <p className="text-foreground font-medium mt-1">{profileData?.email}</p>
                  </div>
                  {profileData?.phone && (
                    <div>
                      <Label className="text-foreground-secondary">Telefone</Label>
                      <p className="text-foreground font-medium mt-1">{profileData.phone}</p>
                    </div>
                  )}
                  {profileData?.turma && (
                    <div>
                      <Label className="text-foreground-secondary">Turma</Label>
                      <p className="text-foreground font-medium mt-1">{profileData.turma}</p>
                    </div>
                  )}
                  {userRole === 'student' && (
                    <>
                      {profileData?.estrutura_vendedor && (
                        <div>
                          <Label className="text-foreground-secondary">Estrutura de Vendedor</Label>
                          <p className="text-foreground font-medium mt-1">
                            {profileData.estrutura_vendedor === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física (CPF)'}
                          </p>
                        </div>
                      )}
                      {profileData?.tipo_pj && (
                        <div>
                          <Label className="text-foreground-secondary">Tipo de PJ</Label>
                          <p className="text-foreground font-medium mt-1">{profileData.tipo_pj}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-foreground-secondary">Possui Contador</Label>
                        <p className="text-foreground font-medium mt-1">
                          {profileData?.possui_contador ? 'Sim' : 'Não'}
                        </p>
                      </div>
                      {profileData?.caixa !== null && (
                        <div>
                          <Label className="text-foreground-secondary">Caixa (Capital de Giro)</Label>
                          <p className="text-foreground font-medium mt-1">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profileData.caixa)}
                          </p>
                        </div>
                      )}
                      {profileData?.hub_logistico && (
                        <div>
                          <Label className="text-foreground-secondary">Hub Logístico</Label>
                          <p className="text-foreground font-medium mt-1">{profileData.hub_logistico}</p>
                        </div>
                      )}
                      {profileData?.sistemas_externos && (
                        <div>
                          <Label className="text-foreground-secondary">Sistemas Externos</Label>
                          <p className="text-foreground font-medium mt-1">{profileData.sistemas_externos}</p>
                        </div>
                      )}
                      {profileData?.mentoria_status && (
                        <div>
                          <Label className="text-foreground-secondary">Status da Mentoria</Label>
                          <p className="text-foreground font-medium mt-1">{profileData.mentoria_status}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <CardTitle>Alterar Senha</CardTitle>
                </div>
                <CardDescription>
                  Atualize sua senha de acesso à plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  <div>
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className={passwordErrors.currentPassword ? "border-destructive" : ""}
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-sm text-destructive mt-1">{passwordErrors.currentPassword}</p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className={passwordErrors.newPassword ? "border-destructive" : ""}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-sm text-destructive mt-1">{passwordErrors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className={passwordErrors.confirmPassword ? "border-destructive" : ""}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-sm text-destructive mt-1">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>

                  <Button 
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="w-full"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      'Alterar Senha'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
