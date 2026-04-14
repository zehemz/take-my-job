import type { APIRequestContext } from '@playwright/test';
import type {
  ApiBoardSummary,
  ApiBoardDetail,
  ApiCard,
  CreateCardRequest,
  UpdateCardRequest,
  MoveCardRequest,
} from '../../lib/api-types';

/**
 * Typed API client for E2E tests.
 * Wraps Playwright's APIRequestContext with Kobani's API contract.
 *
 * Usage:
 *   const api = new KobaniApi(request, cookieHeader);
 *   const boards = await api.getBoards();
 */
export class KobaniApi {
  constructor(
    private readonly req: APIRequestContext,
    private readonly cookieHeader: string,
  ) {}

  private headers() {
    return { Cookie: this.cookieHeader, 'Content-Type': 'application/json' };
  }

  async getBoards(): Promise<ApiBoardSummary[]> {
    const res = await this.req.get('/api/boards', { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/boards → ${res.status()}`);
    return res.json();
  }

  async getBoard(id: string): Promise<ApiBoardDetail> {
    const res = await this.req.get(`/api/boards/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/boards/${id} → ${res.status()}`);
    return res.json();
  }

  async createCard(boardId: string, data: CreateCardRequest): Promise<ApiCard> {
    const res = await this.req.post(`/api/boards/${boardId}/cards`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`POST /api/boards/${boardId}/cards → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async getCard(id: string): Promise<ApiCard> {
    const res = await this.req.get(`/api/cards/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/cards/${id} → ${res.status()}`);
    return res.json();
  }

  async updateCard(id: string, data: UpdateCardRequest): Promise<ApiCard> {
    const res = await this.req.patch(`/api/cards/${id}`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`PATCH /api/cards/${id} → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async moveCard(id: string, data: MoveCardRequest): Promise<ApiCard> {
    const res = await this.req.post(`/api/cards/${id}/move`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`POST /api/cards/${id}/move → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async deleteCard(id: string): Promise<void> {
    const res = await this.req.delete(`/api/cards/${id}`, { headers: this.headers() });
    if (res.status() !== 204) throw new Error(`DELETE /api/cards/${id} → ${res.status()}`);
  }

  async createBoard(data: { name: string; workspacePath?: string }): Promise<ApiBoardSummary> {
    const res = await this.req.post('/api/boards', { headers: this.headers(), data });
    if (!res.ok()) throw new Error(`POST /api/boards → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async deleteBoard(id: string): Promise<void> {
    const res = await this.req.delete(`/api/boards/${id}`, { headers: this.headers() });
    if (res.status() !== 204) throw new Error(`DELETE /api/boards/${id} → ${res.status()}`);
  }

  // ─── Admin: Users ───────────────────────────────────────────────────────
  async getUsers(): Promise<any[]> {
    const res = await this.req.get('/api/admin/users', { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/admin/users → ${res.status()}`);
    return res.json();
  }

  async createUser(githubUsername: string): Promise<any> {
    const res = await this.req.post('/api/admin/users', {
      headers: this.headers(),
      data: { githubUsername },
    });
    if (!res.ok()) throw new Error(`POST /api/admin/users → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async updateUser(id: string, data: { isAdmin?: boolean }): Promise<any> {
    const res = await this.req.patch(`/api/admin/users/${id}`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`PATCH /api/admin/users/${id} → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async deleteUser(id: string): Promise<void> {
    const res = await this.req.delete(`/api/admin/users/${id}`, { headers: this.headers() });
    if (res.status() !== 204 && !res.ok()) throw new Error(`DELETE /api/admin/users/${id} → ${res.status()}`);
  }

  // ─── Admin: Groups ──────────────────────────────────────────────────────
  async getGroups(): Promise<any[]> {
    const res = await this.req.get('/api/admin/groups', { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/admin/groups → ${res.status()}`);
    return res.json();
  }

  async createGroup(data: { name: string; description?: string; agentRoles: string[]; environmentIds: string[] }): Promise<any> {
    const res = await this.req.post('/api/admin/groups', {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`POST /api/admin/groups → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async updateGroup(id: string, data: { name?: string; description?: string; agentRoles?: string[]; environmentIds?: string[] }): Promise<any> {
    const res = await this.req.patch(`/api/admin/groups/${id}`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`PATCH /api/admin/groups/${id} → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async deleteGroup(id: string): Promise<void> {
    const res = await this.req.delete(`/api/admin/groups/${id}`, { headers: this.headers() });
    if (res.status() !== 204 && !res.ok()) throw new Error(`DELETE /api/admin/groups/${id} → ${res.status()}`);
  }

  async addGroupMember(groupId: string, userId: string): Promise<void> {
    const res = await this.req.post(`/api/admin/groups/${groupId}/members`, {
      headers: this.headers(),
      data: { userId },
    });
    if (!res.ok()) throw new Error(`POST /api/admin/groups/${groupId}/members → ${res.status()}: ${await res.text()}`);
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const res = await this.req.delete(`/api/admin/groups/${groupId}/members/${userId}`, {
      headers: this.headers(),
    });
    if (res.status() !== 204 && !res.ok()) throw new Error(`DELETE /api/admin/groups/${groupId}/members/${userId} → ${res.status()}`);
  }

  // ─── Environments ──────────────────────────────────────────────────────────

  async getEnvironments(): Promise<any[]> {
    const res = await this.req.get('/api/environments', { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/environments → ${res.status()}`);
    return res.json();
  }

  async getEnvironment(id: string): Promise<any> {
    const res = await this.req.get(`/api/environments/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`GET /api/environments/${id} → ${res.status()}`);
    return res.json();
  }

  async createEnvironment(data: { name: string; description?: string }): Promise<any> {
    const res = await this.req.post('/api/environments', {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`POST /api/environments → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async patchEnvironment(id: string, data: Record<string, unknown>): Promise<any> {
    const res = await this.req.patch(`/api/environments/${id}`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`PATCH /api/environments/${id} → ${res.status()}: ${await res.text()}`);
    return res.json();
  }

  async deleteEnvironment(id: string): Promise<void> {
    const res = await this.req.delete(`/api/environments/${id}`, { headers: this.headers() });
    if (res.status() !== 204 && !res.ok()) throw new Error(`DELETE /api/environments/${id} → ${res.status()}`);
  }
}
