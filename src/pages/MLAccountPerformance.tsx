import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/Sidebar";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export default function MLAccountPerformance() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30>(30);

  useEffect(() => {
    loadAccountData();
    
    const metricsChannel = supabase
      .channel('ml-metrics-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mercado_livre_metrics',
        filter: `ml_account_id=eq.${accountId}`
      }, () => {
        loadAccountData();
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('ml-orders-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mercado_livre_orders',
        filter: `ml_account_id=eq.${accountId}`
      }, () => {
        loadAccountData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(metricsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [accountId, selectedPeriod]);

  const loadAccountData = async () => {
    if (!accountId) return;

    setLoading(true);
    try {
      const { data: accountData, error: accountError } = await supabase
        .from('mercado_livre_accounts_safe')
        .select('*')
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedPeriod);

      const { data: ordersData, error: ordersError } = await supabase
        .from('mercado_livre_orders')
        .select('*')
        .eq('ml_account_id', accountId)
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (ordersError) throw ordersError;

      const totalSales = ordersData?.length || 0;
      const totalRevenue = ordersData?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      setAccount({
        ...accountData,
        metrics: {
          total_sales: totalSales,
          total_revenue: totalRevenue,
          average_ticket: averageTicket
        }
      });
    } catch (error: any) {
      console.error('Error loading account data:', error);
      toast.error('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Conta não encontrada</p>
            <Button onClick={() => navigate('/aluno/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/aluno/dashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Desempenho - @{account.ml_nickname}</h1>
                {account.is_primary && (
                  <Badge variant="default" className="mt-1">
                    Conta Principal
                  </Badge>
                )}
              </div>
            </div>

            <Select 
              value={selectedPeriod.toString()} 
              onValueChange={(value) => setSelectedPeriod(parseInt(value) as 7 | 15 | 30)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Total de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{account.metrics.total_sales}</div>
                <p className="text-sm text-muted-foreground">
                  nos últimos {selectedPeriod} dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {account.metrics.total_revenue.toLocaleString('pt-BR', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  nos últimos {selectedPeriod} dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {account.metrics.average_ticket.toLocaleString('pt-BR', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  valor médio por venda
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}