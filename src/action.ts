import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runCli } from "./cli.js";
import { SWATCH_FILENAME } from "./swatch.js";

export const COMMENT_MARKER = "<!-- colorwarning -->";

const skippedDirectories = new Set(["node_modules", "dist", ".git"]);
const defaultPatterns = [
  "**/*.css",
  "**/tailwind.config.js",
  "**/tailwind.config.cjs",
  "**/tailwind.config.mjs",
  "**/tailwind.config.ts",
];

export type ActionResult = {
  exitCode: number;
  output: string;
  errorOutput: string;
};

export type Attachment = {
  url: string | null;
  reason: string | null;
};

type Comment = {
  id: number;
  body: string;
};

export type PullRequestClient = {
  listComments(): Promise<Comment[]>;
  createComment(body: string): Promise<void>;
  updateComment(id: number, body: string): Promise<void>;
  deleteComment(id: number): Promise<void>;
  attachSwatch(filename: string): Promise<Attachment>;
};

type ActionInput = {
  workspace: string;
  files: string;
  summaryPath?: string;
  client: PullRequestClient | null;
};

/** Check the workspace and, on a pull request, comment without failing for findings. */
export async function runAction(input: ActionInput): Promise<ActionResult> {
  const files = input.files.trim().length > 0 ? listedFiles(input.files) : await defaultFiles(input.workspace);
  if (files.length === 0) {
    await settleComment(input.client, null, { url: null, reason: null });
    return { exitCode: 0, output: "no findings\n", errorOutput: "" };
  }

  const check = runCli(["check", ...files], { cwd: input.workspace });
  if (check.exitCode === 2) {
    return { exitCode: 2, output: check.output, errorOutput: check.errorOutput };
  }

  const swatch = runCli(["swatch", ...files], { cwd: input.workspace });
  const swatchPath = path.join(input.workspace, SWATCH_FILENAME);
  const attachment =
    check.exitCode === 1 && existsSync(swatchPath) && input.client !== null
      ? await input.client.attachSwatch(swatchPath)
      : { url: null, reason: null };
  await settleComment(input.client, check.exitCode === 1 ? check.output : null, attachment);

  const output = check.output;
  if (input.summaryPath !== undefined && output.length > 0) appendFileSync(input.summaryPath, output);
  return {
    exitCode: check.exitCode === 1 ? 0 : check.exitCode,
    output,
    errorOutput: [check.errorOutput, swatch.errorOutput].filter((part) => part.length > 0).join(""),
  };
}

/** A personal access token or an OAuth token can upload the swatch. The Actions token cannot. */
export function canAttachPicture(token: string): boolean {
  return token.startsWith("github_pat_") || token.startsWith("ghp_") || token.startsWith("gho_");
}

export function renderComment(report: string, attachment: Attachment): string {
  const lines = [COMMENT_MARKER, "", report.trimEnd()];
  if (attachment.url !== null) lines.push("", `![original and simulated](${attachment.url})`);
  else if (attachment.reason !== null) lines.push("", attachment.reason);
  return `${lines.join("\n")}\n`;
}

export async function defaultFiles(workspace: string): Promise<string[]> {
  const found = new Set<string>();
  for (const pattern of defaultPatterns) {
    for await (const file of glob(pattern, { cwd: workspace })) {
      const portable = file.split(path.sep).join("/");
      const parts = portable.split("/");
      if (parts.some((part) => skippedDirectories.has(part))) continue;
      found.add(portable);
    }
  }
  return [...found].sort();
}

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

type FetchFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: Uint8Array }) => Promise<FetchResponse>;

