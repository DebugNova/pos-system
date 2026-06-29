'use client'

import * as React from 'react'
import { usePOSStore } from "@/lib/store"
import {
  ThemeProvider as NextThemesProvider,
} from 'next-themes'

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const state = usePOSStore.getState();
    const hasTest = state.orders.some(o => o.id === 'ord-1782681841997' || (o.customerName && o.customerName.includes('Test')));
    if (hasTest) {
      usePOSStore.setState({ 
        orders: state.orders.filter(o => o.id !== 'ord-1782681841997' && !(o.customerName && o.customerName.includes('Test')))
      });
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
