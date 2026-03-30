import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRepoAnalysis } from "@/hooks/use-repo-analysis";
import { TerminalOutput } from "@/components/TerminalOutput";
import { Github, ArrowRight, Zap, BookOpen, AlertCircle, FileText, Download, Loader2 } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";

export default function Home() {
  const [url, setUrl] = useState("");
  const { state, startAnalysis, cancelAnalysis } = useRepoAnalysis();
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Derive logs from state changes for the terminal effect
  useEffect(() => {
    if (state.status === "analyzing" && state.progress.currentFile) {
      setLogs((prev) => {
        const newLog = `Read ${state.progress.currentFile}...`;
        if (prev[prev.length - 1] !== newLog) {
          return [...prev.slice(-40), newLog]; // Keep last 40 logs
        }
        return prev;
      });
    }
  }, [state.progress.currentFile, state.status]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLogs([]);
    setSelectedFile(null);
    startAnalysis(url.trim());
  };

  const handlePrint = () => {
    window.print();
  };

  // Group files by directory for the sidebar
  const groupedFiles = state.files.reduce((acc, file) => {
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
    if (!acc[dir]) acc[dir] = [];
    acc[dir].push(file);
    return acc;
  }, {} as Record<string, typeof state.files>);

  const activeFileContent = selectedFile 
    ? state.files.find(f => f.path === selectedFile)?.explanation 
    : state.summary;

  return (
    <div className="min-h-screen relative overflow-x-hidden no-print">
      {/* Background Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 no-print">
        <img 
          src={`${import.meta.env.BASE_URL}images/code-bg.png`} 
          alt="Cyberpunk code background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        
        {/* State: IDLE */}
        {state.status === "idle" && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center p-2 bg-secondary rounded-full mb-8 border border-border shadow-sm">
              <Zap className="w-4 h-4 text-primary mr-2 ml-1" />
              <span className="text-sm font-medium mr-2">Powered by Replit AI</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary/80 to-accent">
              Demystify Any Codebase
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Paste a GitHub repository link below. Our AI engine will read every file, understand the architecture, and generate a comprehensive, exportable explanation.
            </p>

            <form onSubmit={handleAnalyze} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-border shadow-2xl">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Github className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Input 
                    placeholder="https://github.com/owner/repository" 
                    className="h-14 pl-12 border-none shadow-none focus-visible:ring-0 bg-transparent text-lg"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-14 px-8 text-base shrink-0 font-bold"
                  disabled={!url.trim()}
                >
                  Analyze Repo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </form>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                { icon: BookOpen, title: "Deep Understanding", desc: "Reads and analyzes every single file to understand the context." },
                { icon: Zap, title: "Real-time Processing", desc: "Watch the AI engine work through the repository in real-time." },
                { icon: Download, title: "Export to PDF", desc: "Get a beautifully formatted PDF report of the entire codebase." }
              ].map((feature, i) => (
                <div key={i} className="bg-secondary/30 border border-border rounded-xl p-6 hover:bg-secondary/50 transition-colors">
                  <feature.icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* State: ANALYZING */}
        {state.status === "analyzing" && (
          <div className="max-w-4xl mx-auto pt-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Analysis in Progress</h2>
              <p className="text-muted-foreground font-mono text-sm break-all">{url}</p>
            </div>
            
            <TerminalOutput 
              logs={logs} 
              isAnalyzing={true} 
              progress={state.progress} 
            />
            
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={cancelAnalysis} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                Cancel Analysis
              </Button>
            </div>
          </div>
        )}

        {/* State: ERROR */}
        {state.status === "error" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto bg-card border border-destructive/50 rounded-2xl p-8 text-center shadow-2xl shadow-destructive/10"
          >
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Analysis Failed</h2>
            <p className="text-muted-foreground mb-8 p-4 bg-secondary rounded-lg font-mono text-sm">
              {state.error}
            </p>
            <Button onClick={() => cancelAnalysis()} variant="default" size="lg">
              Try Again
            </Button>
          </motion.div>
        )}

        {/* State: COMPLETE */}
        {state.status === "complete" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full flex flex-col h-[calc(100vh-6rem)]"
          >
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
              <div>
                <h2 className="text-2xl font-bold flex items-center">
                  <Github className="w-6 h-6 mr-3 text-muted-foreground" />
                  Repository Report
                </h2>
                <p className="text-sm text-muted-foreground font-mono mt-1">{url}</p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => cancelAnalysis()}>
                  Analyze Another
                </Button>
                <Button variant="glow" onClick={handlePrint}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden rounded-xl border border-border shadow-2xl bg-card">
              
              {/* Sidebar */}
              <div className="w-80 border-r border-border flex flex-col bg-secondary/20">
                <div className="p-4 border-b border-border bg-secondary/40 font-semibold text-sm flex items-center justify-between">
                  Navigation
                  <Badge variant="outline" className="font-mono text-xs">{state.files.length} files</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all mb-4 font-medium flex items-center ${
                      selectedFile === null 
                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-inner' 
                        : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Project Summary
                  </button>

                  {Object.entries(groupedFiles).sort(([a], [b]) => a.localeCompare(b)).map(([dir, files]) => (
                    <div key={dir} className="mb-4">
                      {dir !== '/' && (
                        <div className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {dir}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {files.map(file => {
                          const fileName = file.path.split('/').pop();
                          return (
                            <button
                              key={file.path}
                              onClick={() => setSelectedFile(file.path)}
                              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all flex items-center font-mono ${
                                selectedFile === file.path
                                  ? 'bg-accent/15 text-accent border border-accent/20'
                                  : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                              }`}
                              title={file.path}
                            >
                              <FileText className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
                              <span className="truncate">{fileName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto bg-[#0d1117] p-8 lg:p-12">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-8 pb-4 border-b border-border/50">
                    <h1 className="text-3xl font-bold font-mono">
                      {selectedFile ? selectedFile : 'Project Summary'}
                    </h1>
                  </div>
                  {activeFileContent ? (
                    <MarkdownView content={activeFileContent} />
                  ) : (
                    <div className="text-muted-foreground italic flex items-center h-40 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generating content...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* PRINT ONLY VIEW */}
      <div className="hidden print-only print-container">
        <h1 className="text-4xl font-bold mb-2">Repository Analysis Report</h1>
        <p className="text-gray-500 font-mono mb-8 pb-8 border-b-2 border-gray-200">{url}</p>
        
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Executive Summary</h2>
          <MarkdownView content={state.summary} />
        </div>

        {state.files.map((file, index) => (
          <div key={file.path} className="page-break-before mt-12 pt-8 border-t-2 border-gray-200">
            <h2 className="text-2xl font-bold font-mono mb-6 bg-gray-100 p-4 rounded-lg inline-block">
              {file.path}
            </h2>
            <MarkdownView content={file.explanation} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Minimal Badge Component since it wasn't requested explicitly but used
function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "outline" }) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
      variant === "default" ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80" : "text-foreground"
    } ${className}`} {...props} />
  )
}
