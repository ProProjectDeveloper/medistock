import { formatMoney } from '@medistock/core';
import { useData } from './store';

export function useMoney() {
  const { ds } = useData();
  return (n: number, compact = false) => formatMoney(n, ds.settings.currency, { compact });
}
