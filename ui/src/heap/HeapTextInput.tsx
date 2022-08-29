import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { HeapInline, CurioHeart, HeapInlineKey, LIST } from '@/types/heap';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useHeapDisplayMode, useHeapState } from '@/state/heap/heap';
import { reduce } from 'lodash';
import classNames from 'classnames';
import useRequestState from '@/logic/useRequestState';
import { parseTipTapJSON } from '@/logic/tiptap';

interface HeapTextInputProps {
  flag: string;
  sendDisabled?: boolean;
  draft: JSONContent | undefined;
  setDraft: React.Dispatch<React.SetStateAction<JSONContent | undefined>>;
  replyTo?: string | null;
}

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: HeapInlineKey): x is typeof MERGEABLE_KEYS[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
function normalizeHeapInline(inline: HeapInline[]): HeapInline[] {
  return reduce(
    inline,
    (acc: HeapInline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as HeapInlineKey;
      const currKey = Object.keys(val)[0] as keyof HeapInlineKey;
      if (isMergeable(lastKey) && currKey === lastKey) {
        // @ts-expect-error keying weirdness
        const end: HeapInline = {
          // @ts-expect-error keying weirdness
          [lastKey]: [...last[lastKey as any], ...val[currKey as any]],
        };
        return [...acc.slice(0, -1), end];
      }
      return [...acc, val];
    },
    []
  );
}

export default function HeapTextInput({
  flag,
  sendDisabled = false,
  replyTo = null,
  draft,
  setDraft,
}: HeapTextInputProps) {
  const displayMode = useHeapDisplayMode(flag);
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();

  // TODO: support for edit?
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      setPending();

      const content = normalizeHeapInline(
        parseTipTapJSON(editor?.getJSON()) as HeapInline[]
      );

      const heart: CurioHeart = {
        title: null, // TODO: do we need to set a title?
        replying: replyTo,
        author: window.our,
        sent: Date.now(),
        content,
      };

      await useHeapState.getState().addCurio(flag, heart);
      setDraft(undefined);
      editor?.commands.setContent('');
      setReady();
    },
    [flag, setDraft, setPending, setReady, replyTo]
  );

  const onUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      setDraft(editor.getJSON());
    },
    [setDraft]
  );

  const messageEditor = useMessageEditor({
    content: draft || '',
    placeholder: 'Enter Text Here',
    onUpdate,
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

  useEffect(() => {
    if (flag && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [flag, messageEditor]);

  useEffect(() => {
    if (draft && messageEditor && !messageEditor.isDestroyed) {
      messageEditor.commands.setContent(draft);
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageEditor]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <>
      <div className="relative flex-1 p-1">
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          inputClassName={classNames(
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'font-semibold text-gray-400' : '',
            displayMode === LIST ? 'min-h-[44px]' : ''
          )}
        />
        <button
          className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
          disabled={sendDisabled || isPending || messageEditor.getText() === ''}
          onClick={onClick}
        >
          {isPending ? 'Posting...' : 'Post'}
        </button>
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
