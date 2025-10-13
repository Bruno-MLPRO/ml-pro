import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, AlertTriangle, XCircle } from "lucide-react";

interface ReputationBadgeProps {
  color: string;
  levelId: string | null;
  positiveRate: number;
  totalTransactions: number;
}

export function ReputationBadge({ color, levelId, positiveRate, totalTransactions }: ReputationBadgeProps) {
  const colorConfig = {
    dark_green: {
      bg: 'bg-green-500/10 border-green-500',
      text: 'text-green-600 dark:text-green-400',
      icon: TrendingUp,
      label: 'Excelente',
      description: 'Verde Escuro'
    },
    light_green: {
      bg: 'bg-green-400/10 border-green-400',
      text: 'text-green-500',
      icon: Star,
      label: 'Muito Bom',
      description: 'Verde Claro'
    },
    yellow: {
      bg: 'bg-yellow-400/10 border-yellow-400',
      text: 'text-yellow-600 dark:text-yellow-500',
      icon: AlertTriangle,
      label: 'Atenção',
      description: 'Amarelo'
    },
    orange: {
      bg: 'bg-orange-400/10 border-orange-400',
      text: 'text-orange-600 dark:text-orange-500',
      icon: AlertTriangle,
      label: 'Precisa Melhorar',
      description: 'Laranja'
    },
    red: {
      bg: 'bg-red-400/10 border-red-400',
      text: 'text-red-600 dark:text-red-500',
      icon: XCircle,
      label: 'Crítico',
      description: 'Vermelho'
    },
    gray: {
      bg: 'bg-gray-400/10 border-gray-400',
      text: 'text-gray-600 dark:text-gray-400',
      icon: Star,
      label: 'Sem Avaliações',
      description: 'Conta Nova'
    }
  };

  const config = colorConfig[color as keyof typeof colorConfig] || colorConfig.gray;
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${config.bg}`}>
      <Icon className={`w-6 h-6 ${config.text}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${config.text}`}>{config.label}</span>
          <Badge variant="outline" className={config.text}>{config.description}</Badge>
        </div>
      </div>
    </div>
  );
}
