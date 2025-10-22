import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductAd {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string | null;
  status: string;
  is_recommended: boolean;
  total_sales: number;
  advertised_sales: number;
  non_advertised_sales: number;
  roas: number | null;
  price: number;
}

interface RecommendedItemsTableProps {
  items: ProductAd[];
}

export const RecommendedItemsTable = ({ items }: RecommendedItemsTableProps) => {
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("sales");

  const filteredItems = items.filter(item => {
    if (filter === "active") return item.status === "active";
    if (filter === "inactive") return item.status !== "active";
    if (filter === "recommended") return item.is_recommended;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "sales") return b.total_sales - a.total_sales;
    if (sortBy === "roas") return (b.roas || 0) - (a.roas || 0);
    if (sortBy === "recommended") return (b.is_recommended ? 1 : 0) - (a.is_recommended ? 1 : 0);
    return 0;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Apenas com Ads Ativo</SelectItem>
            <SelectItem value="inactive">Apenas sem Ads</SelectItem>
            <SelectItem value="recommended">Recomendados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ordenar por..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">Mais vendas</SelectItem>
            <SelectItem value="roas">Maior ROAS</SelectItem>
            <SelectItem value="recommended">Recomendados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Produto</TableHead>
              <TableHead>Anúncio</TableHead>
              <TableHead className="text-center">Status Ads</TableHead>
              <TableHead className="text-right">Vendas (30d)</TableHead>
              <TableHead className="text-right">Com Ads</TableHead>
              <TableHead className="text-right">Sem Ads</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum anúncio encontrado
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium line-clamp-2">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.price)}
                      </p>
                      {item.is_recommended && (
                        <Badge variant="secondary" className="text-xs">
                          ⭐ Recomendado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.status === "active" ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        🟢 Ativo
                      </Badge>
                    ) : item.advertised_sales > 0 ? (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                        ⚠️ Pausado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        ⚪ Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.total_sales}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-600">
                        {item.advertised_sales}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-600">
                        {item.non_advertised_sales}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.roas ? (
                      <span className="font-semibold text-blue-600">
                        {item.roas.toFixed(1)}x
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`https://www.mercadolivre.com.br/p/${item.ml_item_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
