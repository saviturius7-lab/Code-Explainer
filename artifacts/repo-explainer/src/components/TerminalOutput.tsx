import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Loader2, CheckCircle2 } from "lucide-react";

interface TerminalOutputProps {
  logs: string[];
  isAnalyzing: boolean;
  progress: { current: number; total: number; currentFile: string };
}

export function TerminalOutput({ logs, isAnalyzing, progress }: TerminalOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, progress]);

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-border shadow-2xl bg-[#0a0a0a]"
    >
      {/* Terminal Header */}
      <div className="bg-secondary/50 px-4 py-3 flex items-center border-b border-border">
        <div className="flex space-x-2 mr-4">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <div className="flex items-center text-xs font-mono text-muted-foreground">
          <Terminal className="w-3.5 h-3.5 mr-2" />
          analysis-engine.exe
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="p-5 font-mono text-sm h-[400px] overflow-y-auto space-y-2"
      >
        <div className="text-primary opacity-80 mb-4">
          $ init repo-analysis --verbose
          <br/>
          Initializing analysis engine...
        </div>

        {logs.map((log, i) => (
          <div key={i} className="text-muted-foreground flex items-start group">
            <span className="text-primary/50 mr-3 mt-0.5">❯</span>
            <span className="group-hover:text-foreground transition-colors">{log}</span>
          </div>
        ))}

        <AnimatePresence>
          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 border-t border-border/50 pt-4"
            >
              <div className="flex items-center justify-between text-primary mb-2">
                <span className="flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing {progress.currentFile || "..."}
                </span>
                <span>{percentage}%</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-2 text-right">
                File {progress.current} of {progress.total}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isAnalyzing && percentage === 100 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-accent flex items-center mt-4 pt-4 border-t border-border/50"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Analysis complete. Compiling final report...
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
