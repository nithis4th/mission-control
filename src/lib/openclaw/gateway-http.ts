/**
 * OpenClaw Gateway HTTP Client
 *
 * Replaces the WebSocket-based client with simple HTTP fetch() calls.
 * Uses two Gateway endpoints:
 *   - POST /tools/invoke — for tool calls (sessions_list, agents_list, etc.)
 *   - POST /v1/chat/completions — for sending messages & getting responses
 */

// Derive HTTP base URL from the WS URL in env
function getHttpBaseUrl(): string {
  const raw = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
  return raw.replace(/^ws(s?):\/\//, 'http$1://');
}

const GATEWAY_TOKEN = () => process.env.OPENCLAW_GATEWAY_TOKEN || '';

/** Shared headers for all Gateway HTTP requests */
function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GATEWAY_TOKEN()}`,
  };
}

// ── /tools/invoke helper ────────────────────────────────────────────

interface ToolInvokeResult<T = unknown> {
  ok: boolean;
  result?: {
    content?: Array<{ type: string; text: string }>;
    details?: T;
  };
  error?: { type: string; message: string };
}

/**
 * Call a Gateway tool via the always-enabled /tools/invoke endpoint.
 */
export async function invokeTool<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  action?: string,
): Promise<T> {
  const url = `${getHttpBaseUrl()}/tools/invoke`;
  const body: Record<string, unknown> = { tool, args };
  if (action) body.action = action;

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway /tools/invoke ${tool} failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as ToolInvokeResult<T>;
  if (!data.ok) {
    throw new Error(
      `Gateway tool ${tool} error: ${data.error?.message || 'unknown'}`,
    );
  }

  // The result shape from /tools/invoke is { ok, result: { content, details } }
  // details contains the structured data, content contains the text representation
  return (data.result?.details ?? data.result) as T;
}

// ── Gateway session types ───────────────────────────────────────────

export interface GatewaySession {
  key: string;
  kind?: string;
  channel?: string;
  displayName?: string;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  updatedAt?: number;
  sessionId?: string;
  transcriptPath?: string;
  lastChannel?: string;
  [k: string]: unknown;
}

interface SessionsListResult {
  count: number;
  sessions: GatewaySession[];
}

// ── Public API ──────────────────────────────────────────────────────

/** List all active Gateway sessions */
export async function listSessions(): Promise<GatewaySession[]> {
  const data = await invokeTool<SessionsListResult>('sessions_list', {}, 'json');
  return data.sessions ?? [];
}

/** Get session history (assistant messages) */
export async function getSessionHistory(
  sessionKey: string,
): Promise<Array<{ role: string; content: unknown }>> {
  // sessions_history is available via tools/invoke
  try {
    const data = await invokeTool<{
      messages?: Array<{ role: string; content: unknown }>;
    }>('sessions_history', { sessionKey, limit: 50 });
    return data.messages ?? [];
  } catch {
    // Fallback: try sessions_get
    try {
      const data = await invokeTool<{
        messages?: Array<{ role: string; content: unknown }>;
      }>('sessions_get', { sessionKey, format: 'messages' });
      return data.messages ?? [];
    } catch {
      return [];
    }
  }
}

/** List agents configured in the Gateway */
export async function listAgents(): Promise<
  Array<{ id: string; name?: string; label?: string; model?: string; [k: string]: unknown }>
> {
  try {
    const data = await invokeTool<{
      agents?: Array<{ id: string; name?: string; [k: string]: unknown }>;
    }>('agents_list', {});
    // agents_list may return { requester, allowAny, agents: [...] }
    if (data && Array.isArray((data as Record<string, unknown>).agents)) {
      return (data as Record<string, unknown>).agents as Array<{
        id: string;
        name?: string;
        label?: string;
        model?: string;
        [k: string]: unknown;
      }>;
    }
    if (Array.isArray(data)) return data as Array<{ id: string; [k: string]: unknown }>;
    return [];
  } catch {
    return [];
  }
}

/**
 * Send a message to an agent via /v1/chat/completions.
 *
 * sessions_send is denied via /tools/invoke, so we use the
 * OpenAI-compatible chat completions endpoint instead.
 *
 * @param agentId - Gateway agent ID (e.g. "main", "dexter")
 * @param message - User message
 * @param sessionUser - Optional user identifier for stable session routing
 * @returns The assistant's response text
 */
export async function chatCompletions(
  agentId: string,
  message: string,
  sessionUser?: string,
): Promise<string> {
  const url = `${getHttpBaseUrl()}/v1/chat/completions`;
  const body: Record<string, unknown> = {
    model: `openclaw:${agentId}`,
    messages: [{ role: 'user', content: message }],
  };
  if (sessionUser) body.user = sessionUser;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'x-openclaw-agent-id': agentId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway /v1/chat/completions failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Send a message to a specific session key via /v1/chat/completions.
 *
 * Uses x-openclaw-session-key header for direct session targeting.
 */
export async function sendToSession(
  sessionKey: string,
  message: string,
): Promise<string> {
  const url = `${getHttpBaseUrl()}/v1/chat/completions`;
  const body = {
    model: 'openclaw',
    messages: [{ role: 'user', content: message }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'x-openclaw-session-key': sessionKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway sendToSession failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Generic RPC-like call via /tools/invoke.
 * Maps the old client.call(method, params) pattern.
 */
export async function call<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  // Map known RPC methods to tool invocations
  switch (method) {
    case 'sessions.list':
      return listSessions() as unknown as T;

    case 'chat.history': {
      const sessionKey = params?.sessionKey as string;
      if (!sessionKey) throw new Error('sessionKey required for chat.history');
      const messages = await getSessionHistory(sessionKey);
      return { messages } as unknown as T;
    }

    case 'chat.send': {
      const sessionKey = params?.sessionKey as string;
      const message = params?.message as string;
      if (!sessionKey || !message) throw new Error('sessionKey and message required for chat.send');
      await sendToSession(sessionKey, message);
      return undefined as unknown as T;
    }

    case 'agents.list':
      return listAgents() as unknown as T;

    case 'sessions.usage':
      return invokeTool<T>('sessions_usage', {});

    case 'sessions.create': {
      // sessions_spawn is denied, use a placeholder
      throw new Error('sessions.create not available via HTTP tools/invoke');
    }

    case 'node.list':
      return invokeTool<T>('nodes_list', {});

    case 'node.describe': {
      const nodeId = params?.node_id as string;
      return invokeTool<T>('nodes_describe', { node: nodeId });
    }

    default:
      // Try as a generic tool invocation
      return invokeTool<T>(method.replace('.', '_'), params ?? {});
  }
}
