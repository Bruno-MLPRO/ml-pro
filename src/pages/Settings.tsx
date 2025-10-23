import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  
  // Plans state
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ id: string; name: string; price: number } | null>(null);
  const [planFormData, setPlanFormData] = useState({ name: "", price: "", selectedBonusIds: [] as string[] });
  
  // Bonus state
  const [isCreateBonusOpen, setIsCreateBonusOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<{ id: string; name: string; cost: number; description: string } | null>(null);
  const [bonusFormData, setBonusFormData] = useState({ name: "", cost: "", description: "" });

  // Apps state
  const [isCreateAppOpen, setIsCreateAppOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<{ id: string; name: string; url: string; description: string; price: number; color: string; coupon: string } | null>(null);
  const [appFormData, setAppFormData] = useState({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });

  // Fetch plans with bonus
  const { data: plans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select(`
          *,
          plan_bonus (
            bonus_id,
            bonus (*)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: userRole === "manager",
  });

  // Fetch bonus
  const { data: bonusList = [], isLoading: isLoadingBonus } = useQuery({
    queryKey: ["bonus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: userRole === "manager",
  });

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
    enabled: userRole === "manager",
  });

  // Create plan with bonus
  const createPlanMutation = useMutation({
    mutationFn: async (planData: { name: string; price: number; bonusIds: string[] }) => {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .insert([{ name: planData.name, price: planData.price }])
        .select()
        .single();
      
      if (planError) throw planError;

      // Insert plan_bonus relationships
      if (planData.bonusIds.length > 0) {
        const planBonusData = planData.bonusIds.map(bonusId => ({
          plan_id: plan.id,
          bonus_id: bonusId
        }));
        const { error: bonusError } = await supabase
          .from("plan_bonus")
          .insert(planBonusData);
        if (bonusError) throw bonusError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano criado com sucesso!" });
      setIsCreatePlanOpen(false);
      setPlanFormData({ name: "", price: "", selectedBonusIds: [] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar plano", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update plan with bonus
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; price: number; bonusIds: string[] } }) => {
      const { error: planError } = await supabase
        .from("plans")
        .update({ name: data.name, price: data.price })
        .eq("id", id);
      if (planError) throw planError;

      // Delete existing plan_bonus relationships
      const { error: deleteError } = await supabase
        .from("plan_bonus")
        .delete()
        .eq("plan_id", id);
      if (deleteError) throw deleteError;

      // Insert new plan_bonus relationships
      if (data.bonusIds.length > 0) {
        const planBonusData = data.bonusIds.map(bonusId => ({
          plan_id: id,
          bonus_id: bonusId
        }));
        const { error: bonusError } = await supabase
          .from("plan_bonus")
          .insert(planBonusData);
        if (bonusError) throw bonusError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano atualizado com sucesso!" });
      setEditingPlan(null);
      setPlanFormData({ name: "", price: "", selectedBonusIds: [] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar plano", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete plan
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir plano", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create bonus
  const createBonusMutation = useMutation({
    mutationFn: async (bonusData: { name: string; cost: number; description: string }) => {
      const { error } = await supabase.from("bonus").insert([bonusData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonus"] });
      toast({ title: "Bônus criado com sucesso!" });
      setIsCreateBonusOpen(false);
      setBonusFormData({ name: "", cost: "", description: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar bônus", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update bonus
  const updateBonusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; cost: number; description: string } }) => {
      const { error } = await supabase
        .from("bonus")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonus"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Bônus atualizado com sucesso!" });
      setEditingBonus(null);
      setBonusFormData({ name: "", cost: "", description: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar bônus", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete bonus
  const deleteBonusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bonus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonus"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Bônus excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir bônus", 
        description: error.message,
        variant: "destructive" 
      });
    },
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

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(planFormData.price);
    
    if (!planFormData.name || isNaN(price) || price <= 0) {
      toast({ 
        title: "Erro de validação", 
        description: "Preencha todos os campos corretamente",
        variant: "destructive" 
      });
      return;
    }

    if (editingPlan) {
      updatePlanMutation.mutate({ 
        id: editingPlan.id, 
        data: { name: planFormData.name, price, bonusIds: planFormData.selectedBonusIds } 
      });
    } else {
      createPlanMutation.mutate({ name: planFormData.name, price, bonusIds: planFormData.selectedBonusIds });
    }
  };

  const handleBonusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(bonusFormData.cost);
    
    if (!bonusFormData.name || isNaN(cost) || cost <= 0) {
      toast({ 
        title: "Erro de validação", 
        description: "Preencha todos os campos corretamente",
        variant: "destructive" 
      });
      return;
    }

    if (editingBonus) {
      updateBonusMutation.mutate({ 
        id: editingBonus.id, 
        data: { name: bonusFormData.name, cost, description: bonusFormData.description } 
      });
    } else {
      createBonusMutation.mutate({ name: bonusFormData.name, cost, description: bonusFormData.description });
    }
  };

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

  const openEditPlanDialog = (plan: any) => {
    setEditingPlan(plan);
    const bonusIds = plan.plan_bonus?.map((pb: any) => pb.bonus_id) || [];
    setPlanFormData({ 
      name: plan.name, 
      price: plan.price.toString(),
      selectedBonusIds: bonusIds
    });
  };

  const openEditBonusDialog = (bonus: any) => {
    setEditingBonus(bonus);
    setBonusFormData({ 
      name: bonus.name, 
      cost: bonus.cost.toString(),
      description: bonus.description || ""
    });
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

  const closePlanDialog = () => {
    setEditingPlan(null);
    setIsCreatePlanOpen(false);
    setPlanFormData({ name: "", price: "", selectedBonusIds: [] });
  };

  const closeBonusDialog = () => {
    setEditingBonus(null);
    setIsCreateBonusOpen(false);
    setBonusFormData({ name: "", cost: "", description: "" });
  };

  const closeAppDialog = () => {
    setEditingApp(null);
    setIsCreateAppOpen(false);
    setAppFormData({ name: "", url: "", description: "", price: "", color: "#3B82F6", coupon: "" });
  };

  if (userRole !== "manager") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
            <p className="text-foreground-secondary mt-1">Gerencie planos e bônus do sistema</p>
          </div>

          <Tabs defaultValue="plans" className="w-full">
            <TabsList>
              <TabsTrigger value="plans">Planos</TabsTrigger>
              <TabsTrigger value="bonus">Bônus</TabsTrigger>
              <TabsTrigger value="apps">Aplicativos e Extensões</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={isCreatePlanOpen} onOpenChange={setIsCreatePlanOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Plano
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <form onSubmit={handlePlanSubmit}>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Plano</DialogTitle>
                        <DialogDescription>
                          Preencha as informações do novo plano
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome do Plano</Label>
                          <Input
                            id="name"
                            placeholder="Ex: ML PRO - Turma 3 Starter"
                            value={planFormData.name}
                            onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="price">Preço (R$)</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            placeholder="Ex: 4000"
                            value={planFormData.price}
                            onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bônus inclusos</Label>
                          <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                            {bonusList.map((bonus) => (
                              <div key={bonus.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`bonus-${bonus.id}`}
                                  checked={planFormData.selectedBonusIds.includes(bonus.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setPlanFormData({
                                        ...planFormData,
                                        selectedBonusIds: [...planFormData.selectedBonusIds, bonus.id]
                                      });
                                    } else {
                                      setPlanFormData({
                                        ...planFormData,
                                        selectedBonusIds: planFormData.selectedBonusIds.filter(id => id !== bonus.id)
                                      });
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`bonus-${bonus.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {bonus.name} - R$ {Number(bonus.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </label>
                              </div>
                            ))}
                            {bonusList.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhum bônus cadastrado
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={closePlanDialog}>
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
                  <CardTitle>Planos Cadastrados</CardTitle>
                  <CardDescription>
                    Lista de todos os planos disponíveis no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPlans ? (
                    <p className="text-center text-foreground-secondary py-8">Carregando...</p>
                  ) : plans.length === 0 ? (
                    <p className="text-center text-foreground-secondary py-8">
                      Nenhum plano cadastrado ainda
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {plans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-background-elevated transition-colors"
                        >
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{plan.name}</h3>
                            <p className="text-sm text-foreground-secondary mt-1">
                              R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {plan.plan_bonus && plan.plan_bonus.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {plan.plan_bonus.map((pb: any) => (
                                  <span 
                                    key={pb.bonus_id} 
                                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                                  >
                                    {pb.bonus.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={editingPlan?.id === plan.id} onOpenChange={(open) => !open && closePlanDialog()}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPlanDialog(plan)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <form onSubmit={handlePlanSubmit}>
                                  <DialogHeader>
                                    <DialogTitle>Editar Plano</DialogTitle>
                                    <DialogDescription>
                                      Atualize as informações do plano
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-name">Nome do Plano</Label>
                                      <Input
                                        id="edit-name"
                                        value={planFormData.name}
                                        onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-price">Preço (R$)</Label>
                                      <Input
                                        id="edit-price"
                                        type="number"
                                        step="0.01"
                                        value={planFormData.price}
                                        onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Bônus inclusos</Label>
                                      <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                                        {bonusList.map((bonus) => (
                                          <div key={bonus.id} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`edit-bonus-${bonus.id}`}
                                              checked={planFormData.selectedBonusIds.includes(bonus.id)}
                                              onCheckedChange={(checked) => {
                                                if (checked) {
                                                  setPlanFormData({
                                                    ...planFormData,
                                                    selectedBonusIds: [...planFormData.selectedBonusIds, bonus.id]
                                                  });
                                                } else {
                                                  setPlanFormData({
                                                    ...planFormData,
                                                    selectedBonusIds: planFormData.selectedBonusIds.filter(id => id !== bonus.id)
                                                  });
                                                }
                                              }}
                                            />
                                            <label
                                              htmlFor={`edit-bonus-${bonus.id}`}
                                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                              {bonus.name} - R$ {Number(bonus.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={closePlanDialog}>
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
                                if (confirm("Tem certeza que deseja excluir este plano?")) {
                                  deletePlanMutation.mutate(plan.id);
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
            </TabsContent>

            <TabsContent value="bonus" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={isCreateBonusOpen} onOpenChange={setIsCreateBonusOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Bônus
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleBonusSubmit}>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Bônus</DialogTitle>
                        <DialogDescription>
                          Preencha as informações do novo bônus
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="bonus-name">Nome</Label>
                          <Input
                            id="bonus-name"
                            placeholder="Ex: Consultoria Individual"
                            value={bonusFormData.name}
                            onChange={(e) => setBonusFormData({ ...bonusFormData, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bonus-cost">Custo (R$)</Label>
                          <Input
                            id="bonus-cost"
                            type="number"
                            step="0.01"
                            placeholder="Ex: 500"
                            value={bonusFormData.cost}
                            onChange={(e) => setBonusFormData({ ...bonusFormData, cost: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bonus-description">Descrição</Label>
                          <Textarea
                            id="bonus-description"
                            placeholder="Descreva o bônus..."
                            value={bonusFormData.description}
                            onChange={(e) => setBonusFormData({ ...bonusFormData, description: e.target.value })}
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeBonusDialog}>
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
                  <CardTitle>Bônus Cadastrados</CardTitle>
                  <CardDescription>
                    Lista de todos os bônus disponíveis no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBonus ? (
                    <p className="text-center text-foreground-secondary py-8">Carregando...</p>
                  ) : bonusList.length === 0 ? (
                    <p className="text-center text-foreground-secondary py-8">
                      Nenhum bônus cadastrado ainda
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {bonusList.map((bonus) => (
                        <div
                          key={bonus.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-background-elevated transition-colors"
                        >
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{bonus.name}</h3>
                            <p className="text-sm text-foreground-secondary mt-1">
                              R$ {Number(bonus.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {bonus.description && (
                              <p className="text-sm text-foreground-secondary mt-1">
                                {bonus.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={editingBonus?.id === bonus.id} onOpenChange={(open) => !open && closeBonusDialog()}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditBonusDialog(bonus)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <form onSubmit={handleBonusSubmit}>
                                  <DialogHeader>
                                    <DialogTitle>Editar Bônus</DialogTitle>
                                    <DialogDescription>
                                      Atualize as informações do bônus
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-bonus-name">Nome</Label>
                                      <Input
                                        id="edit-bonus-name"
                                        value={bonusFormData.name}
                                        onChange={(e) => setBonusFormData({ ...bonusFormData, name: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-bonus-cost">Custo (R$)</Label>
                                      <Input
                                        id="edit-bonus-cost"
                                        type="number"
                                        step="0.01"
                                        value={bonusFormData.cost}
                                        onChange={(e) => setBonusFormData({ ...bonusFormData, cost: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-bonus-description">Descrição</Label>
                                      <Textarea
                                        id="edit-bonus-description"
                                        value={bonusFormData.description}
                                        onChange={(e) => setBonusFormData({ ...bonusFormData, description: e.target.value })}
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={closeBonusDialog}>
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
                                if (confirm("Tem certeza que deseja excluir este bônus?")) {
                                  deleteBonusMutation.mutate(bonus.id);
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
            </TabsContent>

            <TabsContent value="apps" className="space-y-4">
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
