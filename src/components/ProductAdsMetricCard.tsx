import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ProductAdsMetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: string;
  icon: LucideIcon;
  gradient: string;
}

export const ProductAdsMetricCard = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  gradient
}: ProductAdsMetricCardProps) => {
  return (
    <Card className={`relative overflow-hidden ${gradient}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-sm text-white/70">{subtitle}</p>
            {trend && (
              <p className="text-sm font-semibold text-white/90">{trend}</p>
            )}
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
