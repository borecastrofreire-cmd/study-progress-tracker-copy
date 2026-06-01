import axios from 'axios';
import type { NodeRaw, Status, Subject, SubjectColor, Task, Topic } from '../types/study';

const PROJECT_ID = '3SkaV97RjbW7Yt1f';
const BASE = `/api/taskade/projects/${PROJECT_ID}/nodes`;

const DEFAULT_COLORS: SubjectColor[] = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'pink'];
const DEFAULT_EMOJIS = ['📐', '📖', '⚛️', '🌍', '🧮', '🎨', '💡', '🔬'];

// ─── User-scoped data ──────────────────────────────────────────────────────────
//
// Architecture: The shared project stores data for ALL users.
// Each user's "root" is a special node whose text is "__user:{userId}__".
// Subject nodes are children of that user-root node.
// Topic nodes are children of subject nodes (as before).
//
// Hierarchy:  root-project
//               └─ __user:{userId}__   (userRoot node, parentId = null)
//                    └─ Subject A      (parentId = userRoot.id)
//                         └─ Topic 1  (parentId = Subject.id)
//
// This ensures complete isolation: each user only reads/writes their own subtree.

const USER_ROOT_PREFIX = '__user:';

function makeUserRootText(userId: string) {
  return `${USER_ROOT_PREFIX}${userId}__`;
}

function isUserRoot(node: NodeRaw, userId: string) {
  // parentId can be null or undefined for root-level nodes depending on the API response
  const isRoot = node.parentId === null || node.parentId === undefined;
  return isRoot && node.fieldValues['/text'] === makeUserRootText(userId);
}

/** Ensure the user-root node exists; return its id. */
async function ensureUserRoot(userId: string): Promise<string> {
  const res = await axios.get(BASE);
  const nodes: NodeRaw[] = res.data.payload.nodes;
  const existing = nodes.find((n) => isUserRoot(n, userId));
  if (existing) return existing.id;

  // Create it — only send supported fields (no custom @sub fields on root)
  const created = await axios.post(BASE, {
    '/text': makeUserRootText(userId),
  });
  return created.data?.payload?.node?.id ?? '';
}

/** Parse metadata stored as JSON in the note field.
 *  Format: {"color":"blue","emoji":"📖","order":3}
 *  Falls back to defaults if missing or malformed. */
function parseSubjectMeta(note: string | undefined, idx: number): { color: SubjectColor; emoji: string; order: number } {
  if (note) {
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === 'object') {
        return {
          color: (parsed.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]) as SubjectColor,
          emoji: parsed.emoji ?? DEFAULT_EMOJIS[idx % DEFAULT_EMOJIS.length],
          order: typeof parsed.order === 'number' ? parsed.order : idx,
        };
      }
    } catch {
      // malformed JSON — fall through to defaults
    }
  }
  return {
    color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    emoji: DEFAULT_EMOJIS[idx % DEFAULT_EMOJIS.length],
    order: idx,
  };
}

function buildSubjectMeta(color: SubjectColor, emoji: string, order: number): string {
  return JSON.stringify({ color, emoji, order });
}

export async function fetchNodes(userId: string): Promise<{ subjects: Subject[] }> {
  const res = await axios.get(BASE);
  const nodes: NodeRaw[] = res.data.payload.nodes;

  // Find this user's root node
  const userRoot = nodes.find((n) => isUserRoot(n, userId));
  if (!userRoot) return { subjects: [] };

  // Subject nodes = direct children of userRoot
  const subjectNodes = nodes.filter((n) => n.parentId === userRoot.id);
  const subjectIds = new Set(subjectNodes.map((s) => s.id));

  // Topic nodes = children of any subject
  const topicNodes = nodes.filter((n) => n.parentId != null && subjectIds.has(n.parentId));

  const subjects: Subject[] = subjectNodes.map((s, idx) => {
    const topics: Topic[] = topicNodes
      .filter((c) => c.parentId === s.id)
      .map((c) => ({
        id: c.id,
        text: c.fieldValues['/text'] ?? '',
        subject: c.fieldValues['/attributes/@sub01'] ?? '',
        startPage: c.fieldValues['/attributes/@sub02'] ?? 0,
        totalPages: c.fieldValues['/attributes/@sub03'] ?? 0,
        currentPage: c.fieldValues['/attributes/@sub04'] ?? 0,
        estimatedMinutes: c.fieldValues['/attributes/@sub06'] ?? 0,
        status: (c.fieldValues['/attributes/@sub05'] ?? 'opt-pending') as Status,
        parentId: c.parentId,
      }));

    // Metadata (color, emoji, order) stored as JSON in the note field
    const meta = parseSubjectMeta(s.fieldValues['/attributes/note'], idx);

    return {
      id: s.id,
      text: s.fieldValues['/text'] ?? '',
      status: (s.fieldValues['/attributes/@sub05'] ?? 'opt-pending') as Status,
      color: meta.color,
      emoji: meta.emoji,
      order: meta.order,
      topics,
    };
  });

  // Sort by persisted server-side order
  subjects.sort((a, b) => a.order - b.order);

  return { subjects };
}

