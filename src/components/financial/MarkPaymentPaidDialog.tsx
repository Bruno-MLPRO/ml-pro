import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMarkPaymentPaid } from "@/hooks/queries/useSubscriptionPayments";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { PaymentMethod } from "@/types/financial";

interface MarkPaymentPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
];

export function MarkPaymentPaidDialog({ 
  open, 
  onOpenChange, 
  paymentId 
}: MarkPaymentPaidDialogProps) {
  const { toast } = useToast();
  const markPaidMutation = useMarkPaymentPaid();

  const [formData, setFormData] = useState({
    paid_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: '' as PaymentMethod,
    transaction_id: '',
    notes: '',
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        paid_date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: '' as PaymentMethod,
        transaction_id: '',
        notes: '',
      });
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentId) {
      toast({
        title: "Erro",
        description: "ID do pagamento não encontrado.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.payment_method) {
      toast({
        title: "Método de pagamento obrigatório",
        description: "Selecione o método de pagamento utilizado.",
        variant: "destructive",
      });
      return;
    }

    markPaidMutation.mutate(
      {
        payment_id: paymentId,
        paid_date: formData.paid_date,
        payment_method: formData.payment_method,
        transaction_id: formData.transaction_id || undefined,
        notes: formData.notes || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "Pagamento confirmado!",
            description: "O pagamento foi marcado como pago com sucesso.",
          });
          onOpenChange(false);
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao confirmar pagamento",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Registre os detalhes do pagamento recebido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Data do Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="paid_date">Data do Pagamento *</Label>
              <Input
                id="paid_date"
                type="date"
                value={formData.paid_date}
                onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
                max={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>

            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pagamento *</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => 
                  setFormData({ ...formData, payment_method: value as PaymentMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o método..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ID da Transação */}
            <div className="space-y-2">
              <Label htmlFor="transaction_id">ID da Transação</Label>
              <Input
                id="transaction_id"
                placeholder="Ex: TXN123456"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Opcional - código de referência do pagamento
              </p>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais sobre o pagamento..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={markPaidMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
