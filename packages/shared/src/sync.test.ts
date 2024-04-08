import {
  MockedFunction,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { toClientGroup, toPagedPostsData } from './api';
import { scry } from './api/urbit';
import * as db from './db';
import {
  syncChannel,
  syncContacts,
  syncDms,
  syncGroups,
  syncPinnedItems,
} from './sync';
import rawChannelPostsData from './test/channelPosts.json';
import rawContactsData from './test/contacts.json';
import rawGroupsData from './test/groups.json';
import { resetDb, setupDb } from './test/helpers';
import { PagedPosts } from './urbit';
import { Contact as UrbitContact } from './urbit/contact';
import { Group as UrbitGroup } from './urbit/groups';

const contactsData = rawContactsData as unknown as Record<string, UrbitContact>;
const groupsData = rawGroupsData as unknown as Record<string, UrbitGroup>;

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

const inputData = [
  '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  '~solfer-magfed',
  '~nibset-napwyn/tlon',
];

const outputData = [
  {
    type: 'club',
    index: 0,
    itemId: inputData[0],
  },
  {
    type: 'dm',
    index: 1,
    itemId: inputData[1],
  },
  {
    type: 'group',
    index: 2,
    itemId: inputData[2],
  },
];

vi.mock('./api/urbit', async () => {
  return {
    scry: vi.fn(),
  };
});

function setScryOutput<T>(output: T) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementationOnce(
    async () => output
  );
}

function setScryOutputs<T>(outputs: T[]) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementation(
    async () => outputs.shift()!
  );
}

test('syncs pins', async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = await db.getPinnedItems({
    orderBy: 'type',
    direction: 'asc',
  });
  expect(savedItems).toEqual(outputData);
});

test('syncs contacts', async () => {
  setScryOutput(contactsData);
  await syncContacts();
  const storedContacts = await db.getContacts();
  expect(storedContacts.length).toEqual(
    Object.values(contactsData).filter((n) => !!n).length
  );
  storedContacts.forEach((c) => {
    const original = contactsData[c.id];
    expect(original).toBeTruthy();
    expect(original.groups?.length ?? 0).toEqual(c.pinnedGroups.length);
  });
  setScryOutput(contactsData);
  await syncContacts();
});

test('sync groups', async () => {
  setScryOutput(groupsData);
  await syncGroups();
  const pins = Object.keys(groupsData).slice(0, 3);
  setScryOutput(pins);
  await syncPinnedItems();
  const storedGroups = await db.getGroups({ sort: 'pinIndex' });
  expect(storedGroups.length).toEqual(Object.values(groupsData).length);
  expect(storedGroups[0].pinIndex).toEqual(0);
  expect(storedGroups[1].pinIndex).toEqual(1);
  expect(storedGroups[2].pinIndex).toEqual(2);
});

