import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  db
} from '../firebase-config.js';

export const MEETING_STATUSES = ['draft', 'approved', 'completed'];
export const MEETING_ITEM_TYPES = ['reminder', 'discussion', 'suggestion', 'announcement', 'decision', 'assignment', 'follow-up', 'other'];
export const MEETING_ITEM_STATUSES = ['not-started', 'in-progress', 'completed', 'deferred', 'cancelled'];

const MAX_MEETINGS_PER_MONTH = 150;
const MAX_ITEMS_PER_MEETING = 300;
const MAX_NOTES_PER_ITEM = 200;
const DELETE_BATCH_SIZE = 350;
const MAX_SEARCH_RESULTS_PER_SOURCE = 100;
const MAX_SEARCH_MEETINGS_TO_HYDRATE = 40;

function getActor(actorName) {
  const sessionName = typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem('loggedInAdminName');
  return String(actorName || sessionName || 'الإدارة').trim();
}

function assertRequiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} مطلوب`);
  return value.trim();
}

function assertGregorianDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error(`${label} يجب أن يكون تاريخًا ميلاديًا صالحًا`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} يجب أن يكون تاريخًا ميلاديًا صالحًا`);
  }
  return value;
}

function assertOptionalChoice(value, choices, label, fallback) {
  const choice = value || fallback;
  if (!choices.includes(choice)) throw new Error(`${label} غير صالح`);
  return choice;
}

export function getCurrentGregorianMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLocalGregorianDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeMeetingSearchTokens(...values) {
  const normalized = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return [...new Set(normalized.split(/\s+/).filter(token => token.length > 1))].slice(0, 250);
}

export async function createMeeting(input, actorName) {
  const title = assertRequiredText(input.title, 'عنوان الاجتماع');
  const meetingDate = assertGregorianDate(input.meetingDate, 'تاريخ الاجتماع');
  const status = assertOptionalChoice(input.status, MEETING_STATUSES, 'حالة الاجتماع', 'draft');
  const actor = getActor(actorName);

  const meetingData = {
    title,
    meetingDate,
    monthKey: meetingDate.slice(0, 7),
    meetingTime: String(input.meetingTime || '').trim(),
    location: String(input.location || '').trim(),
    description: String(input.description || '').trim(),
    status,
    searchTokens: normalizeMeetingSearchTokens(title, input.description),
    itemCount: 0,
    completedItemCount: 0,
    inProgressItemCount: 0,
    nextDueDate: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  };

  const meetingRef = await addDoc(collection(db, 'meetings'), meetingData);
  return { id: meetingRef.id, ...meetingData };
}

export async function getMeeting(meetingId) {
  const meetingSnapshot = await getDoc(doc(db, 'meetings', meetingId));
  return meetingSnapshot.exists() ? { id: meetingSnapshot.id, ...meetingSnapshot.data() } : null;
}

export async function listMeetings({ monthKey = getCurrentGregorianMonthKey(), pageSize = MAX_MEETINGS_PER_MONTH } = {}) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error('الشهر يجب أن يكون بصيغة ميلادية YYYY-MM');
  const safePageSize = Math.min(Math.max(Number(pageSize) || MAX_MEETINGS_PER_MONTH, 1), MAX_MEETINGS_PER_MONTH);
  const snapshot = await getDocs(query(
    collection(db, 'meetings'),
    where('monthKey', '==', monthKey),
    limit(safePageSize)
  ));
  return snapshot.docs
    .map(meetingDoc => ({ id: meetingDoc.id, ...meetingDoc.data() }))
    .sort((first, second) => String(second.meetingDate || '').localeCompare(String(first.meetingDate || '')));
}

