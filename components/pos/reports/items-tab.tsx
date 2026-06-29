"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown } from "lucide-react";

export function ItemsTab({ props }: any) {
  const { itemDetails, totalRevenue, totalOrders } = props;
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("totalQuantity");
  const [sortDesc, setSortDesc] = useState(true);

  const processedItems = useMemo(() => {
    return itemDetails
      .map((item: any) => {
        const attachRate = totalOrders > 0 ? (item.timesInOrder / totalOrders) * 100 : 0;
        const pctRevenue = totalRevenue > 0 ? (item.grossRevenue / totalRevenue) * 100 : 0;
        const avgPrice = item.totalQuantity > 0 ? item.grossRevenue / item.totalQuantity : 0;
        return {
          ...item,
          attachRate,
          pctRevenue,
          avgPrice
        };
      })
      .filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a: any, b: any) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
  }, [itemDetails, totalRevenue, totalOrders, search, sortField, sortDesc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-4">
      <Card className="bg-gradient-to-br from-orange-50/90 via-amber-50/50 to-rose-50/90 dark:from-orange-950/20 dark:via-amber-950/10 dark:to-rose-950/20 border-orange-200/50 dark:border-orange-900/50 shadow-md flex-1 flex flex-col min-h-[300px] rounded-[32px] overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 px-4 sm:px-6 gap-3">
          <CardTitle className="text-lg font-black tracking-tighter text-orange-950 dark:text-orange-50 relative z-10 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600">✨</span>
            Menu Performance
          </CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search items..."
              className="pl-8 bg-secondary/50 border-0 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 flex-1 overflow-auto relative z-10">
          <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-md overflow-hidden shadow-sm h-full flex flex-col">
          <Table>
            <TableHeader className="sticky top-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl z-10 border-b border-white/40 dark:border-white/10">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="w-[200px]">Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('totalQuantity')}>
                  <div className="flex items-center justify-end gap-1 active:text-primary">
                    Qty Sold {sortField === 'totalQuantity' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('grossRevenue')}>
                  <div className="flex items-center justify-end gap-1 active:text-primary">
                    Revenue {sortField === 'grossRevenue' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead className="text-right">% of Rev</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('attachRate')}>
                  <div className="flex items-center justify-end gap-1 active:text-primary">
                    Attach Rate {sortField === 'attachRate' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                processedItems.map((item: any) => (
                  <TableRow key={item.menuItemId} className="border-b border-white/20 dark:border-white/5 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold text-foreground">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-semibold bg-orange-100/50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 border border-orange-200/50">{item.category || 'Uncategorized'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.totalQuantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{item.grossRevenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.pctRevenue.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{item.avgPrice.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">{item.timesInOrder} orders</span>
                        <Badge variant="outline" className={item.attachRate > 20 ? 'border-emerald-500/50 text-emerald-700 bg-emerald-100/50 font-bold' : 'bg-white/50 dark:bg-black/50 border-white/50'}>
                          {item.attachRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