export async function updateTopic(
  nodeId: string,
  data: {
    currentPage?: number;
    status?: Status;
    text?: string;
    totalPages?: number;
    startPage?: number;
    subject?: string;
    estimatedMinutes?: number;
  }
) {
  const body: Record<string, unknown> = {};
  if (data.currentPage !== undefined) body['/attributes/@sub04'] = data.currentPage;
  if (data.status !== undefined) body['/attributes/@sub05'] = data.status;
  if (data.text !== undefined) body['/text'] = data.text;
  if (data.totalPages !== undefined) body['/attributes/@sub03'] = data.totalPages;
  if (data.startPage !== undefined) body['/attributes/@sub02'] = data.startPage;
  if (data.subject !== undefined) body['/attributes/@sub01'] = data.subject;
  if (data.estimatedMinutes !== undefined) body['/attributes/@sub06'] = data.estimatedMinutes;

  await axios.patch(`${BASE}/${nodeId}`, body);
}

export async function createSubject(
  userId: string,
  name: string,
  color?: SubjectColor,
  emoji?: string
): Promise<string> {
  const userRootId = await ensureUserRoot(userId);

  // Compute next order based on existing subjects
  const resNodes = await axios.get(BASE);
  const nodes: NodeRaw[] = resNodes.data.payload.nodes;
  const userRoot = nodes.find((n) => isUserRoot(n, userId));
  const existingSubjects = nodes.filter((n) => n.parentId === userRoot?.id);
  const maxOrder = existingSubjects.reduce((max, s) => {
    const meta = parseSubjectMeta(s.fieldValues['/attributes/note'], 0);
    return Math.max(max, meta.order);
  }, -1);
  const nextOrder = maxOrder + 1;

  const body: Record<string, unknown> = {
    parentId: userRootId,
    '/text': name,
    '/attributes/@sub05': 'opt-pending',
    '/attributes/note': buildSubjectMeta(
      color ?? 'blue',
      emoji ?? '📖',
      nextOrder
    ),
  };

  const res = await axios.post(BASE, body);
  return res.data?.payload?.node?.id ?? '';
}

export async function updateSubjectAppearance(
  subjectId: string,
  color: SubjectColor,
  emoji: string,
  order?: number
): Promise<void> {
  // Store color + emoji + order as JSON in the note field
  await axios.patch(`${BASE}/${subjectId}`, {
    '/attributes/note': buildSubjectMeta(color, emoji, order ?? 0),
  });
}

/** Persist the order of subjects server-side so it syncs across devices. */
export async function saveSubjectOrderServer(subjects: { id: string; color: SubjectColor; emoji: string; order: number }[]): Promise<void> {
  await Promise.all(
    subjects.map((s) =>
      axios.patch(`${BASE}/${s.id}`, {
        '/attributes/note': buildSubjectMeta(s.color, s.emoji, s.order),
      })
    )
  );
}

export async function createTopic(
  parentId: string,
  data: {
    text: string;
    subject: string;
    startPage: number;
    totalPages: number;
    estimatedMinutes?: number;
  }
): Promise<void> {
  await axios.post(BASE, {
    parentId,
    '/text': data.text,
    '/attributes/@sub01': data.subject,
    '/attributes/@sub02': data.startPage,
    '/attributes/@sub03': data.totalPages,
    '/attributes/@sub04': 0,
    '/attributes/@sub05': 'opt-pending',
    '/attributes/@sub06': data.estimatedMinutes ?? 0,
  });
}

