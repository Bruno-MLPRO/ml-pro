import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import InputMask from "react-input-mask";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createLead, getClosers } from "@/services/api/leads";
import type { CreateLeadInput, LeadOrigem } from "@/types/leads";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ORIGENS: LeadOrigem[] = ['Copping', 'Centralize', 'Indicação', 'Instagram', 'Youtube', 'Outro'];

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateLeadInput>({
    nome: "",
    email: "",
    telefone: "",
    origem: "Instagram",
    origem_outro: "",
    closer_responsavel_id: ""
  });

  // Query: Buscar closers
  const { data: closers = [] } = useQuery({
    queryKey: ["closers"],
    queryFn: getClosers
  });

  // Mutation: Criar lead
  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Lead criado!",
        description: "O lead foi adicionado ao pipeline."
      });
      onOpenChange(false);
      setFormData({
        nome: "",
        email: "",
        telefone: "",
        origem: "Instagram",
        origem_outro: "",
        closer_responsavel_id: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <InputMask
                mask="(99) 99999-9999"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              >
                {(inputProps: any) => (
                  <Input
                    {...inputProps}
                    id="telefone"
                    placeholder="(11) 99999-9999"
                  />
                )}
              </InputMask>
            </div>

            <div>
              <Label htmlFor="origem">Origem *</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => setFormData({ ...formData, origem: value as LeadOrigem })}
              >
                <SelectTrigger id="origem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(origem => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.origem === 'Outro' && (
            <div>
              <Label htmlFor="origem_outro">Especifique a origem</Label>
              <Input
                id="origem_outro"
                value={formData.origem_outro}
                onChange={(e) => setFormData({ ...formData, origem_outro: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label htmlFor="closer">Closer Responsável</Label>
            <Select
              value={formData.closer_responsavel_id}
              onValueChange={(value) => setFormData({ ...formData, closer_responsavel_id: value })}
            >
              <SelectTrigger id="closer">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="logs">Observações Iniciais</Label>
            <Textarea
              id="logs"
              value={formData.logs_de_interacao || ""}
              onChange={(e) => setFormData({ ...formData, logs_de_interacao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

