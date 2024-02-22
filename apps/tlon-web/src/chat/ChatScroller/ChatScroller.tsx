import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { PageTuple, ReplyTuple } from '@tloncorp/shared/dist/urbit/channel';
import { WritTuple } from '@tloncorp/shared/dist/urbit/dms';
import { BigInteger } from 'big-integer';
import React, {
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatIndexLocationWithAlign,
  FlatScrollIntoViewLocation,
  VirtuosoHandle,
} from 'react-virtuoso';

import ChatMessage from '@/chat/ChatMessage/ChatMessage';
import ChatNotice from '@/chat/ChatNotice';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import getKindDataFromEssay from '@/logic/getKindData';
import {
  useInvertedScrollInteraction,
  useUserHasScrolled,
} from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import {
  ChatMessageListItemData,
  useMessageData,
} from '@/logic/useScrollerMessages';
import { createDevLogger, useObjectChangeLogging } from '@/logic/utils';
import ReplyMessage from '@/replies/ReplyMessage';
import { useShowDevTools } from '@/state/local';

import ChatScrollerDebugOverlay from './ChatScrollerDebugOverlay';

const logger = createDevLogger('ChatScroller', false);

interface CustomScrollItemData {
  type: 'custom';
  key: string;
  component: ReactElement;
}

const ChatScrollerItem = React.memo(
  ({
    item,
    isScrolling,
  }: {
    item: ChatMessageListItemData | CustomScrollItemData;
    isScrolling: boolean;
  }) => {
    if (item.type === 'custom') {
      return item.component;
    }

    const { writ, time, ...rest } = item;

    if ('memo' in writ) {
      return (
        <ReplyMessage
          key={writ.seal.id}
          reply={writ}
          time={time}
          {...rest}
          showReply
        />
      );
    }

    const { notice } = getKindDataFromEssay(writ.essay);
    if (notice) {
      return <ChatNotice key={writ.seal.id} writ={writ} />;
    }

    return (
      <ChatMessage
        key={writ.seal.id}
        isScrolling={isScrolling}
        writ={writ}
        time={time}
        {...rest}
      />
    );
  }
);

function Loader({
  className,
  scaleY,
  children,
}: PropsWithChildren<{ className?: string; scaleY: number }>) {
  return (
    <div
      className={`absolute flex w-full justify-start text-base ${className}`}
      style={{ transform: `scaleY(${scaleY})` }}
    >
      <div className="m-4 flex items-center gap-3 rounded-lg text-gray-500">
        <div className="flex h-6 w-6 items-center justify-center">
          <LoadingSpinner primary="fill-gray-900" secondary="fill-gray-200" />
        </div>

        {children}
      </div>
    </div>
  );
}

function useBigInt(value?: BigInteger) {
  const lastValueRef = useRef(value);
  return useMemo(() => {
    const last = lastValueRef.current;
    if (last !== value && last && value && last.eq(value)) {
      return last;
    }
    lastValueRef.current = value;
    return value;
  }, [value]);
}

function useFakeVirtuosoHandle(
  ref: React.RefObject<VirtuosoHandle>,
  virtualizer: DivVirtualizer
) {
  useImperativeHandle(
    ref,
    () =>
      ({
        scrollToIndex(location: number | FlatIndexLocationWithAlign): void {
          const hasOptions = !(typeof location === 'number');
          if (hasOptions) {
            const { index: rawIndex, align, behavior } = location;
            const index = rawIndex === 'LAST' ? 0 : rawIndex;
            virtualizer.scrollToIndex(index, { align, behavior });
          } else {
            virtualizer.scrollToIndex(location);
          }
        },
        scrollIntoView({
          index,
          align,
          behavior,
          done,
        }: FlatScrollIntoViewLocation): void {
          virtualizer.scrollToIndex(index, { align, behavior });
          if (done) setTimeout(done, 500);
        },
      }) as VirtuosoHandle,
    [virtualizer]
  );
}

type DivVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;

const thresholds = {
  atEndThreshold: 2000,
  overscan: 6,
};

const loaderPadding = {
  top: 40,
  bottom: 0,
};

export interface ChatScrollerProps {
  whom: string;
  messages: PageTuple[] | WritTuple[] | ReplyTuple[];
  onAtTop?: () => void;
  onAtBottom?: () => void;
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
  replying?: boolean;
  inThread?: boolean;
  /**
   * Element to be inserted at the top of the list scroll after we've loaded the
   * entire history.
   */
  topLoadEndMarker?: ReactElement;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
  hasLoadedNewest: boolean;
  hasLoadedOldest: boolean;
}

