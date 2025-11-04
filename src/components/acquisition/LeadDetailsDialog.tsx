import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import InputMask from "react-input-mask";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { updateLead, getClosers, createStudentFromLead, deleteLead } from "@/services/api/leads";
import type { Lead, LeadOrigem, UpdateLeadInput } from "@/types/leads";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadDetailsDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ORIGENS: LeadOrigem[] = ['Copping', 'Centralize', 'Indicação', 'Instagram', 'Youtube', 'Outro'];

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(true);  // ✅ Começa em modo de edição
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Inicializar formData com os dados do lead
  const [formData, setFormData] = useState<UpdateLeadInput>({
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone || "",
    origem: lead.origem,
    origem_outro: lead.origem_outro || "",
    closer_responsavel_id: lead.closer_responsavel_id || "",
    lead_score: lead.lead_score,
    logs_de_interacao: lead.logs_de_interacao || ""
  });

  // Query: Buscar closers
  const { data: closers = [] } = useQuery({
    queryKey: ["closers"],
    queryFn: getClosers
  });

  // Atualizar form data quando lead mudar
  useEffect(() => {
    if (lead) {
      setFormData({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone || "",
        origem: lead.origem,
        origem_outro: lead.origem_outro || "",
        closer_responsavel_id: lead.closer_responsavel_id || "",
        lead_score: lead.lead_score,
        logs_de_interacao: lead.logs_de_interacao || ""
      });
    }
  }, [lead]);

  // Sempre iniciar em modo de edição quando abrir
  useEffect(() => {
    if (open) {
      setIsEditing(true);
      setIsDeleting(false);
    }
  }, [open]);

  // Mutation: Atualizar lead
  const updateMutation = useMutation({
    mutationFn: (data: UpdateLeadInput) => updateLead(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Lead atualizado!",
        description: "As informações foram salvas."
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation: Criar aluno a partir do lead
  const createStudentMutation = useMutation({
    mutationFn: () => createStudentFromLead(lead.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["sales-students"] });
      toast({
        title: data.userCreated ? "Aluno criado com sucesso!" : "Aluno criado (usuário pendente)",
        description: data.userCreated 
          ? "O aluno foi adicionado à Gestão de Alunos e o usuário foi criado no sistema."
          : "O aluno foi adicionado à Gestão de Alunos, mas houve um erro ao criar o usuário."
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar aluno",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation: Deletar lead
  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(lead.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Lead excluído!",
        description: "O lead foi removido do sistema."
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir lead",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleCreateStudent = () => {
    if (!confirm("Tem certeza que deseja criar o usuário aluno? Esta ação não pode ser desfeita.")) {
      return;
    }
    createStudentMutation.mutate();
  };

  const handleDelete = () => {
    if (!confirm(`⚠️ ATENÇÃO!\n\nTem certeza que deseja EXCLUIR o lead "${lead.nome}"?\n\nEsta ação é IRREVERSÍVEL e o lead será removido permanentemente do banco de dados.`)) {
      return;
    }
    setIsDeleting(true);
    deleteMutation.mutate();
  };

  const showCreateStudentButton = lead.status === "Convertido" && 
    !lead.convertido_em_aluno && 
    lead.valor_pago;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <Badge variant={lead.status === "Convertido" ? "default" : "secondary"}>
              {lead.status}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Visualize e edite as informações completas do lead
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <h3 className="font-semibold">Dados Básicos</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome || ""}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                {isEditing ? (
                  <InputMask
                    mask="(99) 99999-9999"
                    value={formData.telefone || ""}
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
                ) : (
                  <Input
                    id="telefone"
                    value={formData.telefone || ""}
                    disabled
                    placeholder="(11) 99999-9999"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="origem">Origem</Label>
                <Select
                  value={formData.origem || undefined}
                  onValueChange={(value) => setFormData({ ...formData, origem: value as LeadOrigem })}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="origem">
                    <SelectValue placeholder="Selecione a origem" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="closer">Closer Responsável</Label>
                <Select
                  value={formData.closer_responsavel_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, closer_responsavel_id: value })}
                  disabled={!isEditing}
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
                <Label htmlFor="score">Lead Score</Label>
                <Input
                  id="score"
                  type="number"
                  value={formData.lead_score || 0}
                  onChange={(e) => setFormData({ ...formData, lead_score: parseInt(e.target.value) || 0 })}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Logs de Interação */}
          <div className="space-y-2">
            <Label htmlFor="logs">Logs de Interação</Label>
            <Textarea
              id="logs"
              value={formData.logs_de_interacao || ""}
              onChange={(e) => setFormData({ ...formData, logs_de_interacao: e.target.value })}
              rows={5}
              disabled={!isEditing}
              placeholder="Adicione anotações sobre as interações com o lead..."
            />
          </div>

          {/* Dados da Venda (se convertido) */}
          {lead.status === "Convertido" && lead.valor_pago && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold">Dados da Venda</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Produto Vendido</Label>
                    <p className="text-sm mt-1">{lead.produto_vendido}</p>
                  </div>

                  <div>
                    <Label>Valor Pago</Label>
                    <p className="text-sm mt-1">R$ {lead.valor_pago.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <p className="text-sm mt-1">{lead.forma_pagamento}</p>
                  </div>

                  <div>
                    <Label>Data de Início</Label>
                    <p className="text-sm mt-1">
                      {lead.data_inicio && format(new Date(lead.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {lead.gestor && (
                  <div>
                    <Label>Gestor Responsável</Label>
                    <p className="text-sm mt-1">{lead.gestor.full_name}</p>
                  </div>
                )}

                {lead.observacoes_closer && (
                  <div>
                    <Label>Observações do Closer</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{lead.observacoes_closer}</p>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Metadados */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Criado em: {format(new Date(lead.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            <p>Última interação: {format(new Date(lead.data_ultima_interacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          </div>

          {/* Ações */}
          <div className="flex justify-between gap-2">
            <div>
              {showCreateStudentButton && (
                <Button
                  type="button"
                  onClick={handleCreateStudent}
                  disabled={createStudentMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createStudentMutation.isPending ? "Criando..." : "Criar Usuário Aluno"}
                </Button>
              )}
            </div>

            <div className="flex justify-between gap-2">
              {/* Botão de Excluir à esquerda */}
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "🗑️ Excluir Lead"}
              </Button>

              {/* Botões de ação à direita */}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "💾 Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

