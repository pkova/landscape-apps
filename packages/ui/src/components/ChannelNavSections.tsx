import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { SizableText, YGroup, YStack } from '../core';
import ChannelListItem from './ChannelListItem';
import ChannelNavSection from './ChannelNavSection';

export default function ChannelNavSections({
  group,
  channels,
  onSelect,
  paddingBottom,
}: {
  group: db.GroupWithRelations;
  channels: db.ChannelWithLastPost[];
  onSelect: (channel: any) => void;
  paddingBottom?: number;
}) {
  const unGroupedChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          !group.navSections.some((s) =>
            s.channels.some((sc) => sc.channelId === c.id)
          )
      ),
    [channels, group.navSections]
  );

  const hasSomeUnGroupedChannels = useMemo(
    () => unGroupedChannels.length > 0,
    [unGroupedChannels]
  );

  const getChannelIcon = useCallback(
    (channelId: string | null) => {
      const channel = channels.find((c) => c.id === channelId);
      switch (channel?.type) {
        case 'chat':
          return 'ChannelTalk';
        case 'notebook':
          return 'ChannelNotebooks';
        case 'gallery':
          return 'ChannelGalleries';
        default:
          return 'ChannelTalk';
      }
    },
    [channels]
  );

  return (
    <YStack paddingBottom={paddingBottom} alignSelf="stretch" gap="$s">
      {group.navSections.map((section) => (
        <ChannelNavSection
          key={section.id}
          section={section}
          channels={channels}
          onSelect={onSelect}
        />
      ))}
      {hasSomeUnGroupedChannels && (
        <YStack>
          <SizableText
            paddingHorizontal="$l"
            paddingVertical="$xl"
            fontSize="$s"
            color="$secondaryText"
          >
            All Channels
          </SizableText>
          {unGroupedChannels.map((item) => (
            <ChannelListItem
              key={item.id}
              model={item}
              icon={getChannelIcon(item.id)}
              onPress={onSelect}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
}