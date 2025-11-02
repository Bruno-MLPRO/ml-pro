import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, DollarSign, User, CreditCard, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { usePaymentsBySubscription } from "@/hooks/queries/useSubscriptionPayments";
import type { StudentSubscription, PaymentStatus } from "@/types/financial";
import { useState } from "react";
import { MarkPaymentPaidDialog } from "./MarkPaymentPaidDialog";

interface SubscriptionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: (StudentSubscription & {
    student_name?: string;
    student_email?: string;
    plan_name?: string;
  }) | null;
}

export function SubscriptionDetailsDialog({ 
  open, 
  onOpenChange, 
  subscription 
}: SubscriptionDetailsDialogProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);

  const { data: payments, isLoading } = usePaymentsBySubscription(subscription?.id || '');

  if (!subscription) return null;

  // Estatísticas dos pagamentos
  const stats = {
    total: payments?.length || 0,
    paid: payments?.filter(p => p.status === 'paid').length || 0,
    pending: payments?.filter(p => p.status === 'pending').length || 0,
    overdue: payments?.filter(p => p.status === 'overdue').length || 0,
    totalPaid: payments
      ?.filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    totalPending: payments
      ?.filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'overdue':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const badges: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: 'Pago', variant: 'default' },
      pending: { label: 'Pendente', variant: 'secondary' },
      overdue: { label: 'Atrasado', variant: 'destructive' },
      cancelled: { label: 'Cancelado', variant: 'outline' },
    };

    const badge = badges[status] || { label: status, variant: 'secondary' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const handleMarkAsPaid = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setMarkPaidDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Assinatura</DialogTitle>
            <DialogDescription>
              Informações completas e histórico de pagamentos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{subscription.student_name || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">{subscription.student_email || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Plano
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{subscription.plan_name || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(subscription.monthly_price)}/mês
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Início:</span>{' '}
                      {format(parseISO(subscription.start_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    {subscription.end_date && (
                      <p className="text-sm">
                        <span className="font-medium">Fim:</span>{' '}
                        {format(parseISO(subscription.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="font-medium">Dia do Pagamento:</span> Dia {subscription.payment_day}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Total Pago:</span>{' '}
                      {formatCurrency(stats.totalPaid)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Pendente:</span>{' '}
                      {formatCurrency(stats.totalPending)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Método:</span>{' '}
                      {subscription.payment_method?.replace('_', ' ').toUpperCase() || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Estatísticas de Pagamentos */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                  <p className="text-sm text-muted-foreground">Pagos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                  <p className="text-sm text-muted-foreground">Atrasados</p>
                </CardContent>
              </Card>
            </div>

            {/* Histórico de Pagamentos */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Histórico de Pagamentos</h3>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : payments && payments.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(payment.status)}
                              {getStatusBadge(payment.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {payment.paid_date 
                              ? format(parseISO(payment.paid_date), "dd/MM/yyyy", { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            {payment.payment_method?.replace('_', ' ').toUpperCase() || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.status === 'pending' || payment.status === 'overdue' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsPaid(payment.id)}
                              >
                                Marcar como Pago
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento registrado ainda
                </p>
              )}
            </div>

            {subscription.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2">Observações</h3>
                  <p className="text-sm text-muted-foreground">{subscription.notes}</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MarkPaymentPaidDialog
        open={markPaidDialogOpen}
        onOpenChange={setMarkPaidDialogOpen}
        paymentId={selectedPaymentId}
      />
    </>
  );
}

