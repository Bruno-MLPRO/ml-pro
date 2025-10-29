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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, Lock, Check } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Interface removida - usando tipo centralizado de @/types/students
import type { ProfileData } from "@/types/students";

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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    tipo_pj: "Não tenho",
    cnpj: "",
    possui_contador: false,
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
  });

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
      setEditForm({
        full_name: data?.full_name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        cpf: data?.cpf || "",
        tipo_pj: data?.tipo_pj || "Não tenho",
        cnpj: data?.cnpj || "",
        possui_contador: data?.possui_contador || false,
        endereco: data?.endereco || "",
        cidade: data?.cidade || "",
        estado: data?.estado || "",
        cep: data?.cep || "",
      });
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

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          cpf: editForm.cpf,
          tipo_pj: editForm.tipo_pj === "Não tenho" || !editForm.tipo_pj ? null : editForm.tipo_pj,
          cnpj: editForm.tipo_pj === "Não tenho" || !editForm.tipo_pj ? null : editForm.cnpj,
          possui_contador: editForm.possui_contador,
          endereco: editForm.endereco,
          cidade: editForm.cidade,
          estado: editForm.estado,
          cep: editForm.cep,
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update email in auth if it changed
      if (editForm.email !== profileData?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editForm.email,
        });

        if (emailError) throw emailError;
      }

      toast({
        title: "Perfil atualizado com sucesso",
        description: "Suas informações foram atualizadas",
      });

      setIsEditingProfile(false);
      loadProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message || "Não foi possível atualizar o perfil",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-primary" />
                      <CardTitle>Informações Pessoais</CardTitle>
                    </div>
                    <CardDescription>
                      Seus dados cadastrados na plataforma
                    </CardDescription>
                  </div>
                  {!isEditingProfile ? (
                    <Button onClick={() => setIsEditingProfile(true)} variant="outline">
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                      setIsEditingProfile(false);
                      setEditForm({
                        full_name: profileData?.full_name || "",
                        email: profileData?.email || "",
                        phone: profileData?.phone || "",
                        cpf: profileData?.cpf || "",
                        tipo_pj: profileData?.tipo_pj || "Não tenho",
                        cnpj: profileData?.cnpj || "",
                        possui_contador: profileData?.possui_contador || false,
                        endereco: profileData?.endereco || "",
                        cidade: profileData?.cidade || "",
                        estado: profileData?.estado || "",
                        cep: profileData?.cep || "",
                      });
                    }}
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                        {isSavingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Nome Completo</Label>
                    {isEditingProfile ? (
                      <Input
                        id="full_name"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium mt-1">{profileData?.full_name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    {isEditingProfile ? (
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium mt-1">{profileData?.email}</p>
                    )}
                  </div>
                  {profileData?.phone !== undefined && (
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      {isEditingProfile ? (
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-foreground font-medium mt-1">{profileData.phone || "-"}</p>
                      )}
                    </div>
                  )}
                  {userRole === 'student' && (
                    <>
                      <div>
                        <Label htmlFor="cpf">CPF</Label>
                        {isEditingProfile ? (
                          <Input
                            id="cpf"
                            value={editForm.cpf}
                            onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                            placeholder="000.000.000-00"
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-foreground font-medium mt-1">{profileData?.cpf || "-"}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="tipo_cnpj">Tipo de CNPJ</Label>
                        {isEditingProfile ? (
                          <Select 
                            value={editForm.tipo_pj || "Não tenho"} 
                            onValueChange={(value) => setEditForm({ ...editForm, tipo_pj: value, cnpj: value === "Não tenho" ? "" : editForm.cnpj })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Não tenho">Não tenho</SelectItem>
                              <SelectItem value="MEI">MEI</SelectItem>
                              <SelectItem value="ME">ME</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-foreground font-medium mt-1">{profileData?.tipo_pj || "Não tenho"}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="cnpj">Número do CNPJ</Label>
                        {isEditingProfile ? (
                          <Input
                            id="cnpj"
                            value={editForm.cnpj}
                            onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                            placeholder="00.000.000/0000-00"
                            disabled={editForm.tipo_pj === "Não tenho" || !editForm.tipo_pj}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-foreground font-medium mt-1">{profileData?.cnpj || "-"}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        {isEditingProfile ? (
                          <>
                            <Checkbox
                              id="possui_contador"
                              checked={editForm.possui_contador}
                              onCheckedChange={(checked) => setEditForm({ ...editForm, possui_contador: checked === true })}
                            />
                            <Label htmlFor="possui_contador" className="cursor-pointer font-normal">
                              Tenho contador
                            </Label>
                          </>
                        ) : (
                          <>
                            <div className={cn(
                              "h-4 w-4 rounded-sm border flex items-center justify-center",
                              profileData?.possui_contador ? "bg-primary border-primary" : "border-input"
                            )}>
                              {profileData?.possui_contador && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <Label className="font-normal">Tenho contador</Label>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {profileData?.turma && (
                    <div>
                      <Label className="text-foreground-secondary">Turma</Label>
                      <p className="text-foreground font-medium mt-1">{profileData.turma}</p>
                    </div>
                  )}
                  {userRole === 'student' && profileData?.mentoria_status && (
                    <div>
                      <Label className="text-foreground-secondary">Status da Mentoria</Label>
                      <p className="text-foreground font-medium mt-1">{profileData.mentoria_status}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-primary" />
                      <CardTitle>Endereço</CardTitle>
                    </div>
                    <CardDescription>
                      Informações de endereço para correspondências
                    </CardDescription>
                  </div>
                  {!isEditingProfile ? (
                    <Button onClick={() => setIsEditingProfile(true)} variant="outline">
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setIsEditingProfile(false);
                          setEditForm({
                            full_name: profileData?.full_name || "",
                            email: profileData?.email || "",
                            phone: profileData?.phone || "",
                            cpf: profileData?.cpf || "",
                            tipo_pj: profileData?.tipo_pj || "Não tenho",
                            cnpj: profileData?.cnpj || "",
                            possui_contador: profileData?.possui_contador || false,
                            endereco: profileData?.endereco || "",
                            cidade: profileData?.cidade || "",
                            estado: profileData?.estado || "",
                            cep: profileData?.cep || "",
                          });
                        }} 
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                        {isSavingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="endereco">Endereço Completo</Label>
                    {isEditingProfile ? (
                      <Input
                        id="endereco"
                        value={editForm.endereco}
                        onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
                        placeholder="Rua, número, complemento"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium mt-1">{profileData?.endereco || "-"}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      {isEditingProfile ? (
                        <Input
                          id="cidade"
                          value={editForm.cidade}
                          onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                          placeholder="Cidade"
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-foreground font-medium mt-1">{profileData?.cidade || "-"}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="estado">Estado</Label>
                      {isEditingProfile ? (
                        <Input
                          id="estado"
                          value={editForm.estado}
                          onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                          placeholder="UF"
                          maxLength={2}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-foreground font-medium mt-1">{profileData?.estado || "-"}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      {isEditingProfile ? (
                        <Input
                          id="cep"
                          value={editForm.cep}
                          onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })}
                          placeholder="00000-000"
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-foreground font-medium mt-1">{profileData?.cep || "-"}</p>
                      )}
                    </div>
                  </div>
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
