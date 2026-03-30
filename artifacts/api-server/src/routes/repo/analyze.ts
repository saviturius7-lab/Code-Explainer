import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcessWithSSE } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

interface GitHubTreeItem {
  path: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

interface FileExplanation {
  path: string;
  explanation: string;
  language: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript/React",
    js: "JavaScript",
    jsx: "JavaScript/React",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    cs: "C#",
    cpp: "C++",
    c: "C",
    php: "PHP",
    swift: "Swift",
    kt: "Kotlin",
    md: "Markdown",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sh: "Shell",
    bash: "Bash",
    sql: "SQL",
    graphql: "GraphQL",
    proto: "Protobuf",
    dockerfile: "Dockerfile",
  };
  const filename = path.split("/").pop()?.toLowerCase() ?? "";
  if (filename === "dockerfile") return "Dockerfile";
  if (filename === "makefile") return "Makefile";
  return map[ext] ?? "Text";
}

function shouldSkipFile(path: string): boolean {
  const skipPatterns = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /build\//,
    /\.next\//,
    /\.nuxt\//,
    /coverage\//,
    /\.cache\//,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
    /package-lock\.json$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.svg$/,
    /\.ico$/,
    /\.woff/,
    /\.ttf$/,
    /\.eot$/,
    /\.mp4$/,
    /\.mp3$/,
    /\.wav$/,
    /\.zip$/,
    /\.tar$/,
    /\.gz$/,
    /\.min\.js$/,
    /\.min\.css$/,
    /\.d\.ts$/,
    /tsconfig\.tsbuildinfo$/,
  ];
  return skipPatterns.some((p) => p.test(path));
}

router.post("/analyze", async (req, res) => {
  const { repoUrl } = req.body as { repoUrl?: string };

  if (!repoUrl) {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    res.status(400).json({ error: "Invalid GitHub URL. Please provide a URL like https://github.com/owner/repo" });
    return;
  }

  const { owner, repo } = parsed;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ type: "status", message: `Fetching repository structure for ${owner}/${repo}...` });

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "RepoExplainer/1.0",
        },
      }
    );

    if (!treeRes.ok) {
      if (treeRes.status === 404) {
        sendEvent({ type: "error", message: "Repository not found. Make sure it exists and is public." });
      } else if (treeRes.status === 403) {
        sendEvent({ type: "error", message: "GitHub API rate limit exceeded. Please try again in a moment." });
      } else {
        sendEvent({ type: "error", message: `Failed to fetch repository: ${treeRes.statusText}` });
      }
      res.end();
      return;
    }

    const treeData = await treeRes.json() as { tree: GitHubTreeItem[] };
    const allFiles = treeData.tree
      .filter((item) => item.type === "blob" && !shouldSkipFile(item.path))
      .slice(0, 80);

    sendEvent({ type: "progress", current: 0, total: allFiles.length, message: `Found ${allFiles.length} files to analyze` });

    const fileContents: Array<{ path: string; content: string; language: string }> = [];

    for (const file of allFiles) {
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
          {
            headers: {
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "RepoExplainer/1.0",
            },
          }
        );
        if (contentRes.ok) {
          const data = await contentRes.json() as { content?: string; encoding?: string };
          if (data.content && data.encoding === "base64") {
            const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
            if (content.length < 50000) {
              fileContents.push({ path: file.path, content, language: detectLanguage(file.path) });
            }
          }
        }
      } catch {
        req.log.warn({ path: file.path }, "Failed to fetch file content");
      }
    }

    sendEvent({ type: "progress", current: 0, total: fileContents.length, message: `Analyzing ${fileContents.length} files with AI...` });

    let analyzed = 0;
    const explanations: FileExplanation[] = [];

    await batchProcessWithSSE(
      fileContents,
      async (file) => {
        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 1024,
          messages: [
            {
              role: "system",
              content:
                "You are a senior software engineer explaining code to a developer. Be thorough, clear, and educational. Explain what the file does, its purpose in the project, key functions/classes/exports, notable patterns, and any important implementation details.",
            },
            {
              role: "user",
              content: `Explain this ${file.language} file in detail.\n\nFile path: ${file.path}\n\n\`\`\`${file.language}\n${file.content.slice(0, 8000)}\n\`\`\``,
            },
          ],
        });
        return response.choices[0]?.message?.content ?? "No explanation generated.";
      },
      (event) => {
        if (event.type === "item_complete") {
          analyzed++;
          const file = fileContents[event.index];
          const explanation: FileExplanation = {
            path: file.path,
            explanation: event.result as string,
            language: file.language,
          };
          explanations.push(explanation);
          sendEvent({
            type: "file",
            path: file.path,
            explanation: event.result,
            language: file.language,
            current: analyzed,
            total: fileContents.length,
          });
        } else if (event.type === "item_error") {
          analyzed++;
          const file = fileContents[event.index];
          sendEvent({
            type: "file",
            path: file.path,
            explanation: "Failed to analyze this file.",
            language: file.language,
            current: analyzed,
            total: fileContents.length,
          });
        }
      },
      { concurrency: 3, retries: 3 }
    );

    sendEvent({ type: "status", message: "Generating overall project summary..." });

    const fileList = explanations
      .map((e) => `- ${e.path} (${e.language}): ${e.explanation.split("\n")[0].slice(0, 150)}`)
      .join("\n");

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are a senior software engineer writing a comprehensive project overview. Be thorough, structured, and educational.",
        },
        {
          role: "user",
          content: `Write a comprehensive overview for the GitHub repository ${owner}/${repo}.\n\nFiles analyzed:\n${fileList}\n\nInclude: what the project does, tech stack, architecture overview, key components, and how everything fits together.`,
        },
      ],
    });

    const summary = summaryResponse.choices[0]?.message?.content ?? "Summary unavailable.";
    sendEvent({ type: "summary", content: summary, owner, repo });
    sendEvent({ type: "done" });
  } catch (err) {
    req.log.error({ err }, "Error analyzing repository");
    sendEvent({ type: "error", message: "An unexpected error occurred while analyzing the repository." });
  }

  res.end();
});

export default router;