export async function searchMeetings(searchText, resultLimit = 40) {
  const searchTokens = normalizeMeetingSearchTokens(searchText).slice(0, 10);
  if (!searchTokens.length) return [];

  const [meetingSnapshot, itemSnapshot, noteSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'meetings'), where('searchTokens', 'array-contains-any', searchTokens), limit(MAX_SEARCH_RESULTS_PER_SOURCE))),
    getDocs(query(collection(db, 'meetingItems'), where('searchTokens', 'array-contains-any', searchTokens), limit(MAX_SEARCH_RESULTS_PER_SOURCE))),
    getDocs(query(collectionGroup(db, 'notes'), where('searchTokens', 'array-contains-any', searchTokens), limit(MAX_SEARCH_RESULTS_PER_SOURCE)))
  ]);

  const hasAllTokens = record => searchTokens.every(token => (record.searchTokens || []).includes(token));
  const matches = [
    ...meetingSnapshot.docs
      .map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
      .filter(hasAllTokens)
      .map(meeting => ({ kind: 'meeting', meetingId: meeting.id, matchTitle: meeting.title, matchText: meeting.description || '' })),
    ...itemSnapshot.docs
      .map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
      .filter(item => item.meetingId && hasAllTokens(item))
      .map(item => ({ kind: 'item', meetingId: item.meetingId, itemId: item.id, matchTitle: item.title, matchText: item.details || '' })),
    ...noteSnapshot.docs
      .map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
      .filter(note => note.meetingId && note.itemId && hasAllTokens(note))
      .map(note => ({ kind: 'note', meetingId: note.meetingId, itemId: note.itemId, matchTitle: 'ملاحظة متابعة', matchText: note.text || '' }))
  ];

  const uniqueMeetingIds = [...new Set(matches.map(match => match.meetingId))].slice(0, MAX_SEARCH_MEETINGS_TO_HYDRATE);
  const meetingEntries = await Promise.all(uniqueMeetingIds.map(async meetingId => [meetingId, await getMeeting(meetingId)]));
  const meetingsById = new Map(meetingEntries.filter(([, meeting]) => meeting).map(([meetingId, meeting]) => [meetingId, meeting]));
  return matches
    .filter(match => meetingsById.has(match.meetingId))
    .map(match => ({ ...match, meeting: meetingsById.get(match.meetingId) }))
    .slice(0, Math.min(Math.max(Number(resultLimit) || 40, 1), 100));
}

export async function listMeetingFollowUpItems(pageSize = 100) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 100, 1), 200);
  const snapshot = await getDocs(query(
    collection(db, 'meetingItems'),
    where('status', 'in', ['not-started', 'in-progress', 'completed', 'deferred']),
    limit(safePageSize)
  ));
  const today = getLocalGregorianDate();
  return snapshot.docs
    .map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }))
    .map(item => ({ ...item, isOverdue: Boolean(item.deadlineDate && item.deadlineDate < today && item.status !== 'completed') }))
    .sort((first, second) => {
      if (first.isOverdue !== second.isOverdue) return first.isOverdue ? -1 : 1;
      return String(first.deadlineDate || first.plannedDate || '9999-12-31').localeCompare(String(second.deadlineDate || second.plannedDate || '9999-12-31'));
    });
}

export async function updateMeeting(meetingId, changes, actorName) {
  const updates = {};
  if (Object.hasOwn(changes, 'title')) updates.title = assertRequiredText(changes.title, 'عنوان الاجتماع');
  if (Object.hasOwn(changes, 'meetingDate')) {
    updates.meetingDate = assertGregorianDate(changes.meetingDate, 'تاريخ الاجتماع');
    updates.monthKey = updates.meetingDate.slice(0, 7);
  }
  if (Object.hasOwn(changes, 'meetingTime')) updates.meetingTime = String(changes.meetingTime || '').trim();
  if (Object.hasOwn(changes, 'location')) updates.location = String(changes.location || '').trim();
  if (Object.hasOwn(changes, 'description')) updates.description = String(changes.description || '').trim();
  if (Object.hasOwn(changes, 'status')) updates.status = assertOptionalChoice(changes.status, MEETING_STATUSES, 'حالة الاجتماع');
  if (Object.hasOwn(changes, 'title') || Object.hasOwn(changes, 'description')) {
    const currentMeeting = await getMeeting(meetingId);
    if (!currentMeeting) throw new Error('الاجتماع غير موجود');
    updates.searchTokens = normalizeMeetingSearchTokens(
      updates.title ?? currentMeeting.title,
      updates.description ?? currentMeeting.description
    );
  }
  if (!Object.keys(updates).length) return;
  updates.updatedAt = serverTimestamp();
  updates.updatedBy = getActor(actorName);
  await updateDoc(doc(db, 'meetings', meetingId), updates);
}

