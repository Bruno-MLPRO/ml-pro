import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getSalesStudents, updateSalesStudent } from "@/services/api/leads";
import type { SalesStudent, UpdateSalesStudentInput } from "@/types/leads";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function SalesStudentsTable() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SalesStudent>>({});

  // Query: Buscar sales students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["sales-students"],
    queryFn: getSalesStudents
  });

  // Mutation: Atualizar sales student
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalesStudentInput }) =>
      updateSalesStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-students"] });
      toast({
        title: "Aluno atualizado!",
        description: "As informações foram salvas."
      });
      setEditingId(null);
      setEditFormData({});
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aluno",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleEdit = (student: SalesStudent) => {
    setEditingId(student.id);
    setEditFormData(student);
  };

  const handleSave = (id: string) => {
    const updateData: UpdateSalesStudentInput = {
      instagram: editFormData.instagram,
      localizacao: editFormData.localizacao,
      tem_cnpj: editFormData.tem_cnpj,
      regime_cnpj: editFormData.regime_cnpj,
      usa_centralize: editFormData.usa_centralize,
      tem_contador: editFormData.tem_contador,
      nome_contador: editFormData.nome_contador,
      ja_vende: editFormData.ja_vende,
      faturamento_mensal: editFormData.faturamento_mensal,
      investimento_estoque: editFormData.investimento_estoque,
      meta_faturamento: editFormData.meta_faturamento,
      atualizacoes: editFormData.atualizacoes,
      onb_call_feita: editFormData.onb_call_feita,
      onb_catalogo_liberado: editFormData.onb_catalogo_liberado,
      onb_memberkit_liberado: editFormData.onb_memberkit_liberado,
      onb_grupos_ok: editFormData.onb_grupos_ok,
      onb_fornecedores_ok: editFormData.onb_fornecedores_ok,
      onb_bonus_ok: editFormData.onb_bonus_ok
    };

    updateMutation.mutate({ id, data: updateData });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleCheckboxChange = (studentId: string, field: keyof SalesStudent, value: boolean) => {
    const updateData: UpdateSalesStudentInput = { [field]: value };
    updateMutation.mutate({ id: studentId, data: updateData });
  };

  const isEditing = (id: string) => editingId === id;

  const renderEditableCell = (student: SalesStudent, field: keyof SalesStudent, type: 'text' | 'number' = 'text') => {
    if (!isEditing(student.id)) {
      return <span>{student[field]?.toString() || '-'}</span>;
    }

    return (
      <Input
        type={type}
        value={editFormData[field]?.toString() || ''}
        onChange={(e) => setEditFormData({ ...editFormData, [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value })}
        className="min-w-[100px]"
      />
    );
  };

  const calcularProgressoOnboarding = (student: SalesStudent) => {
    const checks = [
      student.onb_call_feita,
      student.onb_catalogo_liberado,
      student.onb_memberkit_liberado,
      student.onb_grupos_ok,
      student.onb_fornecedores_ok,
      student.onb_bonus_ok
    ];
    const completos = checks.filter(Boolean).length;
    return (completos / checks.length) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum aluno em onboarding ainda.</p>
        <p className="text-sm mt-2">Converta leads para começar o processo de onboarding.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">Ações</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Atualizações/Anotações</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Instagram</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead>CNPJ / Regime</TableHead>
            <TableHead>Centralize</TableHead>
            <TableHead>Contador</TableHead>
            <TableHead>Já Vende</TableHead>
            <TableHead>Fat. Mensal</TableHead>
            <TableHead>Invest. Estoque</TableHead>
            <TableHead>Meta Fat.</TableHead>
            <TableHead>Gestor</TableHead>
            <TableHead>Valor Pago</TableHead>
            <TableHead>Forma Pgto</TableHead>
            <TableHead>Data Início</TableHead>
            <TableHead>Obs. Closer</TableHead>
            <TableHead>Call Feita</TableHead>
            <TableHead>Catálogo</TableHead>
            <TableHead>Memberkit</TableHead>
            <TableHead>Grupos</TableHead>
            <TableHead>Fornecedores</TableHead>
            <TableHead>Bônus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map(student => {
            const progresso = calcularProgressoOnboarding(student);
            const editing = isEditing(student.id);

            return (
              <TableRow key={student.id}>
                <TableCell className="sticky left-0 bg-background z-10">
                  {!editing ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(student)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSave(student.id)}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-1 min-w-[100px]">
                    <Badge variant={progresso === 100 ? "default" : "secondary"}>
                      {progresso.toFixed(0)}%
                    </Badge>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {editing ? (
                    <Input
                      value={editFormData.atualizacoes || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, atualizacoes: e.target.value })}
                      className="min-w-[200px]"
                    />
                  ) : (
                    <span className="text-xs">{student.atualizacoes || '-'}</span>
                  )}
                </TableCell>

                <TableCell className="font-medium">{student.nome}</TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell>{student.telefone || '-'}</TableCell>
                <TableCell>{renderEditableCell(student, 'instagram')}</TableCell>
                <TableCell>{renderEditableCell(student, 'localizacao')}</TableCell>
                
                <TableCell>
                  {editing ? (
                    <div className="space-y-1">
                      <Checkbox
                        checked={editFormData.tem_cnpj}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, tem_cnpj: !!checked })}
                      />
                      <Input
                        value={editFormData.regime_cnpj || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, regime_cnpj: e.target.value })}
                        placeholder="MEI, Simples..."
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <span>{student.tem_cnpj ? `Sim (${student.regime_cnpj || 'N/A'})` : 'Não'}</span>
                  )}
                </TableCell>

                <TableCell>
                  {editing ? (
                    <Checkbox
                      checked={editFormData.usa_centralize}
                      onCheckedChange={(checked) => setEditFormData({ ...editFormData, usa_centralize: !!checked })}
                    />
                  ) : (
                    <span>{student.usa_centralize ? 'Sim' : 'Não'}</span>
                  )}
                </TableCell>

                <TableCell>
                  {editing ? (
                    <div className="space-y-1">
                      <Checkbox
                        checked={editFormData.tem_contador}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, tem_contador: !!checked })}
                      />
                      <Input
                        value={editFormData.nome_contador || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, nome_contador: e.target.value })}
                        placeholder="Nome..."
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <span>{student.tem_contador ? student.nome_contador || 'Sim' : 'Não'}</span>
                  )}
                </TableCell>

                <TableCell>
                  {editing ? (
                    <Checkbox
                      checked={editFormData.ja_vende}
                      onCheckedChange={(checked) => setEditFormData({ ...editFormData, ja_vende: !!checked })}
                    />
                  ) : (
                    <span>{student.ja_vende ? 'Sim' : 'Não'}</span>
                  )}
                </TableCell>

                <TableCell>{renderEditableCell(student, 'faturamento_mensal', 'number')}</TableCell>
                <TableCell>{renderEditableCell(student, 'investimento_estoque', 'number')}</TableCell>
                <TableCell>{renderEditableCell(student, 'meta_faturamento', 'number')}</TableCell>

                <TableCell>{student.gestor?.full_name || '-'}</TableCell>
                <TableCell>R$ {student.valor_pago.toFixed(2)}</TableCell>
                <TableCell>{student.forma_pagamento}</TableCell>
                <TableCell>{format(new Date(student.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell className="max-w-[200px] text-xs">{student.observacoes_closer || '-'}</TableCell>

                {/* Checkboxes de Onboarding */}
                <TableCell>
                  <Checkbox
                    checked={student.onb_call_feita}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_call_feita', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={student.onb_catalogo_liberado}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_catalogo_liberado', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={student.onb_memberkit_liberado}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_memberkit_liberado', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={student.onb_grupos_ok}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_grupos_ok', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={student.onb_fornecedores_ok}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_fornecedores_ok', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={student.onb_bonus_ok}
                    onCheckedChange={(checked) => handleCheckboxChange(student.id, 'onb_bonus_ok', !!checked)}
                    disabled={updateMutation.isPending}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

