import LinkIcon from '@/components/icons/LinkIcon';
import { Node, NodeViewProps } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  NodeViewContent,
} from '@tiptap/react';
import React from 'react';
import useDiaryNode from './useDiaryNode';

function DiaryLinkComponent(props: NodeViewProps) {
  const bind = useDiaryNode('href', props);
  return (
    <NodeViewWrapper>
      <NodeViewContent>
        <div className="absolute inset-x-4 bottom-4 flex h-8 items-center space-x-2 rounded-lg border border-gray-100 bg-white px-2">
          <LinkIcon className="h-4 w-4" />
          <input
            className="input-transparent grow"
            type="text"
            {...bind}
            placeholder="Enter a URL"
          />
        </div>
      </NodeViewContent>
    </NodeViewWrapper>
  );
}

const DiaryLinkNode = Node.create({
  name: 'diary-link',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  inline: false,
  group: 'block',
  addAttributes() {
    return {
      href: {
        default: '',
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiaryLinkComponent);
  },
});

export default DiaryLinkNode;
