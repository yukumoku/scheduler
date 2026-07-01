export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } }

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  })

  const payload = (await response.json()) as ApiResponse<T>
  if (!payload.success) {
    throw new Error(payload.error.message)
  }

  return payload.data
}
