import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, Phone, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getLeads, updateLeadStatus, registerSale } from "@/services/api/leads";
import type { Lead, LeadStatus, RegisterSaleInput } from "@/types/leads";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { RegisterSaleDialog } from "./RegisterSaleDialog";
import { CreateLeadDialog } from "./CreateLeadDialog";

const COLUMNS: Array<{ id: LeadStatus; title: string; color: string }> = [
  { id: "Novo", title: "Novo", color: "bg-blue-100 border-blue-300" },
  { id: "Em Contato", title: "Em Contato", color: "bg-yellow-100 border-yellow-300" },
  { id: "Qualificado", title: "Qualificado", color: "bg-green-100 border-green-300" },
  { id: "Nutrição", title: "Nutrição", color: "bg-purple-100 border-purple-300" },
  { id: "Convertido", title: "Convertido (GANHO)", color: "bg-emerald-100 border-emerald-300" },
  { id: "Desqualificado", title: "Desqualificado (PERDIDO)", color: "bg-red-100 border-red-300" }
];

export function LeadKanban() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadForSale, setLeadForSale] = useState<Lead | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Query: Buscar leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: getLeads
  });

  // Mutation: Atualizar status do lead
  const updateStatusMutation = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
      updateLeadStatus(leadId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation: Registrar venda
  const registerSaleMutation = useMutation({
    mutationFn: ({ leadId, saleData }: { leadId: string; saleData: RegisterSaleInput }) =>
      registerSale(leadId, saleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["sales-students"] });
      toast({
        title: "Venda registrada!",
        description: "O lead foi convertido e adicionado à Gestão de Alunos."
      });
      setLeadForSale(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar venda",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handler: Drag and drop
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Se não há destino ou é a mesma coluna, não faz nada
    if (!destination || source.droppableId === destination.droppableId) {
      return;
    }

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    const newStatus = destination.droppableId as LeadStatus;

    // Se está movendo para "Convertido", abre modal de venda
    if (newStatus === "Convertido") {
      setLeadForSale(lead);
      return;
    }

    // Caso contrário, atualiza o status diretamente
    updateStatusMutation.mutate({ leadId: lead.id, status: newStatus });
  };

  // Agrupar leads por status
  const leadsByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.id] = leads.filter(lead => lead.status === column.id);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(column => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <Card className={`${column.color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between text-gray-950">
                    {column.title}
                    <Badge variant="secondary" className="text-gray-950 bg-white/80">
                      {leadsByStatus[column.id]?.length || 0}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2 ${
                          snapshot.isDraggingOver ? "bg-white/50 rounded-lg" : ""
                        }`}
                      >
                        {leadsByStatus[column.id]?.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-pointer hover:shadow-lg transition-shadow bg-white ${
                                  snapshot.isDragging ? "rotate-2 shadow-xl" : ""
                                }`}
                                onClick={() => setSelectedLead(lead)}
                              >
                                <CardContent className="p-4">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-gray-950">{lead.nome}</h4>
                                    
                                    {lead.telefone && (
                                      <div className="flex items-center text-xs text-gray-800">
                                        <Phone className="w-3 h-3 mr-1" />
                                        {lead.telefone}
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center text-xs text-gray-800">
                                      <MapPin className="w-3 h-3 mr-1" />
                                      {lead.origem}
                                    </div>
                                    
                                    {lead.closer && (
                                      <div className="flex items-center text-xs text-gray-800">
                                        <User className="w-3 h-3 mr-1" />
                                        {lead.closer.full_name}
                                      </div>
                                    )}

                                    {/* Se está convertido mas ainda não tem sales_student */}
                                    {lead.status === "Convertido" && !lead.convertido_em_aluno && lead.valor_pago && (
                                      <Badge variant="default" className="text-xs">
                                        R$ {lead.valor_pago.toFixed(2)}
                                      </Badge>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Dialog: Detalhes do Lead */}
      {selectedLead && (
        <LeadDetailsDialog
          lead={selectedLead}
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
        />
      )}

      {/* Dialog: Registrar Venda */}
      {leadForSale && (
        <RegisterSaleDialog
          lead={leadForSale}
          open={!!leadForSale}
          onOpenChange={(open) => !open && setLeadForSale(null)}
          onSubmit={(saleData) => {
            registerSaleMutation.mutate({ leadId: leadForSale.id, saleData });
          }}
        />
      )}

      {/* Dialog: Criar Lead */}
      <CreateLeadDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  );
}

