import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioRecorderOptions {
  /** Called for each chunk during recording. Fire-and-forget — return a Promise if async. */
  onChunk?: (sessionId: string, chunk: Blob, index: number) => Promise<void> | void;
  /** Interval in ms between ondataavailable events. Default 3000. */
  chunkInterval?: number;
}

export interface StopRecordingResult {
  blob: Blob;
  sessionId: string;
  /** True if every onChunk call resolved without error. */
  allChunksUploaded: boolean;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<StopRecordingResult>;
  error: string | null;
}

function getPreferredMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return "audio/mp4";
  }
  return "audio/webm";
}

function releaseStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export function useAudioRecorder(options?: AudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const pendingUploadsRef = useRef<Promise<void>[]>([]);
  const uploadFailedRef = useRef(false);
  const sessionIdRef = useRef<string>("");

  // Stable refs for options so callbacks don't go stale
  const onChunkRef = useRef(options?.onChunk);
  onChunkRef.current = options?.onChunk;
  const chunkInterval = options?.chunkInterval ?? 3000;

  // Cleanup on unmount: release mic if still recording
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      releaseStream(streamRef.current);
      streamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    pendingUploadsRef.current = [];
    uploadFailedRef.current = false;

    const newSessionId = crypto.randomUUID();
    sessionIdRef.current = newSessionId;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);

          // Fire onChunk callback if provided
          if (onChunkRef.current) {
            const index = chunkIndexRef.current++;
            const sid = sessionIdRef.current;
            const promise = Promise.resolve(onChunkRef.current(sid, e.data, index)).catch((err) => {
              console.warn(`Chunk ${index} upload failed:`, err);
              uploadFailedRef.current = true;
            });
            pendingUploadsRef.current.push(promise);
          }
        }
      };

      mediaRecorderRef.current = recorder;
      // Use timeslice to get periodic chunks for streaming upload
      recorder.start(chunkInterval);
      setIsRecording(true);
    } catch (err) {
      // Release stream if getUserMedia succeeded but MediaRecorder failed
      releaseStream(stream);
      streamRef.current = null;

      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access was denied. Please allow microphone access and try again.");
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone and try again.");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("An unexpected error occurred while accessing the microphone.");
      }
      throw err;
    }
  }, [chunkInterval]);

  const stopRecording = useCallback((): Promise<StopRecordingResult> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        reject(new Error("No active recording to stop."));
        return;
      }

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        releaseStream(streamRef.current);
        streamRef.current = null;

        // Wait for all pending chunk uploads to settle
        await Promise.allSettled(pendingUploadsRef.current);
        const allChunksUploaded = !uploadFailedRef.current && pendingUploadsRef.current.length > 0;
        pendingUploadsRef.current = [];

        setIsRecording(false);
        mediaRecorderRef.current = null;

        resolve({
          blob,
          sessionId: sessionIdRef.current,
          allChunksUploaded,
        });
      };

      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}
