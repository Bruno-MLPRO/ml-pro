import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from "@/lib/formatters";
import type { CashFlowChartData } from "@/types/financial";

interface CashFlowChartProps {
  data: CashFlowChartData[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa Mensal</CardTitle>
          <CardDescription>Entradas, saídas e lucro ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Caixa Mensal</CardTitle>
        <CardDescription>
          Acompanhe a saúde financeira do negócio mês a mês
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data}>
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
                padding: '12px',
              }}
              formatter={(value: any, name: string) => {
                const labels: Record<string, string> = {
                  income: 'Entradas',
                  expense: 'Saídas',
                  profit: 'Lucro',
                };
                return [formatCurrency(value), labels[name] || name];
              }}
            />
            <Legend 
              formatter={(value) => {
                const labels: Record<string, string> = {
                  income: 'Entradas',
                  expense: 'Saídas',
                  profit: 'Lucro',
                };
                return labels[value] || value;
              }}
              wrapperStyle={{
                paddingTop: '20px',
              }}
            />
            
            {/* Barras de Entradas e Saídas */}
            <Bar 
              dataKey="income" 
              fill="hsl(var(--chart-1))" 
              name="income"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="expense" 
              fill="hsl(var(--destructive))" 
              name="expense"
              radius={[4, 4, 0, 0]}
            />
            
            {/* Linha de Lucro */}
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
              name="profit"
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Resumo Rápido */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Total de Entradas</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(data.reduce((sum, d) => sum + d.income, 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Saídas</p>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(data.reduce((sum, d) => sum + d.expense, 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lucro Total</p>
            <p className="text-lg font-semibold text-primary">
              {formatCurrency(data.reduce((sum, d) => sum + d.profit, 0))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