export async function createMeetingItem(meetingId, input, actorName) {
  const title = assertRequiredText(input.title, 'عنوان النقطة');
  const type = assertOptionalChoice(input.type, MEETING_ITEM_TYPES, 'نوع النقطة', 'discussion');
  const status = assertOptionalChoice(input.status, MEETING_ITEM_STATUSES, 'حالة النقطة', 'not-started');
  const plannedDate = input.plannedDate ? assertGregorianDate(input.plannedDate, 'موعد التنفيذ') : '';
  const deadlineDate = input.deadlineDate ? assertGregorianDate(input.deadlineDate, 'آخر موعد للتنفيذ') : '';
  const meeting = await getMeeting(meetingId);
  if (!meeting) throw new Error('الاجتماع غير موجود');
  const actor = getActor(actorName);
  const itemData = {
    meetingId,
    title,
    details: String(input.details || '').trim(),
    type,
    status,
    assignedTo: String(input.assignedTo || '').trim(),
    plannedDate,
    deadlineDate,
    extraNotes: String(input.extraNotes || '').trim(),
    searchTokens: normalizeMeetingSearchTokens(title, input.details),
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  };
  const itemRef = await addDoc(collection(db, 'meetingItems'), itemData);
  await refreshMeetingSummary(meetingId);
  return { id: itemRef.id, ...itemData };
}

export async function getMeetingItem(itemId) {
  const itemSnapshot = await getDoc(doc(db, 'meetingItems', itemId));
  return itemSnapshot.exists() ? { id: itemSnapshot.id, ...itemSnapshot.data() } : null;
}

export async function listMeetingItems(meetingId, pageSize = MAX_ITEMS_PER_MEETING) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || MAX_ITEMS_PER_MEETING, 1), MAX_ITEMS_PER_MEETING);
  const snapshot = await getDocs(query(
    collection(db, 'meetingItems'),
    where('meetingId', '==', meetingId),
    limit(safePageSize)
  ));
  return snapshot.docs
    .map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }))
    .sort((first, second) => String(first.createdAt?.toMillis?.() || '').localeCompare(String(second.createdAt?.toMillis?.() || '')));
}

async function refreshMeetingSummary(meetingId) {
  try {
    const snapshot = await getDocs(query(collection(db, 'meetingItems'), where('meetingId', '==', meetingId)));
    const items = snapshot.docs.map(itemDoc => itemDoc.data());
    const today = getLocalGregorianDate();
    const dueDates = items
      .filter(item => item.status !== 'completed' && item.status !== 'cancelled')
      .flatMap(item => [item.plannedDate, item.deadlineDate])
      .filter(date => date && date >= today)
      .sort();

    await updateDoc(doc(db, 'meetings', meetingId), {
      itemCount: items.length,
      completedItemCount: items.filter(item => item.status === 'completed').length,
      inProgressItemCount: items.filter(item => item.status === 'in-progress').length,
      nextDueDate: dueDates[0] || null
    });
  } catch (error) {
    console.error('Unable to refresh meeting summary:', error);
  }
}

export async function listMeetingItemsByStatus(status, pageSize = 100) {
  const validStatus = assertOptionalChoice(status, MEETING_ITEM_STATUSES, 'حالة النقطة');
  const safePageSize = Math.min(Math.max(Number(pageSize) || 100, 1), 200);
  const snapshot = await getDocs(query(
    collection(db, 'meetingItems'),
    where('status', '==', validStatus),
    limit(safePageSize)
  ));
  return snapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }));
}

