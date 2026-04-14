# Tech Spec — Environment Creation with Presets

## Scope

Add a `POST /api/environments` route and a creation UI on `/environments` that lets admins create
Anthropic environments from presets or from scratch. Presets pre-fill packages and networking config
but can be modified before submission.

---

## 1. Presets

Presets are defined as a static constant in a shared module so both the API (for validation) and the
UI (for pre-filling) can reference them.

**File:** `lib/environment-presets.ts`

```ts
export interface EnvironmentPreset {
  key: string;
  label: string;
  description: string;
  networking: {
    type: 'unrestricted' | 'limited';
    allow_mcp_servers?: boolean;
    allow_package_managers?: boolean;
    allowed_hosts?: string[];
  };
  packages: {
    apt: string[];
    npm: string[];
    pip: string[];
    cargo: string[];
    gem: string[];
    go: string[];
  };
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    key: 'blank',
    label: 'Blank',
    description: 'Unrestricted networking, no pre-installed packages',
    networking: { type: 'unrestricted' },
    packages: { apt: [], npm: [], pip: [], cargo: [], gem: [], go: [] },
  },
  {
    key: 'node-backend',
    label: 'Node.js Backend',
    description: 'TypeScript, Prisma, and common CLI tools',
    networking: { type: 'unrestricted' },
    packages: {
      apt: ['git', 'curl', 'jq'],
      npm: ['typescript', 'tsx', 'prisma', '@prisma/client'],
      pip: [], cargo: [], gem: [], go: [],
    },
  },
  {
    key: 'python-ml',
    label: 'Python ML',
    description: 'NumPy, pandas, scikit-learn, Jupyter',
    networking: { type: 'unrestricted' },
    packages: {
      apt: ['git', 'curl'],
      npm: [],
      pip: ['numpy', 'pandas', 'scikit-learn', 'jupyter'],
      cargo: [], gem: [], go: [],
    },
  },
  {
    key: 'fullstack',
    label: 'Full-stack',
    description: 'Node.js + Python + Playwright for end-to-end work',
    networking: { type: 'unrestricted' },
    packages: {
      apt: ['git', 'curl', 'jq'],
      npm: ['typescript', 'tsx', 'prisma', '@prisma/client', 'playwright'],
      pip: ['requests'],
      cargo: [], gem: [], go: [],
    },
  },
  {
    key: 'qa-testing',
    label: 'QA / Testing',
    description: 'Playwright and TypeScript for test automation',
    networking: { type: 'unrestricted' },
    packages: {
      apt: ['git', 'curl'],
      npm: ['playwright', '@playwright/test', 'typescript'],
      pip: [], cargo: [], gem: [], go: [],
    },
  },
];
```

---

## 2. API

### `POST /api/environments`

Creates a new environment on Anthropic and returns the full detail.

**Auth:** `auth()` + `requireAdmin()`.

**Request body — `CreateEnvironmentRequest`**

```ts
// lib/api-types.ts — add:
export interface CreateEnvironmentRequest {
  name: string;                        // 1-256 chars, required
  description?: string | null;
  networking?: EnvironmentNetworking;   // defaults to { type: 'unrestricted' }
  packages?: EnvironmentPackages;       // defaults to all-empty
}

export interface CreateEnvironmentResponse {
  environment: EnvironmentDetail;
}
```

**Validation:**
- `name` is required, 1-256 characters.
- `networking` and `packages` are optional; server applies defaults if omitted.

