import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { fillPendingFxRates } from '@/src/fx/pending-fx';

export function PendingFxRefresher() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);

  useEffect(() => {
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try { await fillPendingFxRates(db, repository); } finally { running = false; }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [db, repository]);

  return null;
}
