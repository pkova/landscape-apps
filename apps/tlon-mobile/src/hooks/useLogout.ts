import { useCallback } from 'react';

import { useShip } from '../contexts/ship';
import { removeUrbitClient } from '../lib/api';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

export function useLogout() {
  const { clearShip } = useShip();
  const handleLogout = useCallback(() => {
    clearShip();
    removeUrbitClient();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  return { handleLogout };
}