export async function updateMeetingItem(itemId, changes, actorName) {
  const currentItem = await getMeetingItem(itemId);
  if (!currentItem) throw new Error('نقطة الاجتماع غير موجودة');
  const updates = {};
  if (Object.hasOwn(changes, 'title')) updates.title = assertRequiredText(changes.title, 'عنوان النقطة');
  if (Object.hasOwn(changes, 'details')) updates.details = String(changes.details || '').trim();
  if (Object.hasOwn(changes, 'type')) updates.type = assertOptionalChoice(changes.type, MEETING_ITEM_TYPES, 'نوع النقطة');
  if (Object.hasOwn(changes, 'status')) updates.status = assertOptionalChoice(changes.status, MEETING_ITEM_STATUSES, 'حالة النقطة');
  if (Object.hasOwn(changes, 'assignedTo')) updates.assignedTo = String(changes.assignedTo || '').trim();
  if (Object.hasOwn(changes, 'plannedDate')) updates.plannedDate = changes.plannedDate ? assertGregorianDate(changes.plannedDate, 'موعد التنفيذ') : '';
  if (Object.hasOwn(changes, 'deadlineDate')) updates.deadlineDate = changes.deadlineDate ? assertGregorianDate(changes.deadlineDate, 'آخر موعد للتنفيذ') : '';
  if (Object.hasOwn(changes, 'extraNotes')) updates.extraNotes = String(changes.extraNotes || '').trim();

  if (Object.hasOwn(changes, 'title') || Object.hasOwn(changes, 'details')) {
    updates.searchTokens = normalizeMeetingSearchTokens(
      updates.title ?? currentItem.title,
      updates.details ?? currentItem.details
    );
  }
  if (!Object.keys(updates).length) return;
  updates.updatedAt = serverTimestamp();
  updates.updatedBy = getActor(actorName);
  await updateDoc(doc(db, 'meetingItems', itemId), updates);
  await refreshMeetingSummary(currentItem.meetingId);
}

export async function addMeetingItemNote(itemId, input, actorName) {
  const text = assertRequiredText(input.text, 'نص الملاحظة');
  const noteDate = input.noteDate ? assertGregorianDate(input.noteDate, 'تاريخ الملاحظة') : getLocalGregorianDate();
  const item = await getMeetingItem(itemId);
  if (!item) throw new Error('نقطة الاجتماع غير موجودة');
  const actor = getActor(actorName);
  const noteData = {
    meetingId: item.meetingId,
    itemId,
    text,
    noteDate,
    searchTokens: normalizeMeetingSearchTokens(text),
    createdAt: serverTimestamp(),
    createdBy: actor
  };
  const noteRef = await addDoc(collection(db, 'meetingItems', itemId, 'notes'), noteData);
  return { id: noteRef.id, ...noteData };
}

export async function listMeetingItemNotes(itemId, pageSize = MAX_NOTES_PER_ITEM) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || MAX_NOTES_PER_ITEM, 1), MAX_NOTES_PER_ITEM);
  const snapshot = await getDocs(query(collection(db, 'meetingItems', itemId, 'notes'), limit(safePageSize)));
  return snapshot.docs
    .map(noteDoc => ({ id: noteDoc.id, ...noteDoc.data() }))
    .sort((first, second) => String(first.createdAt?.toMillis?.() || '').localeCompare(String(second.createdAt?.toMillis?.() || '')));
}

async function deleteCollectionDocuments(collectionRef) {
  while (true) {
    const snapshot = await getDocs(query(collectionRef, limit(DELETE_BATCH_SIZE)));
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach(documentSnapshot => batch.delete(documentSnapshot.ref));
    await batch.commit();
    if (snapshot.size < DELETE_BATCH_SIZE) return;
  }
}

export async function deleteMeetingItem(itemId) {
  const item = await getMeetingItem(itemId);
  const itemRef = doc(db, 'meetingItems', itemId);
  await deleteCollectionDocuments(collection(db, 'meetingItems', itemId, 'notes'));
  await deleteDoc(itemRef);
  if (item) await refreshMeetingSummary(item.meetingId);
}

export async function deleteMeeting(meetingId) {
  const itemsRef = collection(db, 'meetingItems');
  while (true) {
    const snapshot = await getDocs(query(itemsRef, where('meetingId', '==', meetingId), limit(100)));
    if (snapshot.empty) break;
    for (const itemSnapshot of snapshot.docs) {
      await deleteCollectionDocuments(collection(db, 'meetingItems', itemSnapshot.id, 'notes'));
    }
    const batch = writeBatch(db);
    snapshot.docs.forEach(itemSnapshot => batch.delete(itemSnapshot.ref));
    await batch.commit();
    if (snapshot.size < 100) break;
  }
  await deleteDoc(doc(db, 'meetings', meetingId));
}