import { createTempDir, downloadFile, runFfmpeg } from "../_lib/videoLib.js";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { project, scenes } = req.body;

  if (!project || !scenes || !scenes.length) {
    return res.status(400).json({ error: "Missing project or scenes" });
  }

  const tmpDir = createTempDir();
  const videoFiles = [];
  const audioFile = path.join(tmpDir, "narration.mp3");

  try {
    // 1. Download audio if exists
    if (project.voiceAudioUrl) {
      await downloadFile(project.voiceAudioUrl, audioFile);
    }

    // 2. Download scene videos
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (scene.runwayVideoUrl) {
            const videoPath = path.join(tmpDir, `scene_${i}.mp4`);
            await downloadFile(scene.runwayVideoUrl, videoPath);
            videoFiles.push(videoPath);
        }
    }

    if (videoFiles.length === 0) {
        return res.status(400).json({ error: "No video clips found in scenes" });
    }

    // 3. Create concat file for FFmpeg
    const concatFilePath = path.join(tmpDir, "concat.txt");
    const concatContent = videoFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(concatFilePath, concatContent);

    // 4. Run FFmpeg to merge videos and add audio
    const outputFileName = `merged_${Date.now()}.webm`;
    // We'll save it to a public-ish folder if possible, but since we are local, 
    // we can just return a path or stream it.
    // For now, let's stream it back or save to dist.
    const outputPath = path.join(tmpDir, outputFileName);

    const ffmpegArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFilePath,
    ];

    if (fs.existsSync(audioFile)) {
        ffmpegArgs.push("-i", audioFile);
        ffmpegArgs.push("-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus", "-shortest");
    } else {
        ffmpegArgs.push("-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0");
    }

    ffmpegArgs.push(outputPath);

    await runFfmpeg(ffmpegArgs);

    // 5. Read merged video and send back
    const videoData = fs.readFileSync(outputPath);
    
    // In a real app we would upload to storage, but here we'll send it as base64 or a stream
    // Since we are in a Vercel-like handler, base64 is safer for the response JSON
    res.status(200).json({
      ok: true,
      videoBase64: videoData.toString("base64"),
      mimeType: "video/webm",
      fileName: `${project.scriptTitle.substring(0, 30)}.webm`
    });

  } catch (error) {
    console.error("Merge failed:", error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cleanup - we should probably keep it until sent, but readFileSync handles it
    // fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
