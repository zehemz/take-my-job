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
}