test('syncs dms', async () => {
  const groupDmId = '0v4.00000.qd4p2.it253.qs53q.s53qs';
  setScryOutputs([
    ['~solfer-magfed'],
    {
      [groupDmId]: {
        net: 'done',
        hive: ['~latter-bolden'],
        team: [
          '~nocsyx-lassul',
          '~rilfun-lidlen',
          '~pondus-watbel',
          '~solfer-magfed',
          '~finned-palmer',
          '~palfun-foslup',
        ],
        meta: {
          image: '#f0ebbd',
          title: 'Pensacola 2024-04',
          cover: '',
          description: '',
        },
      },
    },
  ]);
  await syncDms();

  const singleChannel = await db.getChannel({
    id: '~solfer-magfed',
    includeMembers: true,
  });
  expect(singleChannel).toEqual({
    id: '~solfer-magfed',
    type: 'dm',
    groupId: null,
    iconImage: null,
    iconImageColor: null,
    coverImage: null,
    coverImageColor: null,
    title: '',
    description: '',
    addedToGroupAt: null,
    currentUserIsMember: null,
    postCount: null,
    unreadCount: null,
    firstUnreadPostId: null,
    lastPostId: null,
    lastPostAt: null,
    syncedAt: null,
    remoteUpdatedAt: null,
    members: [
      {
        channelId: '~solfer-magfed',
        contactId: '~solfer-magfed',
        contact: null,
      },
    ],
  });
  const groupDmChannel = await db.getChannel({
    id: groupDmId,
    includeMembers: true,
  });
  expect(groupDmChannel).toEqual({
    id: '0v4.00000.qd4p2.it253.qs53q.s53qs',
    type: 'groupDm',
    groupId: null,
    iconImage: null,
    iconImageColor: '#f0ebbd',
    coverImage: null,
    coverImageColor: null,
    title: 'Pensacola 2024-04',
    description: '',
    addedToGroupAt: null,
    currentUserIsMember: null,
    postCount: null,
    unreadCount: null,
    firstUnreadPostId: null,
    lastPostId: null,
    lastPostAt: null,
    syncedAt: null,
    remoteUpdatedAt: null,
    members: [
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~finned-palmer',
        contact: null,
      },
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~nocsyx-lassul',
        contact: null,
      },
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~palfun-foslup',
        contact: null,
      },
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~pondus-watbel',
        contact: null,
      },
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~rilfun-lidlen',
        contact: null,
      },
      {
        channelId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
        contactId: '~solfer-magfed',
        contact: null,
      },
    ],
  });
});

const groupId = 'test-group';
const channelId = 'test-channel';
const unreadTime = 1712091148002;

const testGroupData: db.GroupInsert = {
  ...toClientGroup(
    groupId,
    Object.values(rawGroupsData)[0] as unknown as UrbitGroup,
    true
  ),
  navSections: [
    {
      id: 'abc',
      groupId,
      channels: [{ index: 0, channelId, groupNavSectionId: 'abc' }],
    },
  ],
  channels: [{ id: channelId, groupId, type: 'chat' }],
};

test('sync posts', async () => {
  await db.insertGroups([testGroupData]);
  const insertedChannel = await db.getChannel({ id: channelId });
  expect(insertedChannel).toBeTruthy();
  setScryOutput(rawChannelPostsData);
  await syncChannel(channelId, unreadTime);
  const convertedPosts = toPagedPostsData(
    channelId,
    rawChannelPostsData as unknown as PagedPosts
  );
  const lastPost = convertedPosts.posts[convertedPosts.posts.length - 1]!;
  const channel = await db.getChannel({ id: channelId });
  expect(channel?.remoteUpdatedAt).toEqual(unreadTime);
  expect(channel?.lastPostAt).toEqual(lastPost.receivedAt);
  expect(channel?.lastPostId).toEqual(lastPost.id);

  const posts = await db.getPosts();
  expect(posts.length).toEqual(convertedPosts.posts.length);

  const groups = await db.getGroups({ includeLastPost: true });
  expect(groups[0].id).toEqual(groupId);
  expect(groups[0].lastPostAt).toEqual(lastPost.receivedAt);
  expect(groups[0].lastPostId).toEqual(lastPost.id);
  expect(groups[0].lastPost?.id).toEqual(groups[0].lastPostId);
  expect(groups[0].lastPost?.textContent).toEqual(lastPost.textContent);
});

test('deletes removed posts', async () => {
  await db.insertGroups([testGroupData]);
  const insertedChannel = await db.getChannel({ id: channelId });
  expect(insertedChannel).toBeTruthy();
  const deletedPosts = Object.fromEntries(
    Object.entries(rawChannelPostsData.posts).map(([id, post]) => [id, null])
  );
  const deleteResponse = { ...rawChannelPostsData, posts: deletedPosts };
  setScryOutput(deleteResponse as PagedPosts);
  await syncChannel(channelId, unreadTime);
  const posts = await db.getPosts();
  expect(posts.length).toEqual(0);
});
