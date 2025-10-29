import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Target,
  Shield
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AnalysisResultProps {
  analysis: {
    persona: string;
    recommendation: string;
    confidence_score: number;
    analysis_text: string;
    key_metrics: {
      profit_margin: string;
      roi: string;
      net_profit: string;
      risk_score: string;
    };
  };
  personaSlug: string;
  personaData?: {
    name: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
  };
}

export default function AnalysisResult({ analysis, personaSlug, personaData }: AnalysisResultProps) {
  const getRecommendationConfig = (rec: string) => {
    switch (rec) {
      case 'buy':
        return {
          label: 'COMPRAR',
          icon: <CheckCircle2 className="w-6 h-6" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-500',
          badgeVariant: 'default' as const
        };
      case 'avoid':
        return {
          label: 'EVITAR',
          icon: <XCircle className="w-6 h-6" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-500',
          badgeVariant: 'destructive' as const
        };
      case 'consider':
        return {
          label: 'CONSIDERAR',
          icon: <AlertCircle className="w-6 h-6" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-500',
          badgeVariant: 'secondary' as const
        };
      default:
        return {
          label: 'INDEFINIDO',
          icon: <AlertCircle className="w-6 h-6" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-500',
          badgeVariant: 'outline' as const
        };
    }
  };

  const recommendationConfig = getRecommendationConfig(analysis.recommendation);
  const confidenceColor = analysis.confidence_score >= 70 ? 'text-green-600' :
                         analysis.confidence_score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header da Análise */}
      <Card className={`border-2 ${recommendationConfig.borderColor}`}>
        <CardHeader className={recommendationConfig.bgColor}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={recommendationConfig.color}>
                {recommendationConfig.icon}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  Recomendação: {recommendationConfig.label}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Análise realizada por: <strong>{analysis.persona}</strong>
                </p>
              </div>
            </div>
            
            <Badge variant={recommendationConfig.badgeVariant} className="text-lg py-2 px-4">
              {recommendationConfig.label}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Confiança */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">Confiança</span>
              </div>
              <span className={`text-2xl font-bold ${confidenceColor}`}>
                {Math.round(analysis.confidence_score)}%
              </span>
            </div>
            <Progress value={analysis.confidence_score} className="h-2" />
          </CardContent>
        </Card>

        {/* Margem de Lucro */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Margem de Lucro</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {analysis.key_metrics.profit_margin}%
            </p>
          </CardContent>
        </Card>

        {/* ROI */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium">ROI</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {analysis.key_metrics.roi}%
            </p>
          </CardContent>
        </Card>

        {/* Risco */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium">Score de Risco</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {analysis.key_metrics.risk_score}/100
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Análise Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {personaData?.icon}
            Análise Detalhada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold mt-6 mb-3 flex items-center gap-2" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside space-y-1 my-2" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="my-2 leading-relaxed" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-semibold text-foreground" {...props} />
                ),
              }}
            >
              {analysis.analysis_text}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Lucro Líquido Estimado */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Lucro Líquido Estimado por Venda</p>
            <p className="text-4xl font-bold text-green-600">
              R$ {analysis.key_metrics.net_profit}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

