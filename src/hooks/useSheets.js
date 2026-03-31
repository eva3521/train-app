import { useEffect } from 'react';
import useStore from '../store/useStore';

export default function useSheets() {
  const fetchAll = useStore(s => s.fetchAll);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { loading, error };
}
