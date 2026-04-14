import { config } from "./config";

export function slugify(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${id.slice(0, 6)}`;
}

/**
 * Parse "https://github.com/owner/repo" into { owner, repo }.
 */
function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.replace(/\.git$/, "").match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error(`Cannot parse GitHub repo URL: ${url}`);
  return { owner: match[1], repo: match[2] };
}

/**
 * Create a board folder in the workspace repo via the GitHub Contents API.
 * Throws if the folder already exists.
 * Uses GITHUB_TOKEN for auth — works both locally and in production.
 */
export async function ensureBoardFolder(
  boardName: string,
  workspacePath: string,
): Promise<void> {
  const token = config.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required to provision workspace folders");

  const { owner, repo } = parseRepoUrl(config.WORKSPACE_REPO_URL!);
  const filePath = `${workspacePath}/README.md`;

  // Check if folder already exists
  const checkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${workspacePath}`,
    { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } },
  );
  if (checkRes.ok) {
    throw new Error(`Workspace folder already exists: ${workspacePath}`);
  }
  if (checkRes.status !== 404) {
    const body = await checkRes.text();
    throw new Error(`GitHub API error checking folder: ${checkRes.status} ${body}`);
  }

  // Create README.md in the folder (this implicitly creates the folder)
  const content = Buffer.from(
    `# ${boardName}\n\nWorkspace for board: ${boardName}\n`,
  ).toString("base64");

  const createRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: init workspace for board ${boardName}`,
        content,
        branch: "main",
      }),
    },
  );

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`GitHub API error creating folder: ${createRes.status} ${body}`);
  }
}
