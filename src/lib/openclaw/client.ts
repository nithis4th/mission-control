/**
 * OpenClaw Gateway Client — HTTP-based
 *
 * Drop-in replacement for the old WebSocket client.
 * All methods now use simple HTTP fetch() calls to the Gateway REST API.
 * See gateway-http.ts for the low-level implementation.
 */

import * as gateway from './gateway-http';
import type { OpenClawSessionInfo } from '../types';

export class OpenClawClient {
  /**
   * No-op — HTTP is stateless, no persistent connection needed.
   */
  async connect(): Promise<void> {
    // Verify connectivity with a lightweight call
    await gateway.listSessions();
  }

  /**
   * Always true for HTTP — each request is independent.
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * No-op — nothing to disconnect.
   */
  disconnect(): void {
    // nothing to do
  }

  /**
   * No-op — no reconnection logic needed for HTTP.
   */
  setAutoReconnect(_enabled: boolean): void {
    // nothing to do
  }

  // ── Session management ────────────────────────────────────────────

  async listSessions(): Promise<OpenClawSessionInfo[]> {
    const sessions = await gateway.listSessions();
    return sessions as unknown as OpenClawSessionInfo[];
  }

  async getSessionHistory(sessionKey: string): Promise<unknown[]> {
    return gateway.getSessionHistory(sessionKey);
  }

  async sendMessage(sessionKey: string, message: string): Promise<void> {
    await gateway.sendToSession(sessionKey, message);
  }

  async getSessionsUsage(): Promise<unknown> {
    return gateway.call('sessions.usage');
  }

  async createSession(
    _channel: string,
    _peer?: string,
  ): Promise<OpenClawSessionInfo> {
    throw new Error(
      'createSession is not available via HTTP. Sessions are created automatically when messages are sent.',
    );
  }

  // ── Agent methods ─────────────────────────────────────────────────

  async listAgents(): Promise<unknown[]> {
    return gateway.listAgents();
  }

  // ── Node methods ──────────────────────────────────────────────────

  async listNodes(): Promise<unknown[]> {
    return gateway.call<unknown[]>('node.list');
  }

  async describeNode(nodeId: string): Promise<unknown> {
    return gateway.call('node.describe', { node_id: nodeId });
  }

  // ── Generic RPC ───────────────────────────────────────────────────

  async call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return gateway.call<T>(method, params);
  }
}

// ── Singleton ─────────────────────────────────────────────────────

let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient();
  }
  return clientInstance;
}
