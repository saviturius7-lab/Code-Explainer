import { useState, useCallback, useRef } from "react";
import { getAnalyzeRepoUrl } from "@workspace/api-client-react";

export type AnalysisFile = {
  path: string;
  explanation: string;
};

export type AnalysisState = {
  status: "idle" | "analyzing" | "complete" | "error";
  error: string | null;
  summary: string;
  files: AnalysisFile[];
  progress: {
    current: number;
    total: number;
    currentFile: string;
  };
};

type SSEEvent = 
  | { type: "summary"; content: string }
  | { type: "file"; path: string; explanation: string }
  | { type: "progress"; current: number; total: number; path?: string }
  | { type: "done" };

export function useRepoAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    error: null,
    summary: "",
    files: [],
    progress: { current: 0, total: 0, currentFile: "" },
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(async (repoUrl: string) => {
    // Reset state
    setState({
      status: "analyzing",
      error: null,
      summary: "",
      files: [],
      progress: { current: 0, total: 0, currentFile: "Connecting to GitHub..." },
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(getAnalyzeRepoUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server responded with ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        
        // Keep the last line in the buffer if it doesn't end with a newline
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr) as SSEEvent;
              
              setState((prev) => {
                const next = { ...prev };
                
                switch (event.type) {
                  case "summary":
                    next.summary = event.content;
                    break;
                  case "file":
                    // Avoid duplicates if same file comes multiple times or chunks
                    const existingIndex = next.files.findIndex(f => f.path === event.path);
                    if (existingIndex >= 0) {
                      next.files[existingIndex] = { ...event };
                    } else {
                      next.files = [...next.files, { path: event.path, explanation: event.explanation }];
                    }
                    break;
                  case "progress":
                    next.progress = {
                      current: event.current,
                      total: event.total,
                      currentFile: event.path || prev.progress.currentFile,
                    };
                    break;
                  case "done":
                    next.status = "complete";
                    next.progress = { ...next.progress, currentFile: "Analysis complete." };
                    break;
                }
                return next;
              });
            } catch (err) {
              console.warn("Failed to parse SSE event:", dataStr, err);
            }
          }
        }
      }
      
      // Ensure we mark complete if the stream closes without a explicit done event
      setState(prev => prev.status === "analyzing" ? { ...prev, status: "complete" } : prev);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err.message || "An unexpected error occurred during analysis.",
      }));
    }
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ 
        ...prev, 
        status: prev.status === "analyzing" ? "idle" : prev.status 
      }));
    }
  }, []);

  return {
    state,
    startAnalysis,
    cancelAnalysis,
  };
}
