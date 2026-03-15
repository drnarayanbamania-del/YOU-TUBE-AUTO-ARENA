import fs from "fs";
import path from "path";
import https from "https";
import { spawn } from "child_process";
import os from "os";

export async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export async function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log("Running ffmpeg", args.join(" "));
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
  });
}

export function createTempDir() {
  const tmpBase = path.join(os.tmpdir(), "ai-video-factory");
  if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
  const dir = path.join(tmpBase, Math.random().toString(36).substring(2, 11));
  fs.mkdirSync(dir);
  return dir;
}
