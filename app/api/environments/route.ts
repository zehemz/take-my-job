import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { devAuth as auth } from '@/lib/dev-auth'
import { requireAdmin } from '@/lib/rbac'
import type { EnvironmentRow, CreateEnvironmentRequest } from '@/lib/api-types'

// Shared mapper (same as in [id]/route.ts — kept co-located to avoid circular deps)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnvDetail(env: any) {
  const networking = env.config?.networking
  const packages = env.config?.packages
  return {
    id: env.id,
    name: env.name,
    description: env.description ?? '',
    networking:
      networking?.type === 'limited'
        ? {
            type: 'limited' as const,
            allowMcpServers: networking.allow_mcp_servers ?? false,
            allowPackageManagers: networking.allow_package_managers ?? false,
            allowedHosts: networking.allowed_hosts ?? [],
          }
        : { type: 'unrestricted' as const },
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

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allEnvironments: any[]
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collected: any[] = []
    for await (const env of beta.environments.list()) {
      collected.push(env)
    }
    allEnvironments = collected
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch environments from Anthropic', details: message },
      { status: 502 },
    )
  }

  const rows: EnvironmentRow[] = allEnvironments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((env: any) => env.archived_at === null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((env: any): EnvironmentRow => ({
      id: env.id,
      name: env.name,
      description: env.description ?? '',
      createdAt: env.created_at,
      updatedAt: env.updated_at,
      networkType: env.config?.networking?.type ?? 'unrestricted',
    }))

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminErr = await requireAdmin(session.user.githubUsername)
  if (adminErr) return adminErr

  const body = (await req.json()) as CreateEnvironmentRequest

  if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 256) {
    return NextResponse.json({ error: 'name is required (1-256 characters)' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (new Anthropic()).beta as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createParams: any = {
    name: body.name,
    config: { type: 'cloud' },
  }

  if (body.description) {
    createParams.description = body.description
  }

  // Networking
  if (body.networking?.type === 'limited') {
    createParams.config.networking = {
      type: 'limited',
      allow_mcp_servers: body.networking.allowMcpServers ?? false,
      allow_package_managers: body.networking.allowPackageManagers ?? false,
      allowed_hosts: body.networking.allowedHosts ?? [],
    }
  } else {
    createParams.config.networking = { type: 'unrestricted' }
  }

  // Packages
  if (body.packages) {
    createParams.config.packages = {
      type: 'packages',
      apt: body.packages.apt ?? [],
      npm: body.packages.npm ?? [],
      pip: body.packages.pip ?? [],
      cargo: body.packages.cargo ?? [],
      gem: body.packages.gem ?? [],
      go: body.packages.go ?? [],
    }
  }

  try {
    const env = await beta.environments.create(createParams)
    return NextResponse.json({ environment: mapEnvDetail(env) }, { status: 201 })
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any
    return NextResponse.json(
      { error: 'Failed to create environment', details: err.message },
      { status: 502 },
    )
  }
}
