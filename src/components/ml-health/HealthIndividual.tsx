import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, Minus, ListChecks } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HealthGoal {
  id: string;
  name: string;
  progress: number;
  progress_max: number;
  apply: boolean;
  completed?: string;
}

interface MLProduct {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string;
  permalink: string;
  health?: {
    health_score: number;
    health_level: string;
    goals: HealthGoal[];
    goals_completed: number;
    goals_applicable: number;
    score_trend: string;
    previous_score?: number;
  };
}

interface ItemHistoryData {
  date: string;
  score: number;
}

interface HealthIndividualProps {
  products: MLProduct[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  itemHistory: ItemHistoryData[];
}

const getGoalSuggestion = (goalId: string, missing: number): string => {
  const suggestions: Record<string, string> = {
    'technical_specification': `Adicione ${missing} atributos técnicos para melhorar a descoberta do produto`,
    'picture': 'Adicione mais fotos de alta qualidade (mínimo 1200x1200px)',
    'product_identifiers': 'Adicione códigos de barras (EAN/UPC) para melhor rastreabilidade',
    'variations': 'Crie variações do produto (cores, tamanhos) se aplicável',
    'free_shipping': 'Ative o frete grátis para aumentar a competitividade',
    'flex': 'Ative o envio FLEX para agilizar entregas',
    'installments_free': 'Ofereça parcelamento sem juros',
    'size_chart': 'Adicione tabela de medidas (importante para roupas)',
  };
  
  return suggestions[goalId] || 'Complete este objetivo para melhorar o score';
};

const getActionTitle = (goalId: string): string => {
  const titles: Record<string, string> = {
    'technical_specification': 'Adicionar Especificações Técnicas',
    'picture': 'Melhorar Qualidade das Fotos',
    'product_identifiers': 'Adicionar Códigos de Produto',
    'variations': 'Criar Variações',
    'free_shipping': 'Ativar Frete Grátis',
    'flex': 'Ativar Envio FLEX',
    'installments_free': 'Configurar Parcelamento',
    'size_chart': 'Adicionar Tabela de Medidas',
  };
  
  return titles[goalId] || 'Completar Objetivo';
};

const getActionDescription = (goalId: string, missing: number): string => {
  const descriptions: Record<string, string> = {
    'technical_specification': `Preencha ${missing} atributos técnicos no cadastro do produto`,
    'picture': 'Adicione fotos em alta resolução (recomendado: 1200x1200px ou maior)',
    'product_identifiers': 'Cadastre o código EAN/UPC do produto',
    'variations': 'Crie variações se seu produto tem cores/tamanhos diferentes',
  };
  
  return descriptions[goalId] || `Complete ${missing} pendências`;
};

export function HealthIndividual({ products, selectedItemId, onSelectItem, itemHistory }: HealthIndividualProps) {
  const selectedItem = products.find(p => p.ml_item_id === selectedItemId);
  const productsWithHealth = products.filter(p => p.health);

  if (!selectedItemId || !selectedItem?.health) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Selecione um anúncio para ver a análise detalhada
            </p>
            <Select value={selectedItemId || ''} onValueChange={onSelectItem}>
              <SelectTrigger className="w-full max-w-xl mx-auto">
                <SelectValue placeholder="Selecione um anúncio" />
              </SelectTrigger>
              <SelectContent>
                {productsWithHealth.map(product => (
                  <SelectItem key={product.ml_item_id} value={product.ml_item_id}>
                    <div className="flex items-center gap-2">
                      <img src={product.thumbnail} className="w-8 h-8 rounded" alt={product.title} />
                      <span className="truncate max-w-md">{product.title}</span>
                      <Badge variant={
                        (product.health?.health_score || 0) > 0.7 ? 'default' : 'destructive'
                      }>
                        {((product.health?.health_score || 0) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = selectedItem.health;
  const pendingGoals = health.goals
    .filter(g => g.apply && g.progress < g.progress_max)
    .sort((a, b) => (b.progress_max - b.progress) - (a.progress_max - a.progress));

  return (
    <div className="space-y-6">
      {/* Seletor de Anúncio */}
      <div className="flex items-center gap-4">
        <Select value={selectedItemId} onValueChange={onSelectItem}>
          <SelectTrigger className="w-full max-w-xl">
            <SelectValue placeholder="Selecione um anúncio" />
          </SelectTrigger>
          <SelectContent>
            {productsWithHealth.map(product => (
              <SelectItem key={product.ml_item_id} value={product.ml_item_id}>
                <div className="flex items-center gap-2">
                  <img src={product.thumbnail} className="w-8 h-8 rounded" alt={product.title} />
                  <span className="truncate max-w-md">{product.title}</span>
                  <Badge variant={
                    (product.health?.health_score || 0) > 0.7 ? 'default' : 'destructive'
                  }>
                    {((product.health?.health_score || 0) * 100).toFixed(0)}%
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Header com Score Detalhado */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Score Geral</div>
              <div className="text-4xl font-bold mt-1">
                {(health.health_score * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Nível de Qualidade</div>
              <div className="text-2xl font-bold mt-1 capitalize">
                {health.health_level}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Objetivos</div>
              <div className="text-2xl font-bold mt-1">
                {health.goals_completed}/{health.goals_applicable}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tendência</div>
              <div className="flex items-center gap-2 mt-1">
                {health.score_trend === 'improving' && (
                  <><TrendingUp className="w-5 h-5 text-green-600" /> <span>Melhorando</span></>
                )}
                {health.score_trend === 'declining' && (
                  <><TrendingDown className="w-5 h-5 text-red-600" /> <span>Piorando</span></>
                )}
                {health.score_trend === 'stable' && (
                  <><Minus className="w-5 h-5 text-muted-foreground" /> <span>Estável</span></>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento de Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada de Objetivos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {health.goals
              .filter(goal => goal.apply)
              .map(goal => {
                const isCompleted = goal.progress === goal.progress_max;
                const percentage = (goal.progress / goal.progress_max) * 100;
                
                return (
                  <div key={goal.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        )}
                        <span className="font-medium capitalize">
                          {goal.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <Badge variant={isCompleted ? 'default' : 'secondary'}>
                        {goal.progress}/{goal.progress_max}
                      </Badge>
                    </div>
                    
                    <Progress value={percentage} className="h-2 mb-2" />
                    
                    {!isCompleted && (
                      <p className="text-sm text-muted-foreground">
                        {getGoalSuggestion(goal.id, goal.progress_max - goal.progress)}
                      </p>
                    )}
                    
                    {goal.completed && (
                      <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
                        <CheckCircle2 className="w-3 h-3" />
                        Completo em {new Date(goal.completed).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Ações Pendentes */}
      {pendingGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              Ações Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingGoals.map((goal, index) => (
                <div key={goal.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium">{getActionTitle(goal.id)}</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getActionDescription(goal.id, goal.progress_max - goal.progress)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedItem.permalink, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Editar no ML
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Performance */}
      {itemHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={itemHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Score (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
