import type { ClientTypes as Client } from '@tloncorp/shared';

import { unreadChannelsQuery } from './queries';
import { useObject, useQuery } from './realm';

// Model hooks
export function useContact(id: string): Client.Contact | null {
  return useObject('Contact', id);
}

export function useUnreadChannelsCount(): {
  total: number;
  groups: number;
  dms: number;
} {
  const groupUnreads = useQuery('Unread', unreadChannelsQuery('channel'));
  const dmUnreads = useQuery('Unread', unreadChannelsQuery('dm'));

  return {
    total: groupUnreads.length + dmUnreads.length,
    groups: groupUnreads.length,
    dms: dmUnreads.length,
  };
}
