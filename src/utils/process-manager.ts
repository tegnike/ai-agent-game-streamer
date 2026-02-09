import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { PROJECT_ROOT, MANAGED_PORTS } from "../config.js";
import { logger } from "./logger.js";

export class ProcessManager {
  private serverProcess: ChildProcess | null = null;

  /**
   * Start a persistent HTTP server from the games/ root directory.
   * All games are accessible at http://127.0.0.1:<port>/<game>/index.html
   */
  async startPersistentServer(port: number): Promise<number> {
    if (this.isRunning()) {
      logger.info("[Process] HTTP server already running, skipping start");
      return this.serverProcess!.pid!;
    }

    const start = Date.now();
    logger.info(`[Process] starting persistent HTTP server on port ${port}...`);
    await this.killPort(port);

    const gamesRoot = path.join(PROJECT_ROOT, "games");

    this.serverProcess = spawn(
      "python3",
      ["-m", "http.server", String(port)],
      {
        cwd: gamesRoot,
        stdio: "pipe",
        detached: false,
      },
    );

    this.serverProcess.on("error", (err) => {
      logger.error("HTTP server process error:", err);
    });

    this.serverProcess.on("exit", (code) => {
      logger.info(`HTTP server exited with code ${code}`);
      this.serverProcess = null;
    });

    await this.waitForPort(port, 5000);
    logger.info(`[Process] persistent HTTP server started on port ${port} from games/ (pid: ${this.serverProcess.pid}, ${Date.now() - start}ms)`);

    return this.serverProcess.pid!;
  }

  async startGameServer(gameDir: string, port: number): Promise<number> {
    await this.killPort(port);

    const gamePath = path.join(PROJECT_ROOT, "games", gameDir);

    this.serverProcess = spawn(
      "python3",
      ["-m", "http.server", String(port)],
      {
        cwd: gamePath,
        stdio: "pipe",
        detached: false,
      },
    );

    this.serverProcess.on("error", (err) => {
      logger.error("HTTP server process error:", err);
    });

    await this.waitForPort(port, 5000);
    logger.info(`HTTP server started on port ${port} (pid: ${this.serverProcess.pid})`);

    return this.serverProcess.pid!;
  }

  isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  async stopGameServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill("SIGTERM");
      this.serverProcess = null;
      logger.info("HTTP server stopped");
    }
  }

  private async killPort(port: number): Promise<void> {
    // Safety check: only kill processes on managed ports
    if (!(MANAGED_PORTS as readonly number[]).includes(port)) {
      logger.debug(`Skipping killPort(${port}): not a managed port`);
      return;
    }

    try {
      const pidOutput = execSync(`lsof -t -i:${port} 2>/dev/null`)
        .toString()
        .trim();
      if (pidOutput) {
        const myPid = process.pid.toString();
        const pids = pidOutput.split("\n").filter(Boolean).filter((pid) => pid !== myPid);
        if (pids.length === 0) return;
        for (const pid of pids) {
          try {
            execSync(`kill ${pid} 2>/dev/null`);
          } catch {
            // Process may already be dead
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // No process on port
    }
  }

  private async waitForPort(port: number, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/`);
        if (resp.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Server did not start on port ${port}`);
  }
}
