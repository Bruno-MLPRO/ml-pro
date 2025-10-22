import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Zap } from "lucide-react";

interface SimpleProduct {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string | null;
  status: string;
  is_recommended: boolean;
  campaign_name: string | null;
  price: number;
}

interface SimpleProductsTableProps {
  items: SimpleProduct[];
}

export const SimpleProductsTable = ({ items }: SimpleProductsTableProps) => {
  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'ativo',
      'paused': 'pausado',
      'idle': 'inativo',
      'hold': 'retido'
    };
    return translations[status.toLowerCase()] || status;
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>
      ) : (
        items.slice(0, 10).map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            {item.thumbnail && (
              <img src={item.thumbnail} alt={item.title} className="w-16 h-16 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{translateStatus(item.status)}</Badge>
                {item.campaign_name && <Badge variant="outline" className="text-xs">{item.campaign_name}</Badge>}
                {item.is_recommended && (
                  <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                    <Zap className="w-3 h-3 mr-1" />Recomendado
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              <p className="text-sm font-semibold">R$ {item.price.toFixed(2)}</p>
              <Button variant="ghost" size="sm" asChild>
                <a href={`https://www.mercadolivre.com.br/p/${item.ml_item_id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