export async function deleteNode(nodeId: string): Promise<void> {
  await axios.delete(`${BASE}/${nodeId}`);
}

export async function updateSubjectStatus(subjectId: string, status: Status) {
  await axios.patch(`${BASE}/${subjectId}`, {
    '/attributes/@sub05': status,
  });
}

// ─── List all registered users + Share Invitations ────────────────────────────
const AUTH_PROJECT_BASE = `/api/taskade/projects/BPZCZdop7dsZtmxH/nodes`;
const AUTH_PREFIX = '__auth:';
const INV_PREFIX = '__inv:';

export async function fetchAllUsers(): Promise<string[]> {
  const res = await axios.get(AUTH_PROJECT_BASE);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];
  return nodes
    .map((n) => n.fieldValues['/text'] ?? '')
    .filter((t) => t.startsWith(AUTH_PREFIX) && t.endsWith('__'))
    .map((t) => t.slice(AUTH_PREFIX.length, -2)); // extract username
}

// ─── Share Invitations ────────────────────────────────────────────────────────
//
// Invitations are stored as root-level nodes in the Usuarios project.
// /text   = "__inv:{fromUser}__{toUser}__{timestamp}"   (unique marker)
// /attributes/note = JSON payload:
//   { fromUser: string, toUser: string, subjects: Subject[], status: 'pending'|'accepted'|'rejected' }
//
// This allows any logged-in user to read all invitation nodes and filter by toUser.

export interface ShareInvitation {
  nodeId: string;
  fromUser: string;
  toUser: string;
  subjects: Subject[];
  status: 'pending' | 'accepted' | 'rejected';
}

export async function sendShareInvitation(
  fromUser: string,
  toUser: string,
  subjects: Subject[]
): Promise<void> {
  const payload = {
    fromUser,
    toUser: toUser.toLowerCase(),
    subjects,
    status: 'pending' as const,
  };

  const marker = `${INV_PREFIX}${fromUser}__${toUser.toLowerCase()}__${Date.now()}`;

  await axios.post(AUTH_PROJECT_BASE, {
    '/text': marker,
    '/attributes/note': JSON.stringify(payload),
  });
}

export async function fetchPendingInvitations(toUser: string): Promise<ShareInvitation[]> {
  const res = await axios.get(AUTH_PROJECT_BASE);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];

  const invitations: ShareInvitation[] = [];

  for (const node of nodes) {
    const text = node.fieldValues['/text'] ?? '';
    if (!text.startsWith(INV_PREFIX)) continue;

    const note = node.fieldValues['/attributes/note'];
    if (!note) continue;

    try {
      const data = JSON.parse(note) as {
        fromUser: string;
        toUser: string;
        subjects: Subject[];
        status: string;
      };

      if (
        data.toUser?.toLowerCase() === toUser.toLowerCase() &&
        data.status === 'pending'
      ) {
        invitations.push({
          nodeId: node.id,
          fromUser: data.fromUser,
          toUser: data.toUser,
          subjects: data.subjects ?? [],
          status: 'pending',
        });
      }
    } catch {
      // malformed — skip
    }
  }

  return invitations;
}

export async function acceptInvitation(invitation: ShareInvitation): Promise<void> {
  // 1. Import the subjects into the recipient's tree
  await importSubjects(invitation.toUser, invitation.subjects);

  // 2. Mark invitation as accepted
  const updatedNote = JSON.stringify({
    fromUser: invitation.fromUser,
    toUser: invitation.toUser,
    subjects: invitation.subjects,
    status: 'accepted',
  });
  await axios.patch(`${AUTH_PROJECT_BASE}/${invitation.nodeId}`, {
    '/attributes/note': updatedNote,
  });
}

