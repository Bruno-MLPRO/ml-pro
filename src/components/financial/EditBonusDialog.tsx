import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

interface EditBonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bonus: Bonus | null;
}

const categories = [
  { value: 'material', label: 'Material' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'curso', label: 'Curso' },
  { value: 'mentoria', label: 'Mentoria' },
  { value: 'evento', label: 'Evento' },
  { value: 'outro', label: 'Outro' },
];

const types = [
  { value: 'fisico', label: 'Físico' },
  { value: 'digital', label: 'Digital' },
  { value: 'servico', label: 'Serviço' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'desconto', label: 'Desconto' },
];

export function EditBonusDialog({ open, onOpenChange, bonus }: EditBonusDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    value: "",
    cost: "",
    category: "",
    is_recurring: false,
    is_active: true,
  });

  // Preencher formulário quando o bônus mudar
  useEffect(() => {
    if (bonus && open) {
      setFormData({
        name: bonus.name || "",
        description: bonus.description || "",
        type: bonus.type || "",
        value: bonus.value?.toString() || "",
        cost: bonus.cost?.toString() || "",
        category: bonus.category || "",
        is_recurring: bonus.is_recurring,
        is_active: bonus.is_active,
      });
    }
  }, [bonus, open]);

  const updateBonusMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!bonus?.id) throw new Error("Bonus ID not found");

      const cost = parseFloat(data.cost);
      const value = data.value ? parseFloat(data.value) : null;

      const { error } = await supabase
        .from('bonus')
        .update({
          name: data.name,
          description: data.description || null,
          type: data.type,
          value,
          cost,
          category: data.category,
          is_recurring: data.is_recurring,
          is_active: data.is_active,
        })
        .eq('id', bonus.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({
        title: "Bônus atualizado!",
        description: "O bônus foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar bônus",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.cost || !formData.type || !formData.category) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, custo, tipo e categoria.",
        variant: "destructive",
      });
      return;
    }

    updateBonusMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Bônus</DialogTitle>
            <DialogDescription>
              Atualize as informações do bônus
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Bônus *</Label>
              <Input
                id="name"
                placeholder="Ex: Consultoria Individual"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva o bônus..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Grid de selects */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid de valores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor (R$)</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 1000"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Valor percebido pelo aluno
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Custo (R$) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 500"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Custo real do bônus
                </p>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: !!checked })}
                />
                <Label htmlFor="is_recurring" className="cursor-pointer">
                  Bônus recorrente (mensal)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Bônus ativo
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateBonusMutation.isPending}>
              {updateBonusMutation.isPending && (
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