**Route file:** `app/api/environments/route.ts` — add a `POST` handler alongside the existing `GET`.

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminErr = await requireAdmin(session.user.githubUsername);
  if (adminErr) return adminErr;

  const body = await req.json() as CreateEnvironmentRequest;

  // Validate name
  if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 256) {
    return NextResponse.json({ error: 'name is required (1-256 characters)' }, { status: 400 });
  }

  const createParams: any = {
    name: body.name,
    config: { type: 'cloud' },
  };

  if (body.description) {
    createParams.description = body.description;
  }

  // Networking
  if (body.networking) {
    if (body.networking.type === 'limited') {
      createParams.config.networking = {
        type: 'limited',
        allow_mcp_servers: body.networking.allowMcpServers ?? false,
        allow_package_managers: body.networking.allowPackageManagers ?? false,
        allowed_hosts: body.networking.allowedHosts ?? [],
      };
    } else {
      createParams.config.networking = { type: 'unrestricted' };
    }
  } else {
    createParams.config.networking = { type: 'unrestricted' };
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
    };
  }

  try {
    const env = await beta.environments.create(createParams);
    return NextResponse.json({ environment: mapEnvDetail(env) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to create environment', details: e.message },
      { status: 502 },
    );
  }
}
```

**Response — `201 Created`** — `CreateEnvironmentResponse` with the full `EnvironmentDetail`.

**Response — `400 Bad Request`** — validation failure.

**Response — `401 / 403`** — unauthenticated or non-admin.

**Response — `502 Bad Gateway`** — Anthropic API error.

---

## 3. UI

### Creation flow

The creation flow uses a **modal dialog** triggered from the environment list page, consistent with
the card creation pattern.

#### Preset selector

A horizontal row of clickable preset cards at the top of the modal. Each card shows:
- Preset label (bold)
- One-line description (muted)
- Selected state: highlighted border

Clicking a preset pre-fills the form fields below. The "Blank" preset is selected by default.

#### Form fields (below presets)

| Field | Control | Pre-filled by preset |
|-------|---------|---------------------|
| Name | Text input (required) | No — always empty, admin must name it |
| Description | Textarea (optional) | No |
| Network policy | Radio: unrestricted / limited (+ sub-options) | Yes |
| Packages | Per-manager text inputs (comma-separated) | Yes |

The network and packages controls reuse the same `NetworkEditor` and `PackagesEditor` components
from the environment detail page. Extract them to `app/environments/_components/` so both pages
can import them.

#### Submit

- Button label: "Create Environment"
- Loading state per ADR-006: `disabled={creating}`, label becomes "Creating..."
- On success: close modal, redirect to `/environments/{newId}`.
- On error: show inline error message, keep modal open.

### Component tree

```
app/environments/page.tsx
├── "Create Environment" button (admin-only, hidden for non-admins)
└── CreateEnvironmentModal (client component)
    ├── PresetSelector
    │   └── PresetCard[] (one per ENVIRONMENT_PRESETS entry)
    ├── Name input
    ├── Description textarea
    ├── NetworkEditor (extracted from detail page)
    ├── PackagesEditor (extracted from detail page)
    └── Submit / Cancel buttons
```

### Shared components to extract

Move from `app/environments/[id]/page.tsx` to `app/environments/_components/`:

- `NetworkEditor` — network policy form
- `PackagesEditor` — per-manager package list form

Both pages import from the shared location. No logic changes needed, just the file move.

---

## 4. Data flow

```
Admin clicks "Create Environment"
  → Modal opens, "Blank" preset selected
  → Admin picks a preset (e.g. "Node.js Backend")
  → Form pre-fills: npm=[typescript, tsx, prisma, @prisma/client], apt=[git, curl, jq]
  → Admin tweaks name, optionally adjusts packages
  → Submit → POST /api/environments
  → auth() + requireAdmin()
  → beta.environments.create({ name, config: { networking, packages } })
  → 201 { environment: EnvironmentDetail }
  → Redirect to /environments/{id}
```

---

## 5. E2E scenarios

Add to `docs/features/e2e-testing/SCENARIOS.md`:

- **Create environment from blank preset:** Open modal, enter name, submit. Verify environment
  appears in list and detail page shows unrestricted networking + no packages.
- **Create environment from Node.js preset:** Open modal, select "Node.js Backend", enter name,
  submit. Verify detail page shows expected npm and apt packages.
- **Modify preset before creating:** Select a preset, remove a package, add a host restriction,
  submit. Verify the created environment reflects the modifications, not the original preset.
- **Validation:** Submit without a name. Verify inline error, no environment created.
- **Non-admin cannot create:** Verify "Create Environment" button is hidden for non-admin users.

---

## 6. Out of scope (v1)

- Custom / user-defined presets (saved to DB).
- "Duplicate environment" action.
- Auto-assigning the new environment to an agent role in the same flow.
- Preset management UI.
