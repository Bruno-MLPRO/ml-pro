import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { EditPlanDialog } from "./EditPlanDialog";
import { CreatePlanDialog } from "./CreatePlanDialog";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_months: number;
  is_active: boolean;
  current_students: number;
  max_students: number | null;
  discount_percentage: number;
  target_audience: string;
}

export function PlansManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({
        title: "Plano excluído!",
        description: "O plano foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeletePlan = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o plano "${name}"?`)) {
      deletePlanMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div>Carregando planos...</div>;
  }

  return (
    <div className="space-y-6">
      <CreatePlanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditPlanDialog
        open={!!editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
        plan={editingPlan}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Planos de Mentoria</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os planos oferecidos aos alunos
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans?.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {plan.target_audience}
                  </CardDescription>
                </div>
                {!plan.is_active && (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Preço */}
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(plan.price)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    por {plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'}
                  </p>
                  {plan.discount_percentage > 0 && (
                    <Badge variant="default" className="mt-2 bg-green-500">
                      {plan.discount_percentage}% OFF
                    </Badge>
                  )}
                </div>

                {/* Alunos */}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {plan.current_students} aluno{plan.current_students !== 1 ? 's' : ''}
                    {plan.max_students && ` / ${plan.max_students} máx`}
                  </span>
                </div>

                {/* Descrição */}
                {plan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {plan.description}
                  </p>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setEditingPlan(plan)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDeletePlan(plan.id, plan.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder para quando não houver planos */}
      {plans?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum plano cadastrado ainda
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Plano
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