export async function rejectInvitation(invitation: ShareInvitation): Promise<void> {
  const updatedNote = JSON.stringify({
    fromUser: invitation.fromUser,
    toUser: invitation.toUser,
    subjects: invitation.subjects,
    status: 'rejected',
  });
  await axios.patch(`${AUTH_PROJECT_BASE}/${invitation.nodeId}`, {
    '/attributes/note': updatedNote,
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
// Project: dbm6uSwyia6UYJa5
//
// Valid POST/PATCH fields (confirmed from OpenAPI schema):
//   parentId                 → parent node id (null = root)
//   /text                    → title
//   /attributes/@taskU       → userId string
//   /attributes/@taskD       → deadline ISO string
//   /attributes/@taskS       → 'opt-yes' | 'opt-no'
//
// Hierarchy strategy — encode node type in /text with prefixes:
//   "__TR__"          → user Task Root  (root-level node per user)
//   "__TG__:{name}"   → named Group     (child of task root)
//   "__TNG__"         → No-Group bucket (child of task root)
//   (anything else)   → Task            (child of group or nogroup)
//
// Using prefixed /text avoids any extra fields and works 100% with schema.
// All operations use a SINGLE initial GET to load state, then fire-and-forget POST.
// UI updates optimistically; background refresh syncs real IDs on fetchGroups.

const TASKS_PROJECT_ID = 'dbm6uSwyia6UYJa5';
const TASKS_BASE = `/api/taskade/projects/${TASKS_PROJECT_ID}/nodes`;

export const NOGROUP_ID = '__nogroup__';

const PFX_ROOT  = '__TR__';
const PFX_GROUP = '__TG__:';
const PFX_NG    = '__TNG__';

function isTaskRoot(text?: string) { return text === PFX_ROOT; }
function isGroup(text?: string)    { return text?.startsWith(PFX_GROUP) ?? false; }
function isNoGroup(text?: string)  { return text === PFX_NG; }
function isTask(text?: string)     { return !!text && !isTaskRoot(text) && !isGroup(text) && !isNoGroup(text); }
function groupName(text: string)   { return text.slice(PFX_GROUP.length); }

interface TNodeRaw {
  id: string;
  parentId: string | null;
  fieldValues: {
    '/text'?: string;
    '/attributes/@taskU'?: string;
    '/attributes/@taskD'?: string;
    '/attributes/@taskS'?: string;
  };
}

function isRootLevel(n: TNodeRaw) {
  return n.parentId === null || n.parentId === undefined;
}

type TTaskImport = import('../types/study').Task;
type TGroupImport = import('../types/study').TaskGroup;

function mapTask(t: TNodeRaw, gId: string): TTaskImport {
  return {
    id: t.id,
    text: t.fieldValues['/text'] ?? '',
    deadline: t.fieldValues['/attributes/@taskD'] || null,
    completed: t.fieldValues['/attributes/@taskS'] === 'opt-yes',
    groupId: gId,
  };
}

// Single shared GET — all helper functions work from this snapshot
async function getAllTaskNodes(): Promise<TNodeRaw[]> {
  const res = await axios.get(TASKS_BASE);
  return res.data?.payload?.nodes ?? [];
}

// ── Ensure helpers: use existing snapshot, POST only if missing ─────────────

async function ensureTaskRoot(userId: string, nodes: TNodeRaw[]): Promise<string> {
  const existing = nodes.find((n) => isRootLevel(n) && isTaskRoot(n.fieldValues['/text']) &&
    n.fieldValues['/attributes/@taskU'] === userId);
  if (existing) return existing.id;

  // Create and re-fetch once to get id
  await axios.post(TASKS_BASE, {
    '/text': PFX_ROOT,
    '/attributes/@taskU': userId,
  });
  const fresh = await getAllTaskNodes();
  const created = fresh.find((n) => isRootLevel(n) && isTaskRoot(n.fieldValues['/text']) &&
    n.fieldValues['/attributes/@taskU'] === userId);
  if (!created) throw new Error('task root not found after creation');
  return created.id;
}

async function ensureNGNode(rootId: string, nodes: TNodeRaw[]): Promise<string> {
  const existing = nodes.find((n) => n.parentId === rootId && isNoGroup(n.fieldValues['/text']));
  if (existing) return existing.id;

  await axios.post(TASKS_BASE, { parentId: rootId, '/text': PFX_NG });
  const fresh = await getAllTaskNodes();
  const created = fresh.find((n) => n.parentId === rootId && isNoGroup(n.fieldValues['/text']));
  if (!created) throw new Error('nogroup node not found after creation');
  return created.id;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchGroups(userId: string): Promise<TGroupImport[]> {
  const nodes = await getAllTaskNodes();

  const userRoot = nodes.find((n) => isRootLevel(n) && isTaskRoot(n.fieldValues['/text']) &&
    n.fieldValues['/attributes/@taskU'] === userId);
  if (!userRoot) return [];

  const groupNodes = nodes.filter((n) => n.parentId === userRoot.id && isGroup(n.fieldValues['/text']));
  const ngNode     = nodes.find((n) => n.parentId === userRoot.id && isNoGroup(n.fieldValues['/text']));

  const parentIds = new Set([...groupNodes.map((g) => g.id), ...(ngNode ? [ngNode.id] : [])]);
  const taskNodes = nodes.filter((n) => n.parentId != null && parentIds.has(n.parentId));

  const groups: TGroupImport[] = groupNodes.map((g) => ({
    id: g.id,
    name: groupName(g.fieldValues['/text'] ?? ''),
    tasks: taskNodes.filter((t) => t.parentId === g.id).map((t) => mapTask(t, g.id)),
  }));

  const ungrouped = ngNode
    ? taskNodes.filter((t) => t.parentId === ngNode.id).map((t) => mapTask(t, NOGROUP_ID))
    : [];

  if (ungrouped.length > 0 || groups.length === 0) {
    groups.unshift({ id: NOGROUP_ID, name: 'Sin grupo', tasks: ungrouped });
  }

  return groups;
}

export async function createGroup(userId: string, name: string): Promise<TGroupImport> {
  // 1 GET to check/get root
  const nodes  = await getAllTaskNodes();
  const rootId = await ensureTaskRoot(userId, nodes);

  // 1 POST to create group
  await axios.post(TASKS_BASE, {
    parentId: rootId,
    '/text': `${PFX_GROUP}${name}`,
    '/attributes/@taskU': userId,
  });

  // 1 GET to get the real id
  const fresh = await getAllTaskNodes();
  const matches = fresh.filter((n) => n.parentId === rootId &&
    n.fieldValues['/text'] === `${PFX_GROUP}${name}`);
  const created = matches[matches.length - 1];
  return { id: created?.id ?? `grp-${Date.now()}`, name, tasks: [] };
}

export async function deleteGroup(groupId: string): Promise<void> {
  await axios.delete(`${TASKS_BASE}/${groupId}`);
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await axios.patch(`${TASKS_BASE}/${groupId}`, { '/text': `${PFX_GROUP}${name}` });
}

export async function createTask(
  userId: string,
  groupId: string,
  text: string,
  deadline: string | null,
): Promise<TTaskImport> {
  let parentId: string;

  if (groupId === NOGROUP_ID) {
    // Need the real root + ng node ids — 1 GET total
    const nodes  = await getAllTaskNodes();
    const rootId = await ensureTaskRoot(userId, nodes);
    parentId     = await ensureNGNode(rootId, nodes);
  } else {
    // groupId is already the real server id
    parentId = groupId;
  }

  // 1 POST — only valid schema fields
  await axios.post(TASKS_BASE, {
    parentId,
    '/text': text,
    '/attributes/@taskU': userId,
    '/attributes/@taskD': deadline ?? '',
    '/attributes/@taskS': 'opt-no',
  });

  // Return optimistic task — real id synced on next fetchGroups
  return { id: `tmp-${Date.now()}`, text, deadline, completed: false, groupId };
}

export async function toggleTask(taskId: string, completed: boolean): Promise<void> {
  await axios.patch(`${TASKS_BASE}/${taskId}`, {
    '/attributes/@taskS': completed ? 'opt-yes' : 'opt-no',
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await axios.delete(`${TASKS_BASE}/${taskId}`);
}

// ─── Import shared subjects ────────────────────────────────────────────────────
// Creates a copy of the given subjects under the target user's root.
// NOTE: The POST endpoint does not return the created node id, so we re-fetch
// all nodes after each subject creation and find it by matching text + parentId.
export async function importSubjects(
  targetUserId: string,
  subjects: Subject[]
): Promise<void> {
  const userId = targetUserId.toLowerCase();
  const userRootId = await ensureUserRoot(userId);

  for (const subject of subjects) {
    // 1. Create the subject node under the user root
    await axios.post(BASE, {
      parentId: userRootId,
      '/text': subject.text,
      '/attributes/@sub05': 'opt-pending',
      '/attributes/note': JSON.stringify({ color: subject.color, emoji: subject.emoji }),
    });

    // 2. Re-fetch all nodes to find the newly created subject by text + parent
    const refetch = await axios.get(BASE);
    const allNodes: NodeRaw[] = refetch.data?.payload?.nodes ?? [];
    const newSubjectNode = allNodes
      .filter((n) => n.parentId === userRootId && n.fieldValues['/text'] === subject.text)
      .pop(); // take last to get the most recently created one

    if (!newSubjectNode) continue;
    const newSubjectId = newSubjectNode.id;

    // 3. Create each topic under the new subject
    for (const topic of subject.topics) {
      await axios.post(BASE, {
        parentId: newSubjectId,
        '/text': topic.text,
        '/attributes/@sub01': topic.subject,
        '/attributes/@sub02': topic.startPage,
        '/attributes/@sub03': topic.totalPages,
        '/attributes/@sub04': 0,
        '/attributes/@sub05': 'opt-pending',
      });
    }
  }
}

// ─── Study Plans API ───────────────────────────────────────────────────────────

const PLANS_PROJECT_ID = 'dTss6bGQ2akufGNp';
const BLOCKS_PROJECT_ID = 'RgnaN3XsoGR9rSjB';
const PLANS_BASE = `/api/taskade/projects/${PLANS_PROJECT_ID}/nodes`;
const BLOCKS_BASE = `/api/taskade/projects/${BLOCKS_PROJECT_ID}/nodes`;

/** Get the root node id of a project (first node with parentId === null) */
async function getProjectRootId(baseUrl: string): Promise<string> {
  const res = await axios.get(baseUrl);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];
  const root = nodes.find((n) => n.parentId === null || n.parentId === undefined);
  return root?.id ?? '';
}

export interface StudyPlan {
  id: string;
  userId: string;
  subject: string;
  examDate: string;
  blockDurationMinutes: number;
  totalPages: number;
  pagesPerHour: number;
  startPage: number;
  status: 'opt-active' | 'opt-done' | 'opt-cancel';
}

export interface StudyBlock {
  id: string;
  userId: string;
  planId: string;
  date: string;
  startPage: number;
  endPage: number;
  status: 'opt-pending' | 'opt-done' | 'opt-missed';
}

// Convert YYYY-MM-DD or any date-ish string to ISO 8601 with timezone (date-time-ixdtf)
function toIsoDate(input: string): string {
  if (!input) return '';
  // Already an ISO with time
  if (/T\d{2}:\d{2}/.test(input)) return input;
  // Plain YYYY-MM-DD → set to noon UTC to avoid TZ shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T12:00:00.000Z`;
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.toISOString();
  return input;
}

function readDate(v: unknown): string {
  if (!v) return '';
  let raw = '';
  if (typeof v === 'string') raw = v;
  else if (typeof v === 'object' && v !== null) {
    const obj = v as { dateTime?: { date?: string }; date?: string };
    raw = obj.dateTime?.date ?? obj.date ?? '';
  }
  if (!raw) return '';
  // Normalize to YYYY-MM-DD for internal use
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

function readSelect(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null) {
    const obj = v as { optionId?: string };
    return obj.optionId ?? '';
  }
  return '';
}

function parsePlan(node: NodeRaw): StudyPlan {
  const fv = node.fieldValues;
  return {
    id: node.id,
    userId: (fv['/attributes/@planU'] as string) ?? '',
    subject: (fv['/attributes/@planS'] as string) ?? '',
    examDate: readDate(fv['/attributes/@planE']),
    blockDurationMinutes: Number(fv['/attributes/@planB'] ?? 60),
    totalPages: Number(fv['/attributes/@planP'] ?? 0),
    pagesPerHour: Number(fv['/attributes/@planR'] ?? 0),
    startPage: Number(fv['/attributes/@planI'] ?? 1),
    status: (readSelect(fv['/attributes/@planT']) || 'opt-active') as StudyPlan['status'],
  };
}

function parseBlock(node: NodeRaw): StudyBlock {
  const fv = node.fieldValues;
  return {
    id: node.id,
    userId: (fv['/attributes/@blokU'] as string) ?? '',
    planId: (fv['/attributes/@blokP'] as string) ?? '',
    date: readDate(fv['/attributes/@blokD']),
    startPage: Number(fv['/attributes/@blokS'] ?? 0),
    endPage: Number(fv['/attributes/@blokE'] ?? 0),
    status: (readSelect(fv['/attributes/@blokT']) || 'opt-pending') as StudyBlock['status'],
  };
}

export async function fetchStudyPlans(userId: string): Promise<StudyPlan[]> {
  const res = await axios.get(PLANS_BASE);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];
  return nodes
    .filter((n) => (n.fieldValues['/attributes/@planU'] as string) === userId)
    .map(parsePlan);
}

export async function fetchStudyBlocks(userId: string, planId?: string): Promise<StudyBlock[]> {
  const res = await axios.get(BLOCKS_BASE);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];
  return nodes
    .filter((n) => {
      const uid = (n.fieldValues['/attributes/@blokU'] as string) ?? '';
      const pid = (n.fieldValues['/attributes/@blokP'] as string) ?? '';
      if (planId) return uid === userId && pid === planId;
      return uid === userId;
    })
    .map(parseBlock);
}

export async function createStudyPlan(
  userId: string,
  plan: Omit<StudyPlan, 'id' | 'userId' | 'status'>
): Promise<StudyPlan> {
  const isoExam = toIsoDate(plan.examDate);
  await axios.post(PLANS_BASE, {
    '/text': `Plan: ${plan.subject}`,
    '/attributes/@planU': userId,
    '/attributes/@planS': plan.subject,
    '/attributes/@planE': isoExam,
    '/attributes/@planB': plan.blockDurationMinutes,
    '/attributes/@planP': plan.totalPages,
    '/attributes/@planR': plan.pagesPerHour,
    '/attributes/@planI': plan.startPage,
    '/attributes/@planT': 'opt-active',
  });
  // The POST does not return the created node, so refetch and find it
  const res = await axios.get(PLANS_BASE);
  const nodes: NodeRaw[] = res.data?.payload?.nodes ?? [];
  // Match by user + subject + examDate; pick the most recent (last in list) if multiple
  const matches = nodes.filter((n) => {
    const fv = n.fieldValues;
    return (
      fv['/attributes/@planU'] === userId &&
      fv['/attributes/@planS'] === plan.subject
    );
  });
  const created = matches[matches.length - 1];
  if (!created) throw new Error('No se pudo localizar el plan recién creado');
  return parsePlan(created);
}

export async function createStudyBlock(
  userId: string,
  block: Omit<StudyBlock, 'id' | 'userId' | 'status'>
): Promise<void> {
  await axios.post(BLOCKS_BASE, {
    '/text': `Bloque ${block.startPage}-${block.endPage}`,
    '/attributes/@blokU': userId,
    '/attributes/@blokP': block.planId,
    '/attributes/@blokD': toIsoDate(block.date),
    '/attributes/@blokS': block.startPage,
    '/attributes/@blokE': block.endPage,
    '/attributes/@blokT': 'opt-pending',
  });
}

export async function deleteStudyPlan(planId: string): Promise<void> {
  // Delete associated blocks first
  const blocksRes = await axios.get(BLOCKS_BASE);
  const blocks: NodeRaw[] = blocksRes.data?.payload?.nodes ?? [];
  const planBlocks = blocks.filter((n) => (n.fieldValues['/attributes/@blokP'] as string) === planId);
  for (const b of planBlocks) {
    await axios.delete(`${BLOCKS_BASE}/${b.id}`);
  }
  await axios.delete(`${PLANS_BASE}/${planId}`);
}

export async function toggleBlockStatus(
  blockId: string,
  status: StudyBlock['status']
): Promise<void> {
  await axios.patch(`${BLOCKS_BASE}/${blockId}`, {
    '/attributes/@blokT': status,
  });
}
