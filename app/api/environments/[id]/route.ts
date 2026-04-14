import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { devAuth as auth } from '@/lib/dev-auth'
import { requireAdmin } from '@/lib/rbac'
import type { EnvironmentDetail, PatchEnvironmentRequest } from '@/lib/api-types'

// ─── Shared mapper ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnvDetail(env: any): EnvironmentDetail {
  const networking = env.config?.networking
  const packages = env.config?.packages
  return {
    id: env.id,
    name: env.name,
    description: env.description ?? '',
    networking:
      networking?.type === 'limited'
        ? {
            type: 'limited',
            allowMcpServers: networking.allow_mcp_servers ?? false,
            allowPackageManagers: networking.allow_package_managers ?? false,
            allowedHosts: networking.allowed_hosts ?? [],
          }
        : { type: 'unrestricted' },
    packages: {
      apt: packages?.apt ?? [],
      npm: packages?.npm ?? [],
      pip: packages?.pip ?? [],
      cargo: packages?.cargo ?? [],
      gem: packages?.gem ?? [],
      go: packages?.go ?? [],
    },
    createdAt: env.created_at,
    updatedAt: env.updated_at,
    archivedAt: env.archived_at ?? null,
  }
}

// ─── GET /api/environments/[id] ─────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let env: any
  try {
    env = await beta.environments.retrieve(params.id)
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any
    if ((err?.status ?? err?.statusCode) === 404)
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    return NextResponse.json(
      { error: 'Failed to fetch environment', details: err.message },
      { status: 502 },
    )
  }

  return NextResponse.json(mapEnvDetail(env))
}

// ─── PATCH /api/environments/[id] ───────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as PatchEnvironmentRequest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateParams: any = {}
  if (body.name !== undefined) updateParams.name = body.name
  if (body.description !== undefined)
    updateParams.description = body.description === '' ? null : body.description

  if (body.networking !== undefined) {
    if (body.networking.type === 'unrestricted') {
      updateParams.config = { type: 'cloud', networking: { type: 'unrestricted' } }
    } else {
      updateParams.config = {
        type: 'cloud',
        networking: {
          type: 'limited',
          allow_mcp_servers: body.networking.allowMcpServers ?? false,
          allow_package_managers: body.networking.allowPackageManagers ?? false,
          allowed_hosts: body.networking.allowedHosts ?? [],
        },
      }
    }
  }

  if (body.packages !== undefined) {
    // Merge packages into config (preserve networking if not also updating)
    updateParams.config = {
      ...updateParams.config,
      type: 'cloud',
      packages: {
        type: 'packages',
        apt: body.packages.apt,
        npm: body.packages.npm,
        pip: body.packages.pip,
        cargo: body.packages.cargo,
        gem: body.packages.gem,
        go: body.packages.go,
      },
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updated: any
  try {
    updated = await beta.environments.update(params.id, updateParams)
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any
    if ((err?.status ?? err?.statusCode) === 404)
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    return NextResponse.json(
      { error: 'Failed to update environment', details: err.message },
      { status: 502 },
    )
  }

  return NextResponse.json({ environment: mapEnvDetail(updated) })
}

// ─── DELETE /api/environments/[id] ──────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin-only guard
  const adminErr = await requireAdmin(session.user.githubUsername)
  if (adminErr) return adminErr

  const { id } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  try {
    await beta.environments.archive(id)
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any
    const status = err?.status ?? err?.statusCode
    if (status !== 404) {
      return NextResponse.json(
        { error: 'Failed to delete environment', details: err.message },
        { status: 502 },
      )
    }
    // 404 → already gone, treat as success
  }

  return new NextResponse(null, { status: 204 })
}
