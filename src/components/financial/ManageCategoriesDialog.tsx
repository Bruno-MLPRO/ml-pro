import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { useCashFlowCategories } from "@/hooks/queries/useCashFlow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { CashFlowType } from "@/types/financial";
import { Badge } from "@/components/ui/badge";

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCategoriesDialog({ open, onOpenChange }: ManageCategoriesDialogProps) {
  const { data: categories, isLoading } = useCashFlowCategories();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CashFlowType>("expense");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('cash_flow_categories')
        .insert({
          name,
          type,
          description: description || null,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso",
      });

      // Reset form
      setName("");
      setDescription("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['cash-flow-categories'] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar categoria",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!name) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('cash_flow_categories')
        .update({
          name,
          description: description || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria atualizada com sucesso",
      });

      setEditingId(null);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ['cash-flow-categories'] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar categoria",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!confirm(`Tem certeza que deseja desativar a categoria "${categoryName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_flow_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria desativada com sucesso",
      });

      queryClient.invalidateQueries({ queryKey: ['cash-flow-categories'] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao desativar categoria",
        variant: "destructive",
      });
    }
  };

  const startEdit = (category: any) => {
    setEditingId(category.id);
    setName(category.name);
    setType(category.type);
    setDescription(category.description || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setName("");
    setDescription("");
    setType("expense");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
          <DialogDescription>
            Adicione, edite ou desative categorias de fluxo de caixa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Botão Adicionar */}
          {!isAdding && !editingId && (
            <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          )}

          {/* Formulário de Adicionar/Editar */}
          {(isAdding || editingId) && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome da categoria"
                />
              </div>

              {isAdding && (
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={type} onValueChange={(value) => setType(value as CashFlowType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
                  disabled={saving || !name}
                  className="flex-1"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>
                <Button onClick={cancelEdit} variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Categorias */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Receitas</h4>
              {categories?.filter(c => c.type === 'income').map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium">{category.name}</h5>
                      <Badge variant="default" className="bg-green-500 text-xs">
                        Receita
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(category.id, category.name)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              <h4 className="text-sm font-semibold text-muted-foreground mt-6">Despesas</h4>
              {categories?.filter(c => c.type === 'expense').map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium">{category.name}</h5>
                      <Badge variant="destructive" className="text-xs">
                        Despesa
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(category.id, category.name)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

