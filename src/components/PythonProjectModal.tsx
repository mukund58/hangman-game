import React, { useEffect, useState } from "react";
import {
  X,
  Code2,
  Play,
  Download,
  CheckCircle2,
  FileCode,
  Terminal,
  Copy,
  Check,
} from "lucide-react";

interface PythonFileEntry {
  path: string;
  stage: string;
  responsibility: string;
  content: string;
}

interface PythonProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Interactive Python 3.11 + Flet + WebSockets + pytest Codebase Explorer & Test Runner.
 * Allows engineering students to inspect every modular Python file in `/hangman/`,
 * run the live Python unit test suite on the server, and download the codebase.
 */
export const PythonProjectModal: React.FC<PythonProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [files, setFiles] = useState<PythonFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("hangman/main.py");
  const [loading, setLoading] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    passed: boolean;
    stdout: string;
    stderr: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || files.length > 0) return;
    setLoading(true);
    fetch("/api/python-project")
      .then((r) => r.json())
      .then((data) => {
        if (data.files) {
          setFiles(data.files);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, files.length]);

  if (!isOpen) return null;

  const activeFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch("/api/run-pytest", { method: "POST" });
      const data = await res.json();
      setTestOutput(data);
    } catch (err) {
      setTestOutput({
        passed: false,
        stdout: "",
        stderr: String(err),
      });
    } finally {
      setRunningTests(false);
    }
  };

  const handleCopyFile = () => {
    if (!activeFile) return;
    navigator.clipboard?.writeText(activeFile.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadInstallerScript = () => {
    // Generates a single Python bootstrap script that recreates the entire `hangman/` directory locally
    const bundlePayload = JSON.stringify(
      files.map((f) => ({ path: f.path, content: f.content })),
      null,
      2
    );
    const script = `#!/usr/bin/env python3
"""
Self-extracting generator for the Hangman (Python 3.11 + Flet + WebSockets + pytest) project.
Run with:
    python3 setup_hangman_project.py
"""
import json
from pathlib import Path

FILES = ${bundlePayload}

def main():
    for item in FILES:
        target = Path(item["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item["content"], encoding="utf-8")
        print(f"Created {target}")
    print("\\nHangman project extracted successfully! Next steps:")
    print("  cd hangman")
    print("  python3 -m venv .venv && source .venv/bin/activate")
    print("  pip install -r requirements.txt")
    print("  PYTHONPATH=. pytest -v")
    print("  python main.py")

if __name__ == "__main__":
    main()
`;
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "setup_hangman_project.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[86vh] rounded-[18px] bg-[#F7F6F3] border border-[#D5C7A6] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-[#D5C7A6] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#0C2540] text-white flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#201F1A]">
                Python 3.11 + Flet + WebSockets + pytest Source Codebase
              </h2>
              <p className="text-[12px] text-[#716B5D]">
                Complete modular Python implementation (Stages 1–7) with live backend unit test execution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRunTests}
              disabled={runningTests}
              className="h-[36px] px-4 rounded-full bg-[#287B5E] hover:bg-[#20634B] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{runningTests ? "Running tests..." : "Run Python Unit Tests (19)"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadInstallerScript}
              className="h-[36px] px-4 rounded-full bg-[#0C2540] hover:bg-[#163A60] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full Python Project</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Python codebase modal"
              className="p-2 rounded-full text-[#716B5D] hover:text-[#201F1A] hover:bg-[#ECEAE4] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Pytest Output Drawer (when triggered) */}
        {testOutput && (
          <div className="px-6 py-3 bg-[#17191C] text-[#E6E4E2] border-b border-[#D5C7A6] font-mono text-[12px] max-h-[170px] overflow-y-auto">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#287B5E]" />
                <span className="font-bold text-white">
                  $ PYTHONPATH=hangman python3 hangman/run_tests.py
                </span>
                {testOutput.passed && (
                  <span className="text-[#4ADE80] flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All Tests Passed
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTestOutput(null)}
                className="text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                Hide output
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#D1D5DB]">
              {testOutput.stdout || testOutput.stderr}
            </pre>
          </div>
        )}

        {/* Main Split Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-[270px] bg-[#EFECE6] border-r border-[#D5C7A6] overflow-y-auto p-3 space-y-1 shrink-0">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#716B5D]">
              Project Files ({files.length})
            </div>
            {loading ? (
              <div className="p-4 text-[13px] text-[#716B5D]">Loading Python files...</div>
            ) : (
              files.map((file) => {
                const active = file.path === activeFile?.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`w-full text-left px-3 py-2 rounded-[10px] flex items-center justify-between gap-2 text-[12px] font-mono transition-colors cursor-pointer ${
                      active
                        ? "bg-[#0C2540] text-white font-semibold"
                        : "text-[#201F1A] hover:bg-white/70"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{file.path.replace(/^hangman\//, "")}</span>
                    </span>
                    <span
                      className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${
                        active ? "bg-white/20 text-white" : "bg-[#E2DDD2] text-[#716B5D]"
                      }`}
                    >
                      {file.stage}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1E1F22] text-[#F3F4F6]">
            {activeFile && (
              <>
                <div className="px-5 py-3 bg-[#27282C] border-b border-[#373A40] flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[13px] font-bold text-white">
                      {activeFile.path}
                    </div>
                    <div className="text-[12px] text-[#9CA3AF]">
                      {activeFile.responsibility}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyFile}
                    className="h-[32px] px-3 rounded-lg bg-[#373A40] hover:bg-[#4B5058] text-white text-[12px] font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy File"}</span>
                  </button>
                </div>
                <pre className="flex-1 p-5 overflow-auto font-mono text-[12.5px] leading-relaxed select-text">
                  <code>{activeFile.content}</code>
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