export default function ChatScroller({
  whom,
  messages,
  onAtTop,
  onAtBottom,
  isLoadingOlder,
  isLoadingNewer,
  replying = false,
  inThread = false,
  topLoadEndMarker,
  scrollTo: rawScrollTo = undefined,
  scrollerRef,
  scrollElementRef,
  isScrolling,
  hasLoadedNewest,
  hasLoadedOldest,
}: ChatScrollerProps) {
  const isMobile = useIsMobile();
  const scrollTo = useBigInt(rawScrollTo);
  const showDevTools = useShowDevTools();
  const [loadDirection, setLoadDirection] = useState<'newer' | 'older'>(
    'older'
  );
  const [isAtBottom, setIsAtBottom] = useState(loadDirection === 'older');
  const [isAtTop, setIsAtTop] = useState(false);
  const contentElementRef = useRef<HTMLDivElement>(null);
  const { userHasScrolled, resetUserHasScrolled } =
    useUserHasScrolled(scrollElementRef);

  // Update the tracked load direction when loading state changes.
  useEffect(() => {
    if (isLoadingOlder && loadDirection !== 'older') {
      setLoadDirection('older');
    } else if (isLoadingNewer && loadDirection !== 'newer') {
      setLoadDirection('newer');
    }
  }, [isLoadingOlder, isLoadingNewer, loadDirection]);

  const { activeMessageKeys, activeMessageEntries } = useMessageData({
    whom,
    scrollTo,
    messages,
    replying,
  });

  const topItem: CustomScrollItemData | null = useMemo(
    () =>
      topLoadEndMarker && hasLoadedOldest
        ? {
            type: 'custom',
            key: 'top-marker',
            component: topLoadEndMarker,
          }
        : null,
    [topLoadEndMarker, hasLoadedOldest]
  );

  const [messageKeys, messageEntries] = useMemo(() => {
    const nextMessageKeys = [
      ...(topItem ? [topItem.key] : []),
      ...activeMessageKeys,
    ];
    const nextMessageEntries = [
      ...(topItem ? [topItem] : []),
      ...activeMessageEntries,
    ];
    return [nextMessageKeys, nextMessageEntries];
  }, [activeMessageKeys, activeMessageEntries, topItem]);

  const count = messageKeys.length;

  const anchorIndex = useMemo(() => {
    if (count === 0) {
      return null;
    }
    if (scrollTo) {
      const index = messageKeys.findIndex(
        (k) => !(typeof k === 'string') && k.greaterOrEquals(scrollTo)
      );
      return index === -1 ? null : index;
    }
    return count - 1;
  }, [messageKeys, count, scrollTo]);

  const virtualizerRef = useRef<DivVirtualizer>();
  // We need to track whether we're force scrolling so that we don't attempt
  // to change reading direction or load new content while we're in the
  // middle of a forced scroll.
  const isForceScrolling = useRef(false);

  /**
   * Set scroll position, bypassing virtualizer change logic.
   */
  const forceScroll = useCallback((offset: number, bypassDelay = false) => {
    if (isForceScrolling.current && !bypassDelay) return;
    logger.log('force scrolling to', offset);
    isForceScrolling.current = true;
    const virt = virtualizerRef.current;
    if (!virt) return;
    virt.scrollOffset = offset;
    virt.scrollElement?.scrollTo?.({ top: offset });
    setTimeout(() => {
      isForceScrolling.current = false;
    }, 300);
  }, []);

  const isEmpty = useMemo(
    () => count === 0 && hasLoadedNewest && hasLoadedOldest,
    [count, hasLoadedNewest, hasLoadedOldest]
  );
  const contentHeight = virtualizerRef.current?.getTotalSize() ?? 0;
  const scrollElementHeight = scrollElementRef.current?.clientHeight ?? 0;
  const isScrollable = useMemo(
    () => contentHeight > scrollElementHeight,
    [contentHeight, scrollElementHeight]
  );

  const { clientHeight, scrollTop, scrollHeight } =
    scrollElementRef.current ?? {
      clientHeight: 0,
      scrollTop: 0,
      scrollHeight: 0,
    };
  // Prevent list from being at the end of new messages and old messages
  // at the same time -- can happen if there are few messages loaded.
  const atEndThreshold = Math.min(
    (scrollHeight - clientHeight) / 2,
    thresholds.atEndThreshold
  );
  const isAtExactScrollEnd = scrollHeight - scrollTop === clientHeight;
  const isAtScrollBeginning = scrollTop === 0;
  const isAtScrollEnd =
    scrollTop + clientHeight >= scrollHeight - atEndThreshold;
  const readingDirectionRef = useRef('');

  // Determine whether the list should be inverted based on reading direction
  // and whether the content is scrollable or if we're scrolling to a specific
  // message.
  // If the user is scrolling up, we want to keep the list inverted.
  // If the user is scrolling down, we want to keep the list normal.
  // If the user is at the bottom, we want it inverted (this is set in the readingDirection
  // conditions further below).
  // If the content is not scrollable, we want it inverted.
  // If we're scrolling to a specific message, we want it normal because we
  // assume the user is reading from that message down.
  // However, if we're scrolling to a particular message in a thread, we want it inverted.

  const isInverted = isEmpty
    ? false
    : userHasScrolled && readingDirectionRef.current === 'down'
      ? false
      : userHasScrolled && readingDirectionRef.current === 'up'
        ? true
        : scrollElementRef.current?.clientHeight && !isScrollable
          ? true
          : scrollTo && !inThread
            ? false
            : true;

  useObjectChangeLogging(
    {
      isAtTop,
      isAtBottom,
      hasLoadedNewest,
      hasLoadedOldest,
      loadDirection,
      anchorIndex,
      isLoadingOlder,
      isLoadingNewer,
      isInverted,
      userHasScrolled,
      isForceScrolling: isForceScrolling.current,
    },
    logger
  );

  // We want to render newest messages first, but we receive them oldest-first.
  // This is a simple way to reverse the order without having to reverse a big array.
  const transformIndex = useCallback(
    (index: number) => (isInverted ? count - 1 - index : index),
    [count, isInverted]
  );

  /**
   * Scroll to current anchor index
   */
  const scrollToAnchor = useCallback(() => {
    const virt = virtualizerRef.current;
    if (!virt || anchorIndex === null) return;
    logger.log('scrolling to anchor', {
      anchorIndex,
    });
    const index = transformIndex(anchorIndex);
    const [nextOffset] = virt.getOffsetForIndex(index, 'center');
    const measurement = virt.measurementsCache[index];
    // If the anchor index is 0 (the newest message) we want to stay locked all
    // the way to the bottom
    // TODO: This looks a little off visually since the author of the message isn't highlighted.
    const sizeAdjustment = index === 0 ? 0 : (measurement?.size ?? 0) / 2;
    forceScroll(nextOffset + sizeAdjustment);
  }, [anchorIndex, forceScroll, transformIndex]);

  // Reset scroll when scrollTo changes
  useEffect(() => {
    if (scrollTo === undefined) return;
    logger.log('scrollto changed', scrollTo?.toString());
    resetUserHasScrolled();
    scrollToAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  const isLoadingAtStart = isInverted ? isLoadingOlder : isLoadingNewer;
  const isLoadingAtEnd = isInverted ? isLoadingNewer : isLoadingOlder;
  const paddingStart = isLoadingAtStart
    ? isInverted
      ? loaderPadding.bottom
      : loaderPadding.top
    : 0;
  const paddingEnd = isLoadingAtEnd
    ? isInverted
      ? loaderPadding.top
      : loaderPadding.bottom
    : 0;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: useCallback(
      () => scrollElementRef.current,
      [scrollElementRef]
    ),
    // Used by the virtualizer to keep track of scroll position. Note that the is
    // the *only* place the virtualizer accesses scroll position, so we can change
    // the virtualizer's idea of world state by modifying it.
    observeElementOffset: useCallback(
      (instance: DivVirtualizer, cb: (offset: number) => void) => {
        const el = instance.scrollElement;
        if (!el) {
          return undefined;
        }
        const onScroll = () => {
          cb(el.scrollTop);
        };
        cb(el.scrollTop);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
      },
      []
    ),
    // The virtualizer uses this to estimate items' sizes before they're rendered.
    // Determines where to place items initially, and how long the scroll content
    // is going to be overall. The better the estimate is, the less reflow will be
    // required after rendering.
    // TODO: This is a comically bad estimate. Making this a little better will
    // further reduce jank / reflow necessity.
    estimateSize: useCallback((index: number) => 100, []),
    getItemKey: useCallback(
      (index: number) => messageKeys[transformIndex(index)].toString(),
      [messageKeys, transformIndex]
    ),
    paddingStart,
    paddingEnd,
    scrollToFn: useCallback(
      (
        offset: number,
        {
          adjustments,
          behavior,
        }: { adjustments?: number; behavior?: ScrollBehavior },
        instance: DivVirtualizer
      ) => {
        // On iOS, changing scroll during momentum scrolling will cause stutters
        if (isMobile && isScrolling && userHasScrolled) {
          return;
        }
        // By default, the virtualizer tries to keep the position of the topmost
        // item on screen pinned, but we need to override that behavior to keep a
        // message centered or to stay at the bottom of the chat.
        if (
          anchorIndex !== null &&
          !userHasScrolled &&
          !isForceScrolling.current
        ) {
          // Fix for no-param-reassign
          scrollToAnchor();
        } else {
          instance.scrollElement?.scrollTo?.({
            // We only want adjustments if they're greater than zero.
            // Virtualizer will sometimes give us negative adjustments of -1, which
            // causes scrollTo to scroll very slightly, which then causes the
            // virtualizer to give us another positive adjustment of 1.
            // There's no pereceptible scroll to the user, but it causes
            // isScrolling to be true, which causes the chat input to lose focus.
            // We should only want positive adjustments anyway afaict.
            top: offset + (adjustments && adjustments > 1 ? adjustments : 0),
            behavior,
          });
        }
      },
      [isScrolling, isMobile, anchorIndex, userHasScrolled, scrollToAnchor]
    ),
    overscan: thresholds.overscan,
    // Called by the virtualizer whenever any layout property changes.
    // We're using it to keep track of top and bottom thresholds.
    onChange: useCallback(() => {
      if (
        anchorIndex !== null &&
        !userHasScrolled &&
        !isForceScrolling.current
      ) {
        scrollToAnchor();
      }
      const nextAtTop = isForceScrolling.current
        ? false
        : (isInverted && isAtScrollEnd) || (!isInverted && isAtScrollBeginning);
      const nextAtBottom = isForceScrolling.current
        ? false
        : (isInverted && isAtScrollBeginning) || (!isInverted && isAtScrollEnd);

      setIsAtTop(nextAtTop);
      setIsAtBottom(nextAtBottom);
    }, [
      isInverted,
      anchorIndex,
      userHasScrolled,
      scrollToAnchor,
      isAtScrollBeginning,
      isAtScrollEnd,
    ]),
  });
  virtualizerRef.current = virtualizer;

  useFakeVirtuosoHandle(scrollerRef, virtualizer);
  useInvertedScrollInteraction(scrollElementRef, isInverted);

  // Load more items when list reaches the top or bottom.
  useEffect(() => {
    if (isLoadingOlder || isLoadingNewer || !userHasScrolled) return;

    if (isAtTop && !hasLoadedOldest) {
      logger.log('triggering onAtTop');
      onAtTop?.();
    } else if (isAtBottom && !hasLoadedNewest) {
      logger.log('triggering onAtBottom');
      onAtBottom?.();
    }
  }, [
    isLoadingOlder,
    isLoadingNewer,
    hasLoadedNewest,
    hasLoadedOldest,
    isAtTop,
    isAtBottom,
    onAtTop,
    onAtBottom,
    userHasScrolled,
  ]);

  // When the list inverts, we need to flip the scroll position in order to appear to stay in the same place.
  // We do this here as opposed to in an effect so that virtualItems is correct in time for this render.
  const lastIsInverted = useRef(isInverted);
  if (
    isInverted !== lastIsInverted.current &&
    !isLoadingOlder &&
    !isLoadingNewer
  ) {
    const offset = contentHeight - virtualizerRef.current.scrollOffset;
    // We need to subtract the height of the scroll element to get the correct
    // offset when inverting.
    const newOffset = offset - scrollElementHeight;
    logger.log('inverting chat scroller, setting offset to', newOffset);
    // We need to bypass the delay here because we're inverting the scroll
    // immediately after the user has scrolled in this case.
    forceScroll(newOffset, true);
    lastIsInverted.current = isInverted;
  }

  const scaleY = isInverted ? -1 : 1;
  const virtualItems = virtualizer.getVirtualItems();
  // On first run, virtualizerRef will be empty, so contentHeight will be undefined.
  // TODO: Distentangle virtualizer init to avoid this.
  const finalHeight = contentHeight ?? virtualizer.getTotalSize();

  const { scrollDirection } = virtualizerRef.current ?? {};

  const lastOffset = useRef<number | null>(null);

  useEffect(() => {
    if (lastOffset.current === null) {
      lastOffset.current = virtualizer.scrollOffset;
    }

    if (isScrolling) {
      lastOffset.current = virtualizer.scrollOffset;
    }
  }, [isScrolling, virtualizer.scrollOffset]);

  // We use the absolute change in scroll offset to throttle the change in
  // reading direction. This is because the scroll direction can change
  // rapidly when the user is scrolling, and we don't want to change the
  // reading direction too quickly, it can be jumpy.
  // There is still a small jump when the user changes direction, but it's
  // less noticeable than if we didn't throttle it.
  const absoluteOffsetChange = lastOffset.current
    ? Math.abs(virtualizer.scrollOffset - lastOffset.current)
    : 0;

  useEffect(() => {
    if (
      userHasScrolled &&
      !isForceScrolling.current &&
      absoluteOffsetChange > 30
    ) {
      if (isInverted) {
        if (
          scrollDirection === 'backward' &&
          readingDirectionRef.current !== 'down'
        ) {
          logger.log(
            'isInverted and scrollDirection is backward setting reading direction to down'
          );
          readingDirectionRef.current = 'down';
        }

        if (
          scrollDirection === 'forward' &&
          readingDirectionRef.current !== 'up'
        ) {
          logger.log(
            'isInverted and scrollDirection is forward setting reading direction to up'
          );
          readingDirectionRef.current = 'up';
        }
      } else {
        if (
          scrollDirection === 'backward' &&
          readingDirectionRef.current !== 'up'
        ) {
          logger.log(
            'not isInverted and scrollDirection is backward setting reading direction to up'
          );
          readingDirectionRef.current = 'up';
        }

        if (
          scrollDirection === 'forward' &&
          readingDirectionRef.current !== 'down'
        ) {
          logger.log(
            'not isInverted and scrollDirection is forward setting reading direction to down'
          );
          readingDirectionRef.current = 'down';
        }

        if (scrollDirection === null && isAtExactScrollEnd) {
          logger.log(
            "not isInverted, scrollDirection is null, and we're at the bottom setting reading direction to up"
          );
          readingDirectionRef.current = 'up';
        }
      }
    }
  }, [
    scrollDirection,
    userHasScrolled,
    isAtExactScrollEnd,
    isInverted,
    absoluteOffsetChange,
  ]);

  return (
    <>
      <div
        ref={scrollElementRef}
        className="h-full w-full overflow-y-auto overflow-x-clip overscroll-contain"
        style={{ transform: `scaleY(${scaleY})` }}
        // We need this in order to get key events on the div, which we use remap
        // arrow and spacebar navigation when scrolling.
        // TODO: This now gets outlined when scrolling with keys. Should it?
        tabIndex={-1}
      >
        {hasLoadedNewest && hasLoadedOldest && count === 0 && (
          <EmptyPlaceholder>
            There are no messages in this channel
          </EmptyPlaceholder>
        )}

        <div
          className="l-0 absolute top-0 w-full"
          ref={contentElementRef}
          style={{
            height: `${finalHeight}px`,
            paddingTop: virtualItems[0]?.start ?? 0,
            pointerEvents: isScrolling ? 'none' : 'all',
          }}
        >
          {isLoadingAtStart && !isInverted && (
            <Loader className="top-0" scaleY={scaleY}>
              Loading {isInverted ? 'Newer' : 'Older'}
            </Loader>
          )}
          {virtualItems.map((virtualItem) => {
            const item = messageEntries[transformIndex(virtualItem.index)];
            return (
              <div
                key={virtualItem.key}
                className="relative w-full px-4 sm:hover:z-10"
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                style={{
                  transform: `scaleY(${scaleY})`,
                }}
              >
                <ChatScrollerItem item={item} isScrolling={isScrolling} />
              </div>
            );
          })}
          {isLoadingAtEnd && isInverted && (
            <Loader className="bottom-0" scaleY={scaleY}>
              Loading {isInverted ? 'Older' : 'Newer'}
            </Loader>
          )}
        </div>
      </div>
      {showDevTools ? (
        <ChatScrollerDebugOverlay
          {...{
            count,
            scrollOffset: virtualizer.scrollOffset,
            scrollHeight: finalHeight,
            scrollDirection: virtualizer.scrollDirection,
            readingDirection: readingDirectionRef.current,
            hasLoadedNewest,
            hasLoadedOldest,
            anchorIndex,
            isInverted,
            loadDirection,
            isAtBottom,
            isAtTop,
            isLoadingOlder,
            isLoadingNewer,
            userHasScrolled,
          }}
        />
      ) : null}
    </>
  );
}
