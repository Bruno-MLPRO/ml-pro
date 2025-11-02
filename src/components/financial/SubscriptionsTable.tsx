import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, DollarSign, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { SubscriptionDetailsDialog } from "./SubscriptionDetailsDialog";
import type { StudentSubscription } from "@/types/financial";

interface SubscriptionWithDetails extends StudentSubscription {
  student_name: string;
  student_email: string;
  plan_name: string;
}

export function SubscriptionsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Buscar assinaturas com detalhes
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['student-subscriptions'],
    queryFn: async (): Promise<SubscriptionWithDetails[]> => {
      const { data, error } = await supabase
        .from('student_subscriptions')
        .select(`
          *,
          student:profiles!student_subscriptions_student_id_fkey (
            id,
            full_name,
            email
          ),
          plan:plans (
            id,
            name,
            price
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((sub: any) => ({
        ...sub,
        student_name: sub.student?.full_name || 'N/A',
        student_email: sub.student?.email || 'N/A',
        plan_name: sub.plan?.name || 'N/A',
      }));
    },
    staleTime: 2 * 60 * 1000,
  });

  // Filtrar assinaturas
  const filteredSubscriptions = subscriptions?.filter(sub => {
    const matchesSearch = 
      sub.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Estatísticas rápidas
  const stats = {
    total: subscriptions?.length || 0,
    active: subscriptions?.filter(s => s.status === 'active').length || 0,
    overdue: subscriptions?.filter(s => s.status === 'overdue').length || 0,
    totalMRR: subscriptions
      ?.filter(s => s.status === 'active')
      .reduce((sum, s) => sum + Number(s.monthly_price), 0) || 0,
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: 'Ativo', variant: 'default' },
      paused: { label: 'Pausado', variant: 'secondary' },
      cancelled: { label: 'Cancelado', variant: 'outline' },
      expired: { label: 'Expirado', variant: 'outline' },
      overdue: { label: 'Atrasado', variant: 'destructive' },
    };

    const badge = badges[status] || { label: status, variant: 'secondary' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <h3 className="text-2xl font-bold">{stats.total}</h3>
              </div>
              <DollarSign className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <h3 className="text-2xl font-bold text-green-600">{stats.active}</h3>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
                <h3 className="text-2xl font-bold text-red-600">{stats.overdue}</h3>
              </div>
              <Calendar className="w-8 h-8 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR Total</p>
                <h3 className="text-2xl font-bold">{formatCurrency(stats.totalMRR)}</h3>
              </div>
              <DollarSign className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Assinaturas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assinaturas</CardTitle>
              <CardDescription>
                Gerencie todas as assinaturas dos alunos
              </CardDescription>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por aluno, email ou plano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nenhuma assinatura encontrada com os filtros aplicados.'
                : 'Nenhuma assinatura cadastrada ainda.'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Dia do Pagamento</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{subscription.student_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {subscription.student_email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{subscription.plan_name}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(subscription.monthly_price)}
                      </TableCell>
                      <TableCell>Dia {subscription.payment_day}</TableCell>
                      <TableCell>
                        {format(parseISO(subscription.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSubscription(subscription);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SubscriptionDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        subscription={selectedSubscription}
      />
    </div>
  );
}
