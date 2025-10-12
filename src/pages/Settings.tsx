import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ id: string; name: string; price: number } | null>(null);
  const [formData, setFormData] = useState({ name: "", price: "" });

  // Fetch plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: userRole === "manager",
  });

  // Create plan
  const createMutation = useMutation({
    mutationFn: async (planData: { name: string; price: number }) => {
      const { error } = await supabase.from("plans").insert([planData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano criado com sucesso!" });
      setIsCreateOpen(false);
      setFormData({ name: "", price: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar plano", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update plan
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; price: number } }) => {
      const { error } = await supabase
        .from("plans")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano atualizado com sucesso!" });
      setEditingPlan(null);
      setFormData({ name: "", price: "" });
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
  const deleteMutation = useMutation({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(formData.price);
    
    if (!formData.name || isNaN(price) || price <= 0) {
      toast({ 
        title: "Erro de validação", 
        description: "Preencha todos os campos corretamente",
        variant: "destructive" 
      });
      return;
    }

    if (editingPlan) {
      updateMutation.mutate({ 
        id: editingPlan.id, 
        data: { name: formData.name, price } 
      });
    } else {
      createMutation.mutate({ name: formData.name, price });
    }
  };

  const openEditDialog = (plan: any) => {
    setEditingPlan(plan);
    setFormData({ name: plan.name, price: plan.price.toString() });
  };

  const closeDialog = () => {
    setEditingPlan(null);
    setIsCreateOpen(false);
    setFormData({ name: "", price: "" });
  };

  if (userRole !== "manager") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
              <p className="text-foreground-secondary mt-1">Gerencie os planos disponíveis</p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Plano
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
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
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 4000"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
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
              {isLoading ? (
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
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={editingPlan?.id === plan.id} onOpenChange={(open) => !open && closeDialog()}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(plan)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <form onSubmit={handleSubmit}>
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
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-price">Preço (R$)</Label>
                                  <Input
                                    id="edit-price"
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeDialog}>
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
                              deleteMutation.mutate(plan.id);
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
      </main>
    </div>
  );
}
