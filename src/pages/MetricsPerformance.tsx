import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useConsolidatedMonthlyMetrics } from "@/hooks/queries/useConsolidatedMonthlyMetrics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from "@/lib/formatters";
import { Loader2, TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MetricsPerformance = () => {
  const { userRole, loading } = useAuth();
  const { data: metrics, isLoading } = useConsolidatedMonthlyMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Apenas administradores podem acessar
  if (userRole !== 'administrator') {
    return <Navigate to="/" replace />;
  }

  // Prepara dados para o gráfico
  const chartData = metrics?.map(metric => ({
    month: format(parseISO(metric.reference_month), 'MMM/yy', { locale: ptBR }),
    monthFull: format(parseISO(metric.reference_month), 'MMMM yyyy', { locale: ptBR }),
    faturamento: metric.total_revenue || 0,
    vendas: metric.total_sales || 0,
    adsSpend: metric.ads_total_spend || 0,
    adsRevenue: metric.ads_total_revenue || 0,
  })) || [];

  // Calcula totais gerais
  const totalRevenue = metrics?.reduce((sum, m) => sum + (m.total_revenue || 0), 0) || 0;
  const totalSales = metrics?.reduce((sum, m) => sum + (m.total_sales || 0), 0) || 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalAdsSpend = metrics?.reduce((sum, m) => sum + (m.ads_total_spend || 0), 0) || 0;
  const totalAdsRevenue = metrics?.reduce((sum, m) => sum + (m.ads_total_revenue || 0), 0) || 0;

  // Último mês registrado
  const lastMonth = metrics?.[metrics.length - 1];
  const lastMonthName = lastMonth 
    ? format(parseISO(lastMonth.reference_month), 'MMMM yyyy', { locale: ptBR })
    : '';

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Métricas e Desempenho</h1>
            <p className="text-foreground-secondary">
              Acompanhe o desempenho consolidado de todos os alunos ao longo do tempo
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !metrics || metrics.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-foreground-secondary">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma métrica consolidada disponível ainda.</p>
                  <p className="text-sm mt-2">As métricas são calculadas no início de cada mês.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">Acumulado histórico</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSales.toLocaleString('pt-BR')}</div>
                    <p className="text-xs text-muted-foreground">Pedidos concluídos</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(avgTicket)}</div>
                    <p className="text-xs text-muted-foreground">Média geral</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Investido em Ads</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalAdsSpend)}</div>
                    <p className="text-xs text-muted-foreground">Receita: {formatCurrency(totalAdsRevenue)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de Faturamento Mensal */}
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento Mensal</CardTitle>
                  <CardDescription>
                    Evolução do faturamento total consolidado de todos os alunos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--foreground-secondary))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--foreground-secondary))"
                        fontSize={12}
                        tickFormatter={(value) => {
                          if (value >= 1000000) {
                            return `R$ ${(value / 1000000).toFixed(1)}M`;
                          } else if (value >= 1000) {
                            return `R$ ${(value / 1000).toFixed(0)}k`;
                          }
                          return `R$ ${value}`;
                        }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === 'faturamento') {
                            return [formatCurrency(value), 'Faturamento'];
                          }
                          if (name === 'vendas') {
                            return [value.toLocaleString('pt-BR'), 'Vendas'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label) => {
                          const data = chartData.find(d => d.month === label);
                          return data?.monthFull || label;
                        }}
                      />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'faturamento') return 'Faturamento';
                          return value;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="faturamento" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Vendas e Product Ads */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Vendas Mensais</CardTitle>
                    <CardDescription>
                      Total de pedidos concluídos por mês
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          stroke="hsl(var(--foreground-secondary))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--foreground-secondary))"
                          fontSize={12}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: any) => [value.toLocaleString('pt-BR'), 'Vendas']}
                          labelFormatter={(label) => {
                            const data = chartData.find(d => d.month === label);
                            return data?.monthFull || label;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="vendas" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Product Ads</CardTitle>
                    <CardDescription>
                      Investimento vs Receita em anúncios
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          stroke="hsl(var(--foreground-secondary))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--foreground-secondary))"
                          fontSize={12}
                          tickFormatter={(value) => {
                            if (value >= 1000) {
                              return `R$ ${(value / 1000).toFixed(0)}k`;
                            }
                            return `R$ ${value}`;
                          }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === 'adsSpend') {
                              return [formatCurrency(value), 'Investimento'];
                            }
                            if (name === 'adsRevenue') {
                              return [formatCurrency(value), 'Receita'];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => {
                            const data = chartData.find(d => d.month === label);
                            return data?.monthFull || label;
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'adsSpend') return 'Investimento';
                            if (value === 'adsRevenue') return 'Receita';
                            return value;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="adsSpend" 
                          stroke="hsl(var(--destructive))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--destructive))', r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="adsRevenue" 
                          stroke="hsl(var(--chart-3))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--chart-3))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MetricsPerformance;

