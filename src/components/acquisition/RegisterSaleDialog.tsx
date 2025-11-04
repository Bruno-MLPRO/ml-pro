import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Lead, RegisterSaleInput, ProdutoVendido, FormaPagamento } from "@/types/leads";

interface RegisterSaleDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (saleData: RegisterSaleInput) => void;
}

const PRODUTOS: ProdutoVendido[] = ['ML PRO Starter', 'ML PRO PRO'];
const FORMAS_PAGAMENTO: FormaPagamento[] = ['PIX', 'Cartão', 'Boleto'];

export function RegisterSaleDialog({ lead, open, onOpenChange, onSubmit }: RegisterSaleDialogProps) {
  const [formData, setFormData] = useState<RegisterSaleInput>({
    produto_vendido: 'ML PRO PRO',
    valor_pago: 0,
    forma_pagamento: 'PIX',
    data_inicio: new Date().toISOString().split('T')[0],
    observacoes_closer: ''
  });

  // Resetar formulário quando dialog abre
  useEffect(() => {
    if (open) {
      setFormData({
        produto_vendido: 'ML PRO PRO',
        valor_pago: 0,
        forma_pagamento: 'PIX',
        data_inicio: new Date().toISOString().split('T')[0],
        observacoes_closer: ''
      });
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!formData.valor_pago || formData.valor_pago <= 0) {
      alert("⚠️ Informe o valor pago (deve ser maior que R$ 0,00)");
      return;
    }
    
    if (!formData.data_inicio) {
      alert("⚠️ Selecione a data de início");
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎉 Registrar Venda - {lead.nome}</DialogTitle>
          <DialogDescription>
            Parabéns pela conversão! Preencha os dados da venda. O gestor responsável será atribuído posteriormente no painel de Gestão de Alunos (Onboarding).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="produto">Produto Vendido *</Label>
              <Select
                value={formData.produto_vendido}
                onValueChange={(value) => setFormData({ ...formData, produto_vendido: value as ProdutoVendido })}
              >
                <SelectTrigger id="produto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map(produto => (
                    <SelectItem key={produto} value={produto}>
                      {produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor">Valor Pago (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_pago}
                onChange={(e) => setFormData({ ...formData, valor_pago: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pagamento">Forma de Pagamento *</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value as FormaPagamento })}
              >
                <SelectTrigger id="pagamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(forma => (
                    <SelectItem key={forma} value={forma}>
                      {forma}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações do Closer</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes_closer}
              onChange={(e) => setFormData({ ...formData, observacoes_closer: e.target.value })}
              rows={4}
              placeholder="Adicione observações importantes sobre a venda, expectativas do cliente, etc."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Registrar Venda
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

