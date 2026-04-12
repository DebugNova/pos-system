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
      <Card className="bg-card border-border flex-1 flex flex-col min-h-[300px]">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 px-4 sm:px-6 gap-3">
          <CardTitle className="text-base">Menu Performance</CardTitle>
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
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b">
              <TableRow className="hover:bg-transparent">
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
                  <TableRow key={item.menuItemId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{item.category || 'Uncategorized'}</Badge>
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
                        <Badge variant="outline" className={item.attachRate > 20 ? 'border-success text-success bg-success/10' : ''}>
                          {item.attachRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