export function githubClient(options: {
  token: string;
  repository: string;
  pullRequest: number;
  apiUrl?: string;
  fetch?: FetchFn;
}): PullRequestClient {
  const apiUrl = options.apiUrl ?? "https://api.github.com";
  const fetchImpl: FetchFn =
    options.fetch ??
    ((url, init) =>
      fetch(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body as BodyInit | undefined,
      }) as Promise<FetchResponse>);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token}`,
    "User-Agent": "colorwarning",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const issue = `${apiUrl}/repos/${options.repository}/issues/${options.pullRequest}/comments`;

  return {
    async listComments() {
      const comments: Comment[] = [];
      let url: string | null = `${issue}?per_page=100`;
      for (let page = 0; page < 5 && url !== null; page++) {
        const response = await fetchImpl(url, { headers });
        if (!response.ok) throw new Error(`could not read pull request comments (${response.status})`);
        const body: unknown = await response.json();
        if (!isCommentList(body)) throw new Error("pull request comments were not a list");
        comments.push(...body);
        url = nextLink(response.headers.get("link"));
      }
      return comments;
    },
    async createComment(body) {
      const response = await fetchImpl(issue, { method: "POST", headers, body: jsonBody({ body }) });
      if (!response.ok) throw new Error(`could not comment on the pull request (${response.status})`);
    },
    async updateComment(id, body) {
      const response = await fetchImpl(`${apiUrl}/repos/${options.repository}/issues/comments/${id}`, {
        method: "PATCH",
        headers,
        body: jsonBody({ body }),
      });
      if (!response.ok) throw new Error(`could not update the pull request comment (${response.status})`);
    },
    async deleteComment(id) {
      const response = await fetchImpl(`${apiUrl}/repos/${options.repository}/issues/comments/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) throw new Error(`could not remove the pull request comment (${response.status})`);
    },
    async attachSwatch(filename) {
      if (!canAttachPicture(options.token)) {
        return {
          url: null,
          reason:
            "The swatch picture was not posted. GitHub does not accept the default Actions token for images. Set token to a fine-grained personal access token with pull request write access to post it.",
        };
      }
      const repo = await fetchImpl(`${apiUrl}/repos/${options.repository}`, { headers });
      if (!repo.ok) return { url: null, reason: `The swatch picture was not posted (${repo.status}).` };
      const repositoryId = readId(await repo.json());
      if (repositoryId === null) return { url: null, reason: "The swatch picture was not posted." };
      const uploadUrl =
        `https://uploads.github.com/user-attachments/assets?name=${SWATCH_FILENAME}` +
        `&content_type=image/png&repository_id=${repositoryId}`;
      const uploaded = await fetchImpl(uploadUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/png" },
        body: new Uint8Array(readFileSync(filename)),
      });
      if (!uploaded.ok) return { url: null, reason: `The swatch picture was not posted (${uploaded.status}).` };
      const href = readHref(await uploaded.json());
      if (href === null) return { url: null, reason: "The swatch picture was not posted." };
      return { url: href, reason: null };
    },
  };
}

async function settleComment(client: PullRequestClient | null, report: string | null, attachment: Attachment): Promise<void> {
  if (client === null) return;
  const comments = await client.listComments();
  const existing = comments.find((comment) => comment.body.includes(COMMENT_MARKER));
  if (report === null) {
    if (existing !== undefined) await client.deleteComment(existing.id);
    return;
  }
  const body = renderComment(report, attachment);
  if (existing === undefined) await client.createComment(body);
  else await client.updateComment(existing.id, body);
}

function listedFiles(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function jsonBody(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function isCommentList(value: unknown): value is Comment[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const comment = item as { id?: unknown; body?: unknown };
      return typeof comment.id === "number" && typeof comment.body === "string";
    })
  );
}

function readId(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "number" ? id : null;
}

function readHref(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const href = (value as { href?: unknown }).href;
  return typeof href === "string" ? href : null;
}

function nextLink(header: string | null): string | null {
  if (header === null) return null;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

async function main(): Promise<void> {
  const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
  const token = process.env["INPUT_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
  const eventName = process.env["GITHUB_EVENT_NAME"];
  const repository = process.env["GITHUB_REPOSITORY"];
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  let client: PullRequestClient | null = null;
  if (eventName === "pull_request" && repository !== undefined && token.length > 0) {
    const number = pullRequestNumber(process.env["GITHUB_EVENT_PATH"]);
    if (number !== null) {
      client = githubClient({
        token,
        repository,
        pullRequest: number,
        apiUrl: process.env["GITHUB_API_URL"],
      });
    }
  }
  const result = await runAction({
    workspace,
    files: process.env["INPUT_FILES"] ?? "",
    summaryPath,
    client,
  });
  if (result.errorOutput.length > 0) process.stderr.write(result.errorOutput);
  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}

function pullRequestNumber(eventPath: string | undefined): number | null {
  if (eventPath === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(eventPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const pullRequest = (parsed as { pull_request?: unknown }).pull_request;
    if (typeof pullRequest !== "object" || pullRequest === null) return null;
    const number = (pullRequest as { number?: unknown }).number;
    return typeof number === "number" ? number : null;
  } catch {
    return null;
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
