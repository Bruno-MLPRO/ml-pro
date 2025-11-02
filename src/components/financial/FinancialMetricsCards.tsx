import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Percent,
  Calendar,
  Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FinancialMetricsCardsProps {
  mrr: number;
  arr: number;
  profitMonth: number;
  profitMargin: number;
  activeStudents: number;
  churnRate: number;
  ltvCacRatio: number;
  runwayMonths: number;
}

export function FinancialMetricsCards({
  mrr,
  arr,
  profitMonth,
  profitMargin,
  activeStudents,
  churnRate,
  ltvCacRatio,
  runwayMonths,
}: FinancialMetricsCardsProps) {
  
  const getHealthColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return "text-green-500";
    if (value >= thresholds.warning) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthBadge = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return <Badge variant="default" className="bg-green-500">Excelente</Badge>;
    if (value >= thresholds.warning) return <Badge variant="default" className="bg-yellow-500">Bom</Badge>;
    return <Badge variant="destructive">Atenção</Badge>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* MRR */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MRR</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            ARR: {formatCurrency(arr)}
          </p>
        </CardContent>
      </Card>

      {/* Lucro Mensal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lucro do Mês</CardTitle>
          {profitMonth >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${profitMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(profitMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Margem: {profitMargin.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* Alunos Ativos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Alunos Ativos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeStudents}</div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Churn: {churnRate.toFixed(1)}%
            </p>
            {churnRate <= 5 && <Badge variant="default" className="bg-green-500 text-[10px] px-1 py-0">Saudável</Badge>}
            {churnRate > 5 && churnRate <= 10 && <Badge variant="default" className="bg-yellow-500 text-[10px] px-1 py-0">Atenção</Badge>}
            {churnRate > 10 && <Badge variant="destructive" className="text-[10px] px-1 py-0">Alto</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* LTV/CAC Ratio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">LTV/CAC Ratio</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getHealthColor(ltvCacRatio, { good: 3, warning: 2 })}`}>
            {ltvCacRatio.toFixed(1)}x
          </div>
          <div className="mt-1">
            {getHealthBadge(ltvCacRatio, { good: 3, warning: 2 })}
          </div>
        </CardContent>
      </Card>

      {/* Margem de Lucro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getHealthColor(profitMargin, { good: 60, warning: 40 })}`}>
            {profitMargin.toFixed(1)}%
          </div>
          <div className="mt-1">
            {getHealthBadge(profitMargin, { good: 60, warning: 40 })}
          </div>
        </CardContent>
      </Card>

      {/* Runway */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Runway</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getHealthColor(runwayMonths, { good: 6, warning: 3 })}`}>
            {runwayMonths.toFixed(0)} meses
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tempo de operação
          </p>
        </CardContent>
      </Card>

      {/* Taxa de Churn */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${churnRate <= 5 ? 'text-green-600' : churnRate <= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
            {churnRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Meta: {'<'} 5% mensal
          </p>
        </CardContent>
      </Card>

      {/* Ticket Médio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(activeStudents > 0 ? mrr / activeStudents : 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Por aluno/mês
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

