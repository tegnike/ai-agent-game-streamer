import { execSync, spawn, type ChildProcess } from "node:child_process";
import { logger } from "./logger.js";

export type BrowserMode = "daemon" | "cdp" | "none";

export interface BrowserState {
  mode: BrowserMode;
  running: boolean;
  cdpPort?: number;
  launchedByUs: boolean;
}

export class BrowserManager {
  private state: BrowserState = {
    mode: "none",
    running: false,
    launchedByUs: false,
  };

  private daemonProcess: ChildProcess | null = null;

  /**
   * Detect if agent-browser daemon is already running.
   * Uses `agent-browser get url` which returns the current URL if active.
   */
  async detectRunning(): Promise<boolean> {
    try {
      const result = execSync("agent-browser get url", {
        timeout: 5000,
        stdio: "pipe",
      })
        .toString()
        .trim();

      if (result && !result.includes("Error") && !result.includes("error")) {
        this.state = {
          mode: "daemon",
          running: true,
          launchedByUs: false,
        };
        logger.info(`Detected running browser at: ${result}`);
        return true;
      }
    } catch {
      // Not running
    }

    return false;
  }

  /**
   * Launch browser via agent-browser daemon mode.
   * Starts a headed browser and navigates to the given URL.
   */
  async launchDaemon(url: string): Promise<void> {
    // Kill ALL stale daemon processes (agent-browser close only closes one)
    await this.killAllStaleBrowsers();

    logger.info(`Launching browser: ${url}`);

    this.daemonProcess = spawn("agent-browser", ["--headed", "open", url], {
      stdio: "ignore",
      detached: false,
    });

    this.daemonProcess.on("error", (err) => {
      logger.error("Browser daemon process error:", err);
    });

    // Wait for browser to be ready
    await this.waitForBrowser(10000);

    this.state = {
      mode: "daemon",
      running: true,
      launchedByUs: true,
    };

    // Wait for daemon to fully initialize before navigating
    await new Promise((r) => setTimeout(r, 2000));

    // Ensure the target URL is loaded (daemon startup may leave browser on about:blank)
    await this.ensureNavigation(url);

    logger.info("Browser launched successfully");
  }

  /**
   * Navigate and verify the browser loaded the target URL.
   * Retries up to maxRetries times with delay between attempts.
   */
  private async ensureNavigation(url: string, maxRetries = 5): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const currentUrl = execSync("agent-browser get url", {
          timeout: 5000,
          stdio: "pipe",
        }).toString().trim();

        if (currentUrl === url) {
          logger.info(`Browser navigated to target URL`);
          return;
        }

        logger.info(`Navigation attempt ${attempt}/${maxRetries} (current: ${currentUrl})`);
        execSync(`agent-browser open "${url}"`, { timeout: 15000, stdio: "pipe" });

        // Wait for page load
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        logger.error(`Navigation attempt ${attempt} failed:`, err);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Final check - throw error if still not on target URL
    const finalUrl = execSync("agent-browser get url", { timeout: 5000, stdio: "pipe" }).toString().trim();
    if (finalUrl !== url) {
      throw new Error(`Browser navigation failed. Current: ${finalUrl}, expected: ${url}`);
    }
  }

  /**
   * Kill ALL stale agent-browser daemons and Chromium instances.
   */
  private async killAllStaleBrowsers(): Promise<void> {
    // 1. Try graceful close
    try {
      execSync("agent-browser close", { timeout: 5000, stdio: "pipe" });
    } catch {
      // No daemon running
    }

    // 2. Kill ALL daemon processes (pattern matches actual process path)
    try {
      execSync("pkill -f 'dist/daemon.js'", { timeout: 5000, stdio: "pipe" });
    } catch {
      // No processes
    }

    // 3. Kill Playwright Chromium instances
    try {
      execSync("pkill -f 'playwright_chromiumdev_profile'", { timeout: 5000, stdio: "pipe" });
    } catch {
      // No processes
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  /**
   * Connect to an external browser via Chrome DevTools Protocol.
   */
  async connectCDP(port: number): Promise<void> {
    logger.info(`Connecting to browser via CDP on port ${port}...`);

    try {
      const result = execSync(`agent-browser --cdp ${port} get url`, {
        timeout: 10000,
        stdio: "pipe",
      })
        .toString()
        .trim();

      this.state = {
        mode: "cdp",
        running: true,
        cdpPort: port,
        launchedByUs: false,
      };

      logger.info(`Connected to CDP browser at: ${result}`);
    } catch (err) {
      throw new Error(`Failed to connect via CDP on port ${port}: ${err}`);
    }
  }

  /**
   * Navigate to a URL in the running browser.
   */
  async navigate(url: string): Promise<void> {
    if (!this.state.running) {
      logger.info("Browser not running, cannot navigate");
      return;
    }

    const cmd =
      this.state.mode === "cdp"
        ? `agent-browser --cdp ${this.state.cdpPort} open "${url}"`
        : `agent-browser open "${url}"`;

    try {
      execSync(cmd, { timeout: 15000, stdio: "pipe" });
      logger.info(`Navigated to: ${url}`);
    } catch (err) {
      logger.error(`Failed to navigate to ${url}:`, err);
      // Check if browser is still running
      const isAlive = await this.detectRunning();
      if (!isAlive) {
        this.state = { mode: "none", running: false, launchedByUs: false };
      }
    }
  }

  /**
   * Close the browser. Only closes if we launched it.
   */
  async close(): Promise<void> {
    if (!this.state.running) return;

    if (!this.state.launchedByUs) {
      logger.info("Browser was launched externally, skipping close");
      this.state = { mode: "none", running: false, launchedByUs: false };
      return;
    }

    logger.info("Closing browser...");
    await this.killAllStaleBrowsers();

    if (this.daemonProcess) {
      this.daemonProcess.kill("SIGTERM");
      this.daemonProcess = null;
    }

    this.state = { mode: "none", running: false, launchedByUs: false };
    logger.info("Browser closed");
  }

  /**
   * Get the current browser state.
   */
  getState(): BrowserState {
    return { ...this.state };
  }

  /**
   * Get the command prefix for agent-browser commands in agent prompts.
   * Returns "" for daemon mode (auto-connects), "--cdp <port>" for CDP mode.
   */
  getAgentBrowserPrefix(): string {
    if (this.state.mode === "cdp" && this.state.cdpPort) {
      return `--cdp ${this.state.cdpPort}`;
    }
    return "";
  }

  /**
   * Wait for the browser daemon to become responsive.
   */
  private async waitForBrowser(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        execSync("agent-browser get url", { timeout: 3000, stdio: "pipe" });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw new Error("Browser did not start within timeout");
  }
}
