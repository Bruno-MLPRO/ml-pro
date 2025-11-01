import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MLProduct {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string;
  permalink: string;
  health?: {
    health_score: number;
    health_level: string;
    goals_completed: number;
    goals_applicable: number;
    score_trend: string;
  };
}

interface HealthHistoryData {
  date: string;
  averageScore: number;
}

interface HealthDashboardProps {
  products: MLProduct[];
  historyData: HealthHistoryData[];
  onSelectItem: (itemId: string) => void;
  onSync: () => void;
  loading: boolean;
  selectedAccount?: {
    token_expires_at: string;
  };
}

export function HealthDashboard({ products, historyData, onSelectItem, onSync, loading, selectedAccount }: HealthDashboardProps) {
  const productsWithHealth = products.filter(p => p.health);
  const totalItems = productsWithHealth.length;
  
  const averageScore = totalItems > 0
    ? productsWithHealth.reduce((sum, p) => sum + (p.health?.health_score || 0), 0) / totalItems
    : 0;

  const itemsAbove70 = productsWithHealth.filter(p => (p.health?.health_score || 0) >= 0.7).length;
  const criticalItems = productsWithHealth.filter(p => (p.health?.health_score || 0) < 0.5);
  const lowPerformanceItems = productsWithHealth.filter(p => (p.health?.health_score || 0) < 0.7);

  const getAverageLevel = (): string => {
    if (averageScore >= 0.7) return 'Professional';
    if (averageScore >= 0.5) return 'Standard';
    return 'Basic';
  };

  const getHealthColor = (score: number): string => {
    if (score < 0.5) return 'text-red-600';
    if (score < 0.7) return 'text-orange-600';
    return 'text-green-600';
  };

  // Check if there's no health data at all
  const hasHealthData = products.some(p => p.health?.health_score !== undefined && p.health?.health_score !== null);
  
  // Verificar se token está expirado
  const isTokenExpired = selectedAccount && 
    new Date(selectedAccount.token_expires_at) <= new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Carregando dados de performance...
          </p>
        </div>
      </div>
    );
  }

  if (isTokenExpired) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Token do Mercado Livre Expirado</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            Sua conexão com o Mercado Livre expirou. Reconecte sua conta para 
            continuar sincronizando dados de performance.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            className="w-fit"
            onClick={onSync}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Renovar Token
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!hasHealthData) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Dados de Performance Não Disponíveis
              </h3>
              <p className="text-muted-foreground mb-6">
                A API do Mercado Livre não retornou dados de performance para seus anúncios.
              </p>
            </div>
            <Button 
              onClick={onSync}
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Score
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de sync */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard de Performance</h2>
        <Button onClick={onSync} disabled={loading} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Sincronizando...' : 'Sincronizar Performance'}
        </Button>
      </div>

      {/* Cards principais */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Card: Score Médio Geral */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Score Médio de Qualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-5xl font-bold">{(averageScore * 100).toFixed(0)}%</div>
              <Progress value={averageScore * 100} className="h-3" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Nível</div>
                  <div className="font-semibold">{getAverageLevel()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Anúncios</div>
                  <div className="font-semibold">{totalItems}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">OK</div>
                  <div className="font-semibold">{itemsAbove70}/{totalItems}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Alertas Críticos */}
        <Card className={criticalItems.length > 0 ? "border-destructive border-2" : "border-green-500 border-2"}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${criticalItems.length > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {criticalItems.length > 0 ? (
                <><AlertTriangle className="w-5 h-5" /> Atenção Necessária</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Tudo OK!</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticalItems.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-600">Todos os anúncios estão saudáveis!</p>
                <p className="text-sm text-muted-foreground mt-1">Nenhum item com score crítico</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {criticalItems.length} anúncios com score abaixo de 50% precisam de atenção urgente
                </p>
                <div className="flex flex-col gap-2">
                  <div className="text-2xl font-bold text-destructive">
                    {criticalItems.length} itens críticos
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clique em um anúncio abaixo para ver detalhes
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução */}
      {historyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolução da Qualidade (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="averageScore" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Score Médio (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista de Anúncios com Baixa Performance */}
      {lowPerformanceItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anúncios que Precisam Atenção (Score &lt; 70%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowPerformanceItems.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <img src={item.thumbnail} className="w-16 h-16 rounded object-cover" alt={item.title} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{item.title}</h4>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Progress value={(item.health?.health_score || 0) * 100} className="w-32 h-2" />
                        <span className={`text-sm font-bold ${getHealthColor(item.health?.health_score || 0)}`}>
                          {((item.health?.health_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Badge variant={
                        item.health?.health_level === 'basic' ? 'destructive' :
                        item.health?.health_level === 'standard' ? 'secondary' :
                        'default'
                      }>
                        {item.health?.health_level}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.health?.goals_completed}/{item.health?.goals_applicable} objetivos completos
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onSelectItem(item.ml_item_id)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
