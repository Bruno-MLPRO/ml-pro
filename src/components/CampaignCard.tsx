import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, DollarSign, Package } from "lucide-react";

interface Campaign {
  id: string;
  campaign_id: number;
  campaign_name: string;
  status: string;
  strategy: string;
  budget: number;
  acos_target: number;
  total_spend: number;
  ad_revenue: number;
  total_revenue: number;
  total_sales: number;
  roas: number | null;
  acos: number | null;
  products_count: number;
}

interface CampaignCardProps {
  campaign: Campaign;
}

export const CampaignCard = ({ campaign }: CampaignCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'paused': 
      case 'hold': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'idle': return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'ATIVO',
      'paused': 'PAUSADO',
      'idle': 'INATIVO',
      'hold': 'RETIDO'
    };
    return translations[status.toLowerCase()] || status.toUpperCase();
  };

  const translateStrategy = (strategy: string) => {
    const translations: Record<string, string> = {
      'PROFITABILITY': 'RENTABILIDADE',
      'INCREASE': 'AUMENTAR',
      'TRAFFIC': 'TRÁFEGO'
    };
    return translations[strategy.toUpperCase()] || strategy;
  };

  const getRoasColor = (roas: number | null) => {
    if (!roas) return 'text-muted-foreground';
    if (roas >= 3) return 'text-green-600 font-bold';
    if (roas >= 1.5) return 'text-yellow-600 font-semibold';
    return 'text-red-600';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base mb-2">{campaign.campaign_name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(campaign.status)}>
                {translateStatus(campaign.status)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {translateStrategy(campaign.strategy)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span>Investimento</span>
            </div>
            <p className="text-sm font-semibold">
              R$ {campaign.total_spend.toFixed(2)}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              <span>Receita</span>
            </div>
            <p className="text-sm font-semibold">
              R$ {campaign.ad_revenue.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span>ROAS</span>
            </div>
            <p className={`text-sm font-semibold ${getRoasColor(campaign.roas)}`}>
              {campaign.roas ? `${campaign.roas.toFixed(2)}x` : 'N/A'}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Package className="h-3 w-3" />
              <span>Produtos</span>
            </div>
            <p className="text-sm font-semibold">
              {campaign.products_count}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Orçamento diário</span>
            <span className="font-medium">R$ {campaign.budget.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Meta ACOS</span>
            <span className="font-medium">{campaign.acos_target}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
