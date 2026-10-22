import { http, HttpResponse } from 'msw'
import type { ChangePasswordRequest, LoginRequest, RegisterRequest, Session, UpdateProfileRequest } from '@/contracts'
import { db, hashPassword, nextId, persist, publicUser, randomToken } from '../db'
import { config } from '../scenarios'
import { EMAIL_RE, fail, readJson, requireUser, route, validatePassword } from '../http-utils'

function createSession(userId: string): Session {
  const s = db()
  const token = randomToken()
  const expiresAt = Date.now() + config.sessionTtlMs
  s.sessions.push({ token, userId, expiresAt })
  persist()
  const user = s.users.find((u) => u.id === userId)!
  return { token, user: publicUser(user), expiresAt: new Date(expiresAt).toISOString() }
}

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/

export const authHandlers = [
  http.post('/api/auth/register', route(async ({ request }) => {
    const body = await readJson<RegisterRequest>(request)
    const fields: Record<string, string> = {}
    if (!body.name || body.name.trim().length < 2) fields.name = 'Informe seu nome (mínimo 2 caracteres).'
    if (!body.username || !USERNAME_RE.test(body.username)) fields.username = 'Use 3–24 caracteres: letras minúsculas, números, _ ou .'
    if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
    const pwErr = validatePassword(body.password)
    if (pwErr) fields.password = pwErr
    if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    const s = db()
    const email = body.email.trim().toLowerCase()
    if (s.users.some((u) => u.email === email)) throw fail(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { fields: { email: 'Este e-mail já está cadastrado.' } })
    if (s.users.some((u) => u.username === body.username)) throw fail(409, 'EMAIL_TAKEN', 'Este nome de usuário já está em uso.', { fields: { username: 'Nome de usuário indisponível.' } })
    const id = nextId('usr')
    const salt = randomToken().slice(0, 16)
    s.users.push({
      id,
      name: body.name.trim(),
      username: body.username,
      email,
      bio: '',
      ensName: null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(body.password, salt),
    })
    persist()
    return HttpResponse.json(createSession(id), { status: 201 })
  })),

  http.post('/api/auth/login', route(async ({ request }) => {
    const body = await readJson<LoginRequest>(request)
    const fields: Record<string, string> = {}
    if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
    if (!body.password) fields.password = 'Informe sua senha.'
    if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    const user = db().users.find((u) => u.email === body.email.trim().toLowerCase())
    if (!user || (await hashPassword(body.password, user.salt)) !== user.passwordHash) {
      throw fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json(createSession(user.id))
  })),

  http.get('/api/auth/session', route(({ request }) => {
    const { user, session } = requireUser(request)
    return HttpResponse.json<Session>({ token: session.token, user: publicUser(user), expiresAt: new Date(session.expiresAt).toISOString() })
  })),

  http.post('/api/auth/logout', route(({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const s = db()
    s.sessions = s.sessions.filter((x) => x.token !== token)
    persist()
    return new HttpResponse(null, { status: 204 })
  })),

  // ---------- Perfil ----------
  http.get('/api/me/profile', route(({ request }) => {
    const { user } = requireUser(request)
    return HttpResponse.json(publicUser(user))
  })),

  http.patch('/api/me/profile', route(async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readJson<UpdateProfileRequest>(request)
    const fields: Record<string, string> = {}
    if (body.name !== undefined && body.name.trim().length < 2) fields.name = 'Informe seu nome (mínimo 2 caracteres).'
    if (body.username !== undefined && !USERNAME_RE.test(body.username)) fields.username = 'Use 3–24 caracteres: letras minúsculas, números, _ ou .'
    if (body.email !== undefined && !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
    if (body.ensName && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(body.ensName)) fields.ensName = 'Nome ENS inválido (ex.: nome.eth).'
    if (body.bio !== undefined && body.bio.length > 280) fields.bio = 'A bio deve ter no máximo 280 caracteres.'
    if (body.avatarUrl) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(body.avatarUrl)) fields.avatarUrl = 'Envie uma imagem PNG, JPG ou WEBP.'
      else if (body.avatarUrl.length > 1_400_000) fields.avatarUrl = 'A imagem deve ter no máximo 1 MB.'
    }
    const s = db()
    if (body.email && s.users.some((u) => u.id !== user.id && u.email === body.email!.toLowerCase())) fields.email = 'Este e-mail já está em uso.'
    if (body.username && s.users.some((u) => u.id !== user.id && u.username === body.username)) fields.username = 'Nome de usuário indisponível.'
    if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    if (body.name !== undefined) user.name = body.name.trim()
    if (body.username !== undefined) user.username = body.username
    if (body.email !== undefined) user.email = body.email.toLowerCase()
    if (body.bio !== undefined) user.bio = body.bio
    if (body.ensName !== undefined) user.ensName = body.ensName || null
    if (body.avatarUrl !== undefined) user.avatarUrl = body.avatarUrl
    persist()
    return HttpResponse.json(publicUser(user))
  })),

  http.post('/api/me/password', route(async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readJson<ChangePasswordRequest>(request)
    const pwErr = validatePassword(body.newPassword)
    if (pwErr) throw fail(422, 'VALIDATION_ERROR', pwErr, { fields: { newPassword: pwErr } })
    if ((await hashPassword(body.currentPassword ?? '', user.salt)) !== user.passwordHash) {
      throw fail(422, 'WRONG_PASSWORD', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    }
    if (body.currentPassword === body.newPassword) {
      throw fail(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', { fields: { newPassword: 'A nova senha deve ser diferente da atual.' } })
    }
    user.passwordHash = await hashPassword(body.newPassword, user.salt)
    persist()
    return new HttpResponse(null, { status: 204 })
  })),
]
