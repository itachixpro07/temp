// Local index of the case IDs this browser has created.
//
// WORKAROUND — server-v2 has no "list my cases" endpoint. GET /api/cases/queue
// is doctor/admin only, and GET /api/cases/:id needs an ID you already hold.
// So a patient's history is rebuilt by remembering IDs here and fetching each
// one by ID. Consequences: history does not follow the user to another device
// and is lost if site data is cleared. The case sheets themselves are always
// safe in MongoDB — only this local index is fragile.
//
// Replace this whole module with a single call once the backend grows a
// GET /api/cases/mine endpoint.

const key = (userId) => `sudhasetu.cases.${userId}`;

const read = (userId) => {
  try {
    const raw = localStorage.getItem(key(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const write = (userId, list) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(list));
  } catch {
    /* private mode / quota - history just won't persist */
  }
};

export const rememberCase = (userId, entry) => {
  if (!userId || !entry?.caseId) return;
  const list = read(userId).filter((c) => c.caseId !== entry.caseId);
  list.unshift({
    caseId: entry.caseId,
    dangerLevel: entry.dangerLevel,
    status: entry.status,
    savedAt: new Date().toISOString(),
  });
  write(userId, list.slice(0, 100));
};

export const listCases = (userId) => (userId ? read(userId) : []);

export const forgetCase = (userId, caseId) =>
  write(userId, read(userId).filter((c) => c.caseId !== caseId));

/* The most recent AI chat session, so a returning user can continue it.
   Same rationale: there is no endpoint listing a user's chat sessions. */
const chatKey = (userId) => `sudhasetu.chat.${userId}`;

export const rememberChat = (userId, chatId) => {
  if (!userId || !chatId) return;
  try {
    localStorage.setItem(chatKey(userId), chatId);
  } catch {
    /* ignore */
  }
};

export const lastChat = (userId) => {
  if (!userId) return null;
  try {
    return localStorage.getItem(chatKey(userId));
  } catch {
    return null;
  }
};

export const clearChat = (userId) => {
  try {
    localStorage.removeItem(chatKey(userId));
  } catch {
    /* ignore */
  }
};
