import type { DashboardData } from "$lib/types";

export type SseSendFn = (data: DashboardData) => void;

const clients = new Set<SseSendFn>();

/** Register an SSE client send callback. Returns unsubscribe cleanup. */
export function addClient(send: SseSendFn): () => void {
  clients.add(send);
  return () => {
    clients.delete(send);
  };
}

/** Push fresh dashboard data to all connected SSE clients. */
export function broadcast(data: DashboardData): void {
  for (const send of [...clients]) {
    try {
      send(data);
    } catch {
      clients.delete(send);
    }
  }
}

/** Number of connected SSE clients (for tests/diagnostics). */
export function getClientCount(): number {
  return clients.size;
}

/** Remove all clients (for tests). */
export function clearClients(): void {
  clients.clear();
}
