import { getSessionHistory } from './openclaw/gateway-http';

// Maximum input length for extractJSON to prevent ReDoS attacks
const MAX_EXTRACT_JSON_LENGTH = 1_000_000; // 1MB

/**
 * Extract JSON from a response that might have markdown code blocks or surrounding text.
 */
export function extractJSON(text: string): object | null {
  if (text.length > MAX_EXTRACT_JSON_LENGTH) {
    console.warn(
      '[Planning Utils] Input exceeds maximum length for JSON extraction:',
      text.length,
    );
    return null;
  }

  // First, try direct parse
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to other methods
  }

  // Try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // Try to find JSON object in the text
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Get assistant messages from OpenClaw API for a given session.
 * Uses HTTP /tools/invoke instead of WebSocket.
 */
export async function getMessagesFromOpenClaw(
  sessionKey: string,
): Promise<Array<{ role: string; content: string }>> {
  try {
    const history = await getSessionHistory(sessionKey);

    const messages: Array<{ role: string; content: string }> = [];

    for (const msg of history) {
      const m = msg as Record<string, unknown>;
      if (m.role === 'assistant') {
        let textContent = '';

        if (typeof m.content === 'string') {
          textContent = m.content;
        } else if (Array.isArray(m.content)) {
          const textBlock = (m.content as Array<Record<string, unknown>>).find(
            (c) => c.type === 'text',
          );
          if (textBlock?.text && typeof textBlock.text === 'string') {
            textContent = textBlock.text;
          }
        }

        if (textContent.trim().length > 0) {
          messages.push({ role: 'assistant', content: textContent });
        }
      }
    }

    return messages;
  } catch (err) {
    console.error('[Planning Utils] Failed to get messages from OpenClaw:', err);
    return [];
  }
}
