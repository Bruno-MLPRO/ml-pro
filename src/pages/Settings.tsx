import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Settings() {
  const { userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Redirect if not administrator
  useEffect(() => {
    if (!authLoading && userRole !== 'administrator') {
      navigate('/gestor/dashboard');
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem acessar configurações.",
        variant: "destructive",
      });
    }
  }, [authLoading, userRole, navigate, toast]);
  
  // Apps state
  const [isCreateAppOpen, setIsCreateAppOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<{ id: string; name: string; url: string; description: string; price: number; color: string; coupon: string } | null>(null);
  const [appFormData, setAppFormData] = useState({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });

  // Fetch apps/extensions
  const { data: appsList = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ["apps_extensions"],
    queryFn: async () => {
      const { data, error} = await supabase
        .from("apps_extensions")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: userRole === "manager" || userRole === "administrator",
  });

  // Create app
  const createAppMutation = useMutation({
    mutationFn: async (appData: { name: string; url: string; description: string; price: number; color: string; coupon: string }) => {
      const { error } = await supabase.from("apps_extensions").insert([appData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps_extensions"] });
      toast({ title: "Aplicativo criado com sucesso!" });
      setIsCreateAppOpen(false);
      setAppFormData({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar aplicativo", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update app
  const updateAppMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; url: string; description: string; price: number; color: string; coupon: string } }) => {
      const { error } = await supabase
        .from("apps_extensions")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps_extensions"] });
      toast({ title: "Aplicativo atualizado com sucesso!" });
      setEditingApp(null);
      setAppFormData({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar aplicativo", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete app
  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apps_extensions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps_extensions"] });
      toast({ title: "Aplicativo excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir aplicativo", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(appFormData.price);
    
    if (!appFormData.name) {
      toast({ 
        title: "Erro de validação", 
        description: "Preencha o nome do aplicativo",
        variant: "destructive" 
      });
      return;
    }

    if (editingApp) {
      updateAppMutation.mutate({ 
        id: editingApp.id, 
        data: { 
          name: appFormData.name, 
          url: appFormData.url, 
          description: appFormData.description, 
          price: isNaN(price) ? 0 : price, 
          color: appFormData.color,
          coupon: appFormData.coupon 
        } 
      });
    } else {
      createAppMutation.mutate({ 
        name: appFormData.name, 
        url: appFormData.url, 
        description: appFormData.description, 
        price: isNaN(price) ? 0 : price, 
        color: appFormData.color,
        coupon: appFormData.coupon 
      });
    }
  };

  const openEditAppDialog = (app: any) => {
    setEditingApp(app);
    setAppFormData({ 
      name: app.name, 
      url: app.url || "",
      description: app.description || "",
      price: app.price?.toString() || "",
      color: app.color || "#3B82F6",
      coupon: app.coupon || ""
    });
  };

  const closeAppDialog = () => {
    setEditingApp(null);
    setIsCreateAppOpen(false);
    setAppFormData({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });
  };

  if (userRole !== "manager" && userRole !== "administrator") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
            <p className="text-foreground-secondary mt-1">Gerencie aplicativos e extensões do sistema</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isCreateAppOpen} onOpenChange={setIsCreateAppOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Aplicativo/Extensão
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <form onSubmit={handleAppSubmit}>
                    <DialogHeader>
                      <DialogTitle>Criar Aplicativo/Extensão</DialogTitle>
                      <DialogDescription>
                        Preencha as informações do aplicativo ou extensão
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="app-name">Nome</Label>
                        <Input
                          id="app-name"
                          placeholder="Ex: Tiny ERP"
                          value={appFormData.name}
                          onChange={(e) => setAppFormData({ ...appFormData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-url">URL</Label>
                        <Input
                          id="app-url"
                          type="url"
                          placeholder="https://exemplo.com"
                          value={appFormData.url}
                          onChange={(e) => setAppFormData({ ...appFormData, url: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-description">Descrição</Label>
                        <Textarea
                          id="app-description"
                          placeholder="Descreva o aplicativo..."
                          value={appFormData.description}
                          onChange={(e) => setAppFormData({ ...appFormData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-price">Preço (Mensalidade básica R$)</Label>
                        <Input
                          id="app-price"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 99.90"
                          value={appFormData.price}
                          onChange={(e) => setAppFormData({ ...appFormData, price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-color">Cor</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="app-color"
                            type="color"
                            value={appFormData.color}
                            onChange={(e) => setAppFormData({ ...appFormData, color: e.target.value })}
                            className="w-20 h-10 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={appFormData.color}
                            onChange={(e) => setAppFormData({ ...appFormData, color: e.target.value })}
                            placeholder="#3B82F6"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-coupon">Cupom</Label>
                        <Input
                          id="app-coupon"
                          placeholder="Ex: PROMO2024"
                          value={appFormData.coupon}
                          onChange={(e) => setAppFormData({ ...appFormData, coupon: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={closeAppDialog}>
                        Cancelar
                      </Button>
                      <Button type="submit">Criar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Aplicativos e Extensões Cadastrados</CardTitle>
                <CardDescription>
                  Lista de todos os aplicativos e extensões disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingApps ? (
                  <p className="text-center text-foreground-secondary py-8">Carregando...</p>
                ) : appsList.length === 0 ? (
                  <p className="text-center text-foreground-secondary py-8">
                    Nenhum aplicativo cadastrado ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {appsList.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-background-elevated transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full border border-border" 
                              style={{ backgroundColor: app.color || '#3B82F6' }}
                            />
                            <h3 className="font-semibold text-foreground">{app.name}</h3>
                          </div>
                          {app.url && (
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline mt-1 inline-block"
                            >
                              {app.url}
                            </a>
                          )}
                          {app.description && (
                            <p className="text-sm text-foreground-secondary mt-1">
                              {app.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {app.price && (
                              <p className="text-sm font-medium text-foreground">
                                R$ {Number(app.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                              </p>
                            )}
                            {app.coupon && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                                Cupom: {app.coupon}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Dialog open={editingApp?.id === app.id} onOpenChange={(open) => !open && closeAppDialog()}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditAppDialog(app)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <form onSubmit={handleAppSubmit}>
                                <DialogHeader>
                                  <DialogTitle>Editar Aplicativo/Extensão</DialogTitle>
                                  <DialogDescription>
                                    Atualize as informações do aplicativo
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-name">Nome</Label>
                                    <Input
                                      id="edit-app-name"
                                      value={appFormData.name}
                                      onChange={(e) => setAppFormData({ ...appFormData, name: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-url">URL</Label>
                                    <Input
                                      id="edit-app-url"
                                      type="url"
                                      value={appFormData.url}
                                      onChange={(e) => setAppFormData({ ...appFormData, url: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-description">Descrição</Label>
                                    <Textarea
                                      id="edit-app-description"
                                      value={appFormData.description}
                                      onChange={(e) => setAppFormData({ ...appFormData, description: e.target.value })}
                                      rows={3}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-price">Preço (Mensalidade básica R$)</Label>
                                    <Input
                                      id="edit-app-price"
                                      type="number"
                                      step="0.01"
                                      value={appFormData.price}
                                      onChange={(e) => setAppFormData({ ...appFormData, price: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-color">Cor</Label>
                                    <div className="flex gap-2 items-center">
                                      <Input
                                        id="edit-app-color"
                                        type="color"
                                        value={appFormData.color}
                                        onChange={(e) => setAppFormData({ ...appFormData, color: e.target.value })}
                                        className="w-20 h-10 cursor-pointer"
                                      />
                                      <Input
                                        type="text"
                                        value={appFormData.color}
                                        onChange={(e) => setAppFormData({ ...appFormData, color: e.target.value })}
                                        placeholder="#3B82F6"
                                        className="flex-1"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-app-coupon">Cupom</Label>
                                    <Input
                                      id="edit-app-coupon"
                                      placeholder="Ex: PROMO2024"
                                      value={appFormData.coupon}
                                      onChange={(e) => setAppFormData({ ...appFormData, coupon: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button type="button" variant="outline" onClick={closeAppDialog}>
                                    Cancelar
                                  </Button>
                                  <Button type="submit">Salvar</Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir este aplicativo?")) {
                                deleteAppMutation.mutate(app.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
