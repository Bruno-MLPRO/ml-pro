import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Package, DollarSign } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { EditBonusDialog } from "./EditBonusDialog";
import { CreateBonusDialog } from "./CreateBonusDialog";
import { useToast } from "@/hooks/use-toast";

interface Bonus {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  cost: number;
  category: string;
  is_recurring: boolean;
  is_active: boolean;
}

export function BonusManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: bonuses, isLoading } = useQuery({
    queryKey: ['bonus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Bonus[];
    },
  });

  const deleteBonusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bonus')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({
        title: "Bônus excluído!",
        description: "O bônus foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir bônus",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteBonus = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o bônus "${name}"?`)) {
      deleteBonusMutation.mutate(id);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      material: 'bg-blue-500',
      ferramenta: 'bg-purple-500',
      curso: 'bg-green-500',
      mentoria: 'bg-yellow-500',
      evento: 'bg-pink-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  if (isLoading) {
    return <div>Carregando bônus...</div>;
  }

  return (
    <div className="space-y-6">
      <CreateBonusDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditBonusDialog
        open={!!editingBonus}
        onOpenChange={(open) => !open && setEditingBonus(null)}
        bonus={editingBonus}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bônus e Benefícios</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os bônus oferecidos aos alunos nos planos
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Bônus
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bonuses?.map((bonus) => (
          <Card key={bonus.id} className={!bonus.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{bonus.name}</CardTitle>
                  </div>
                  {bonus.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {bonus.description}
                    </CardDescription>
                  )}
                </div>
                {!bonus.is_active && (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Categoria e Tipo */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getCategoryColor(bonus.category)}>
                    {bonus.category}
                  </Badge>
                  <Badge variant="outline">
                    {bonus.type}
                  </Badge>
                  {bonus.is_recurring && (
                    <Badge variant="default" className="bg-orange-500">
                      Recorrente
                    </Badge>
                  )}
                </div>

                {/* Valor e Custo */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor</p>
                    <p className="font-semibold text-green-600">
                      {bonus.value ? formatCurrency(bonus.value) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Custo</p>
                    <p className="font-semibold text-red-600 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(bonus.cost)}
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setEditingBonus(bonus)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDeleteBonus(bonus.id, bonus.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder */}
      {bonuses?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum bônus cadastrado ainda
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Bônus
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Custos */}
      {bonuses && bonuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Bônus</p>
                <p className="text-2xl font-bold">{bonuses.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600">
                  {bonuses.filter(b => b.is_active).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(bonuses.reduce((sum, b) => sum + b.cost, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Médio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(bonuses.length > 0 ? bonuses.reduce((sum, b) => sum + b.cost, 0) / bonuses.length : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

