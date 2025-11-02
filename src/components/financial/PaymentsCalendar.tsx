import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { useSubscriptionPayments } from "@/hooks/queries/useSubscriptionPayments";
import { MarkPaymentPaidDialog } from "./MarkPaymentPaidDialog";
import type { SubscriptionPaymentWithDetails } from "@/types/financial";

export function PaymentsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);

  const monthStr = format(currentMonth, 'yyyy-MM');
  const { data: payments, isLoading } = useSubscriptionPayments({ month: monthStr });

  // Gerar dias do calendário
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Agrupar pagamentos por dia
  const paymentsByDay = new Map<string, SubscriptionPaymentWithDetails[]>();
  payments?.forEach(payment => {
    const dayKey = format(parseISO(payment.due_date), 'yyyy-MM-dd');
    const existing = paymentsByDay.get(dayKey) || [];
    paymentsByDay.set(dayKey, [...existing, payment]);
  });

  // Estatísticas do mês
  const stats = {
    total: payments?.length || 0,
    paid: payments?.filter(p => p.status === 'paid').length || 0,
    pending: payments?.filter(p => p.status === 'pending').length || 0,
    overdue: payments?.filter(p => p.status === 'overdue').length || 0,
    totalAmount: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    paidAmount: payments
      ?.filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleMarkAsPaid = (paymentId: string) => {
    setSelectedPayment(paymentId);
    setMarkPaidDialogOpen(true);
  };

  const getDayStatus = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayPayments = paymentsByDay.get(dayKey) || [];
    
    if (dayPayments.length === 0) return null;
    
    const hasOverdue = dayPayments.some(p => p.status === 'overdue');
    const hasPending = dayPayments.some(p => p.status === 'pending');
    const allPaid = dayPayments.every(p => p.status === 'paid');
    
    if (hasOverdue) return 'overdue';
    if (allPaid) return 'paid';
    if (hasPending) return 'pending';
    return null;
  };

  const getDayStatusColor = (status: string | null) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'overdue':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Pagos</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-muted-foreground">Atrasados</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Recebido</p>
            <p className="text-xl font-bold">{formatCurrency(stats.paidAmount)}</p>
            <p className="text-xs text-muted-foreground">
              de {formatCurrency(stats.totalAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendário */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Calendário de Pagamentos</CardTitle>
              <CardDescription>
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayPayments = paymentsByDay.get(dayKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const status = getDayStatus(day);

                  return (
                    <div
                      key={idx}
                      className={`
                        min-h-[100px] p-2 border rounded-lg
                        ${isCurrentMonth ? 'bg-background' : 'bg-muted/50'}
                        ${isToday ? 'ring-2 ring-primary' : ''}
                        ${dayPayments.length > 0 ? 'cursor-pointer hover:bg-muted/80' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`
                          text-sm font-medium
                          ${!isCurrentMonth ? 'text-muted-foreground' : ''}
                          ${isToday ? 'text-primary font-bold' : ''}
                        `}>
                          {format(day, 'd')}
                        </span>
                        {status && (
                          <div className={`w-2 h-2 rounded-full ${getDayStatusColor(status)}`} />
                        )}
                      </div>

                      {dayPayments.length > 0 && (
                        <div className="space-y-1">
                          {dayPayments.slice(0, 2).map(payment => (
                            <div
                              key={payment.id}
                              className="text-xs p-1 rounded bg-background border truncate"
                              onClick={() => {
                                if (payment.status !== 'paid') {
                                  handleMarkAsPaid(payment.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-1">
                                {payment.status === 'paid' && (
                                  <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                                )}
                                {payment.status === 'overdue' && (
                                  <AlertCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                                )}
                                {payment.status === 'pending' && (
                                  <Clock className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                                )}
                                <span className="truncate">{payment.student_name}</span>
                              </div>
                              <div className="font-medium">
                                {formatCurrency(payment.amount)}
                              </div>
                            </div>
                          ))}
                          {dayPayments.length > 2 && (
                            <div className="text-xs text-center text-muted-foreground">
                              +{dayPayments.length - 2} mais
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex items-center justify-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Pago</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pendente</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">Atrasado</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MarkPaymentPaidDialog
        open={markPaidDialogOpen}
        onOpenChange={setMarkPaidDialogOpen}
        paymentId={selectedPayment}
      />
    </div>
  );
}

