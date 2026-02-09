import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { dirname } from "node:path";

export const logger = {
  info: (...args: unknown[]) =>
    console.log(`[${new Date().toISOString()}] [INFO]`, ...args),
  warn: (...args: unknown[]) =>
    console.warn(`[${new Date().toISOString()}] [WARN]`, ...args),
  error: (...args: unknown[]) =>
    console.error(`[${new Date().toISOString()}] [ERROR]`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.log(`[${new Date().toISOString()}] [DEBUG]`, ...args);
    }
  },
};

export class GameLogger {
  private stream: WriteStream;
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.stream = createWriteStream(filePath, { flags: "a" });
  }

  /** ファイルのみに書き込む（stdoutには書かない） */
  write(text: string): void {
    this.stream.write(text);
  }

  /** タイムスタンプ付きでファイルに書き込む */
  log(message: string): void {
    this.stream.write(`[${new Date().toISOString()}] ${message}\n`);
  }

  close(): void {
    this.stream.end();
  }
}

export function createGameLogPath(gameName: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `logs/${date}-${time}_${gameName}.log`;
}
