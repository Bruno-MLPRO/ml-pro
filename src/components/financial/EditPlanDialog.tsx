import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

interface EditPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
}

export function EditPlanDialog({ open, onOpenChange, plan }: EditPlanDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_months: "",
    max_students: "",
    discount_percentage: "",
    target_audience: "",
    is_active: true,
    selectedBonusIds: [] as string[],
  });

  // Buscar bônus disponíveis
  const { data: bonusList = [] } = useQuery({
    queryKey: ['bonus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Buscar bônus do plano atual
  const { data: planBonuses = [] } = useQuery({
    queryKey: ['plan-bonus', plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data, error } = await supabase
        .from('plan_bonus')
        .select('bonus_id')
        .eq('plan_id', plan.id);

      if (error) throw error;
      return data.map(pb => pb.bonus_id);
    },
    enabled: !!plan?.id && open,
  });

  // Preencher formulário quando o plano mudar
  useEffect(() => {
    if (plan && open) {
      setFormData({
        name: plan.name || "",
        description: plan.description || "",
        price: plan.price?.toString() || "",
        duration_months: plan.duration_months?.toString() || "",
        max_students: plan.max_students?.toString() || "",
        discount_percentage: plan.discount_percentage?.toString() || "0",
        target_audience: plan.target_audience || "",
        is_active: plan.is_active,
        selectedBonusIds: planBonuses,
      });
    }
  }, [plan, open, planBonuses]);

  const updatePlanMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!plan?.id) throw new Error("Plan ID not found");

      const price = parseFloat(data.price);
      const durationMonths = parseInt(data.duration_months);
      const maxStudents = data.max_students ? parseInt(data.max_students) : null;
      const discountPercentage = parseFloat(data.discount_percentage);

      // Atualizar plano
      const { error: planError } = await supabase
        .from('plans')
        .update({
          name: data.name,
          description: data.description || null,
          price,
          duration_months: durationMonths,
          max_students: maxStudents,
          discount_percentage: discountPercentage,
          target_audience: data.target_audience,
          is_active: data.is_active,
        })
        .eq('id', plan.id);

      if (planError) throw planError;

      // Remover bônus antigos
      const { error: deleteError } = await supabase
        .from('plan_bonus')
        .delete()
        .eq('plan_id', plan.id);

      if (deleteError) throw deleteError;

      // Adicionar novos bônus
      if (data.selectedBonusIds.length > 0) {
        const planBonusData = data.selectedBonusIds.map(bonusId => ({
          plan_id: plan.id,
          bonus_id: bonusId,
        }));

        const { error: insertError } = await supabase
          .from('plan_bonus')
          .insert(planBonusData);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-bonus'] });
      toast({
        title: "Plano atualizado!",
        description: "O plano foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.duration_months) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, preço e duração.",
        variant: "destructive",
      });
      return;
    }

    updatePlanMutation.mutate(formData);
  };

  const toggleBonus = (bonusId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBonusIds: prev.selectedBonusIds.includes(bonusId)
        ? prev.selectedBonusIds.filter(id => id !== bonusId)
        : [...prev.selectedBonusIds, bonusId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>
              Atualize as informações do plano de mentoria
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Plano *</Label>
              <Input
                id="name"
                placeholder="Ex: ML PRO - Turma 3 Starter"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva o plano..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Público-alvo */}
            <div className="space-y-2">
              <Label htmlFor="target_audience">Público-alvo</Label>
              <Input
                id="target_audience"
                placeholder="Ex: Iniciantes"
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              />
            </div>

            {/* Grid de campos numéricos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 4000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (meses) *</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="Ex: 6"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_students">Máx. Alunos</Label>
                <Input
                  id="max_students"
                  type="number"
                  placeholder="Ex: 50"
                  value={formData.max_students}
                  onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Desconto (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 10"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Plano ativo
              </Label>
            </div>

            {/* Bônus */}
            <div className="space-y-2">
              <Label>Bônus inclusos</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                {bonusList.map((bonus) => (
                  <div key={bonus.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bonus-${bonus.id}`}
                      checked={formData.selectedBonusIds.includes(bonus.id)}
                      onCheckedChange={() => toggleBonus(bonus.id)}
                    />
                    <label
                      htmlFor={`bonus-${bonus.id}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {bonus.name} - R$ {Number(bonus.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </label>
                  </div>
                ))}
                {bonusList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum bônus disponível
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updatePlanMutation.isPending}>
              {updatePlanMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

