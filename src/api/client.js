// 统一请求封装：自动附带 token，JSON 序列化/解析，错误处理
export const BASE_URL = '/api'
export const AUTH_BASE_URL = '/auth'

export const getToken = () => localStorage.getItem('agent_token') || ''
export const setToken = (token) => localStorage.setItem('agent_token', token || '')
export const clearToken = () => localStorage.removeItem('agent_token')

export async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const token = getToken()
  const mergedHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  let finalBody = body
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    mergedHeaders['Content-Type'] = 'application/json'
    finalBody = JSON.stringify(body)
  }
  if (token) mergedHeaders['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: mergedHeaders,
    body: finalBody,
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && (data.detail || data.message || data.error))
      || (typeof data === 'string' ? data : '')
      || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// 仅用于 Agent 页：所有请求固定走 8001（/auth 代理）
export async function agentRequest(path, { method = 'GET', headers = {}, body } = {}) {
  const token = getToken()
  const mergedHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  let finalBody = body
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    mergedHeaders['Content-Type'] = 'application/json'
    finalBody = JSON.stringify(body)
  }
  if (token) mergedHeaders['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${AUTH_BASE_URL}${path}`, {
    method,
    headers: mergedHeaders,
    body: finalBody,
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && (data.detail || data.message || data.error))
      || (typeof data === 'string' ? data : '')
      || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// 流式请求（SSE 风格，POST 支持）：返回 { res, reader, controller }
export async function agentStream(path, { method = 'POST', headers = {}, body } = {}) {
  const token = getToken()
  const mergedHeaders = {
    Accept: 'text/event-stream',
    ...headers,
  }
  let finalBody = body
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    mergedHeaders['Content-Type'] = 'application/json'
    finalBody = JSON.stringify(body)
  }
  if (token) mergedHeaders['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const res = await fetch(`${AUTH_BASE_URL}${path}`, {
    method,
    headers: mergedHeaders,
    body: finalBody,
    signal: controller.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const message = text || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  const reader = res.body?.getReader?.()
  return { res, reader, controller }
}

// 登录：POST /user/login -> 返回 { access_token }
export async function login(username, password) {
  // 登录请求固定走 8001（/auth）
  const data = await agentRequest('/user/login', {
    method: 'POST',
    body: { username, password },
  })
  const token = data?.access_token || data?.token || data?.accessToken
  if (!token) throw new Error('登录成功但未返回 token')
  setToken(token)
  return token
}
