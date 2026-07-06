import React, { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, Play, HelpCircle, ArrowRight, RefreshCw } from "lucide-react";

interface TerminalProps {
  userSession: { username: string; role: string } | null;
}

export default function Terminal({ userSession }: TerminalProps) {
  const [command, setCommand] = useState("python cli.py inventory");
  const [currentDir, setCurrentDir] = useState(".");
  const [logs, setLogs] = useState<string[]>([
    "M.A.R.&I.O. System Command Terminal v2.0.0 (Stateful Linux Sandboxed Environment)",
    "Isolated workspace container established. Connected to synchronized SQLite database.",
    "Type 'python cli.py --help', 'ls -la', 'cat README.md', 'pwd', 'mkdir subfolder', or 'cd'.",
    "--------------------------------------------------------------------------------"
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize and Reset Sandbox on Session change
  useEffect(() => {
    const initSandbox = async () => {
      try {
        const response = await fetch("/api/reset-sandbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_session: userSession?.username || "alice_member"
          })
        });
        const data = await response.json();
        setCurrentDir(".");
        setLogs(prev => [
          ...prev,
          `✔ Sandbox auto-reset complete: ${data.message || "Active"}`
        ]);
      } catch (err: any) {
        setLogs(prev => [...prev, `Warning: Sandbox auto-reset failed: ${err.message}`]);
      }
    };
    initSandbox();
  }, [userSession?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const displayPrompt = `${userSession?.username || "anonymous"}@sandbox:~${currentDir === "." ? "" : "/" + currentDir}$ `;

  const runCommand = async (customCmd?: string) => {
    const cmdToRun = customCmd || command;
    if (!cmdToRun.trim()) return;

    setLoading(true);
    // Log entered command with realistic prompt
    setLogs(prev => [...prev, `\n${displayPrompt}${cmdToRun}`]);

    try {
      const response = await fetch("/api/cli-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmdToRun,
          user_session: userSession?.username || "alice_member",
          current_dir: currentDir
        })
      });

      const data = await response.json();
      if (data.current_dir !== undefined) {
        setCurrentDir(data.current_dir);
      }

      if (data.output) {
        setLogs(prev => [...prev, data.output]);
      } else {
        setLogs(prev => [...prev, "Command returned no output."]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `Error running command: ${err.message}`]);
    } finally {
      setLoading(false);
      // Clear input so users can type new bash or CLI commands comfortably
      if (!customCmd) setCommand("");
    }
  };

  const handleManualReset = async () => {
    setLoading(true);
    setLogs(prev => [...prev, "\n$ [Resetting Sandbox Directory...]"]);
    try {
      const response = await fetch("/api/reset-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_session: userSession?.username || "alice_member"
        })
      });
      const data = await response.json();
      setCurrentDir(".");
      if (data.message) {
        setLogs(prev => [
          ...prev,
          `✔ ${data.message}`,
          "Try running standard shell commands: 'ls', 'pwd', 'cat README.md', or file redirection like 'echo hello > test.txt'."
        ]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `Error resetting sandbox: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const macros = [
    { label: "View Inventory", cmd: "python cli.py inventory" },
    { label: "Forecast Reorders", cmd: "python cli.py forecast" },
    { label: "Audit Ledger", cmd: "python cli.py audit" },
    { label: "Check Directory (ls)", cmd: "ls -la" },
    { label: "Cat README.md", cmd: "cat README.md" },
    { label: "Print Sandbox Path (pwd)", cmd: "pwd" }
  ];

  return (
    <div id="cli-terminal" className="bg-slate-950 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[520px] terminal-glow">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-slate-400 font-mono text-xs ml-2 select-none flex items-center gap-1.5">
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
            cli.py - Command Center
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3">
          <button
            onClick={handleManualReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/40 text-slate-300 hover:text-white rounded text-[10px] transition-all cursor-pointer font-sans"
            title="Reset sandbox environment and recreate default README.md"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Reset Sandbox
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            CONNECTED (SESSION: {userSession?.username?.toUpperCase() || "ANONYMOUS"})
          </div>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-emerald-400 space-y-1 scrollbar-thin select-text">
        {logs.map((log, index) => (
          <pre key={index} className="whitespace-pre-wrap leading-relaxed select-text font-mono">
            {log}
          </pre>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-emerald-500/70 py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Executing commands in sandbox...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Action Macros */}
      <div className="bg-slate-900 px-4 py-2 border-t border-slate-850 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none select-none">
        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Macros:</span>
        {macros.map((m, i) => (
          <button
            key={i}
            onClick={() => runCommand(m.cmd)}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700/60 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 text-[10px] font-mono px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1"
          >
            <Play className="w-2.5 h-2.5" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Command Input Area */}
      <div className="bg-slate-900 border-t border-slate-800/80 p-3 flex items-center gap-2">
        <span className="text-emerald-500 font-mono font-bold select-none">{displayPrompt}</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && runCommand()}
          disabled={loading}
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-emerald-400 font-mono text-xs placeholder-slate-700"
          placeholder="Type command: ls, cat README.md, python cli.py inventory, echo hello..."
        />
        <button
          onClick={() => runCommand()}
          disabled={loading || !command.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Run</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
