import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { canAttachPicture, defaultFiles, githubClient, runAction, type Attachment, type PullRequestClient } from "../src/action.js";

const redOnBlack = ".bad { color: #ff0000; background-color: #000000; }\n";
const passing = "a { color: #111111; background-color: #ffffff; }\n";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "colorwarning-"));
}

function memoryClient(attachment: Attachment): PullRequestClient & { comments: Array<{ id: number; body: string }> } {
  const comments: Array<{ id: number; body: string }> = [];
  let nextId = 1;
  return {
    comments,
    listComments: () => Promise.resolve(comments.map((comment) => ({ ...comment }))),
    createComment: (body) => {
      comments.push({ id: nextId, body });
      nextId += 1;
      return Promise.resolve();
    },
    updateComment: (id, body) => {
      const comment = comments.find((item) => item.id === id);
      if (comment !== undefined) comment.body = body;
      return Promise.resolve();
    },
    deleteComment: (id) => {
      const index = comments.findIndex((item) => item.id === id);
      if (index !== -1) comments.splice(index, 1);
      return Promise.resolve();
    },
    attachSwatch: () => Promise.resolve(attachment),
  };
}

describe("warn-only action", () => {
  test("comments on a finding and does not fail", async () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const summary = join(cwd, "summary.md");
    const client = memoryClient({ url: "https://github.com/user-attachments/assets/swatch", reason: null });
    const result = await runAction({ workspace: cwd, files: "theme.css", summaryPath: summary, client });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("cvd-contrast under protanopia");
    expect(client.comments).toHaveLength(1);
    expect(client.comments[0]?.body).toContain("<!-- colorwarning -->");
    expect(client.comments[0]?.body).toContain("cvd-contrast under protanopia");
    expect(client.comments[0]?.body).toContain("![original and simulated](https://github.com/user-attachments/assets/swatch)");
    expect(readFileSync(summary, "utf8")).toContain("protanopia");
  });

  test("updates one comment and removes it when the finding is gone", async () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const client = memoryClient({ url: null, reason: "The swatch picture was not posted." });
    await runAction({ workspace: cwd, files: "theme.css", client });
    expect(client.comments).toHaveLength(1);
    expect(client.comments[0]?.body).toContain("The swatch picture was not posted.");

    writeFileSync(join(cwd, "theme.css"), `${redOnBlack}\n.also { color: #ff0000; background-color: #000000; }\n`);
    await runAction({ workspace: cwd, files: "theme.css", client });
    expect(client.comments).toHaveLength(1);
    expect(client.comments[0]?.body).toContain(".also");

    writeFileSync(join(cwd, "theme.css"), passing);
    const clean = await runAction({ workspace: cwd, files: "theme.css", client });
    expect(clean.exitCode).toBe(0);
    expect(client.comments).toHaveLength(0);
  });

  test("stays quiet outside a pull request", async () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const result = await runAction({ workspace: cwd, files: "theme.css", client: null });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("#ff0000 on #000000");
  });

  test("fails when a file cannot be read", async () => {
    const cwd = workspace();
    const client = memoryClient({ url: null, reason: null });
    const result = await runAction({ workspace: cwd, files: "missing.css", client });
    expect(result.exitCode).toBe(2);
    expect(result.errorOutput).toContain("missing.css");
    expect(client.comments).toHaveLength(0);
  });

  test("checks CSS files and skips installed dependencies", async () => {
    const cwd = workspace();
    mkdirSync(join(cwd, "src"));
    mkdirSync(join(cwd, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(cwd, "src", "theme.css"), passing);
    writeFileSync(join(cwd, "node_modules", "pkg", "vendor.css"), redOnBlack);
    writeFileSync(join(cwd, "tailwind.config.js"), "module.exports = { theme: { colors: {} } };\n");
    const files = await defaultFiles(cwd);
    expect(files).toEqual(["src/theme.css", "tailwind.config.js"]);
  });
});

describe("swatch upload", () => {
  test("accepts a personal access token and rejects the Actions token", () => {
    expect(canAttachPicture("github_pat_example")).toBe(true);
    expect(canAttachPicture("ghp_example")).toBe(true);
    expect(canAttachPicture("gho_example")).toBe(true);
    expect(canAttachPicture("ghs_example")).toBe(false);
  });

  test("posts the uploaded picture", async () => {
    const calls: string[] = [];
    const client = githubClient({
      token: "github_pat_example",
      repository: "ManOfNeptune27/ColorWarning",
      pullRequest: 7,
      fetch: (url, init) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/comments?per_page=100")) {
          return Promise.resolve(jsonResponse([]));
        }
        if (url.endsWith("/repos/ManOfNeptune27/ColorWarning")) {
          return Promise.resolve(jsonResponse({ id: 42 }));
        }
        if (url.startsWith("https://uploads.github.com/")) {
          expect(init?.body).toBeInstanceOf(Uint8Array);
          return Promise.resolve(jsonResponse({ href: "https://github.com/user-attachments/assets/abc" }));
        }
        if (init?.method === "POST") {
          const body = JSON.parse(new TextDecoder().decode(init.body)) as { body: string };
          expect(body.body).toContain("![original and simulated](https://github.com/user-attachments/assets/abc)");
          return Promise.resolve(jsonResponse({ id: 1 }));
        }
        return Promise.resolve(jsonResponse({}, false, 500));
      },
    });
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const result = await runAction({ workspace: cwd, files: "theme.css", client });
    expect(result.exitCode).toBe(0);
    expect(calls.some((call) => call.startsWith("POST https://uploads.github.com/"))).toBe(true);
  });

  test("does not upload with the Actions token", async () => {
    const calls: string[] = [];
    const client = githubClient({
      token: "ghs_example",
      repository: "ManOfNeptune27/ColorWarning",
      pullRequest: 7,
      fetch: (url, init) => {
        calls.push(url);
        if (url.includes("uploads.github.com")) return Promise.reject(new Error("uploaded"));
        if (url.endsWith("/comments?per_page=100")) return Promise.resolve(jsonResponse([]));
        if (init?.method === "POST") {
          const body = JSON.parse(new TextDecoder().decode(init.body)) as { body: string };
          expect(body.body).toContain("default Actions token");
          expect(body.body).not.toContain("![original and simulated]");
          return Promise.resolve(jsonResponse({ id: 1 }));
        }
        return Promise.resolve(jsonResponse({}, false, 500));
      },
    });
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const result = await runAction({ workspace: cwd, files: "theme.css", client });
    expect(result.exitCode).toBe(0);
    expect(calls.some((call) => call.includes("uploads.github.com"))).toBe(false);
  });
});

function jsonResponse(value: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(value),
  };
}
