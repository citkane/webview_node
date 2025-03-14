/*
 * MIT License
 *
 * Copyright (c) 2025 Michael Jonker
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/*!
 * Compiled from "src/ts/lib/Ipc.ts"
 * Consult the Typescript source file for enhanced readability and comments.
 * Refer to the Typescript source file for licensing.
 */

const os = require("os");
const net = require("net");
const { fork } = require("node:child_process");
import { type libWv } from "./webview.js";

const SOCKET_PATH =
  process.env.SOCKET_PATH || os.platform() === "win32"
    ? "\\.\\pipe\\examplesock"
    : "/tmp/example.sock";

export class Ipc {
  private socketPath = SOCKET_PATH;
  private client!: typeof net.Socket;
  constructor() {}

  serve(wv: typeof libWv, w: bigint) {
    this.destroy(this.socketPath);
    const server: typeof net.Socket = net.createServer(
      (socket: typeof net.Socket) => {
        socket.on("data", dataHandler);
      }
    );
    server.listen(this.socketPath, () => {
      console.info(`Server is listening on ${this.socketPath}`);
    });

    function dataHandler(data: Buffer) {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line: string, i: number) => {
        const instruction = JSON.parse(line);
        const { command, args } = instruction;
        wv[command](w, ...args);
      });
    }
  }

  write(command: string, ...args: string[]) {
    if (!this.client) return;
    const json = JSON.stringify({ command, args });
    this.client.write(`${json}\n`);
  }
  makeClient(cbFn: () => void) {
    this.client = net.connect(this.socketPath, () => {
      console.info(`Client connected to server ${this.socketPath}`);
    });
    cbFn();
  }
  fork(fileName: string) {
    fork(fileName, ["spawn", this.socketPath]);
  }
  destroy(socketPath = this.socketPath) {
    if (os.platform !== "win32")
      try {
        require("fs").unlinkSync(socketPath);
      } catch {}
  }
}
