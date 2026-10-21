import { useEffect, useRef, useState } from 'react';
import {
  ATTACHMENT_LIMITS,
  formatBytes,
  formatDuration,
  recordingToAttachment,
} from '../core/attachments';
import type { KnowledgeAttachment } from '../core/types';
import { Button } from './ui';
import { Icon } from './Icon';

type RecorderState = 'idle' | 'requesting' | 'recording' | 'saving';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function supportedMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((mime) =>
    typeof MediaRecorder.isTypeSupported === 'function'
      ? MediaRecorder.isTypeSupported(mime)
      : false,
  );
}

/**
 * Records a short voice note with the browser's MediaRecorder and hands the
 * result back as an attachment. Nothing leaves the browser during recording.
 * The microphone is released as soon as recording stops.
 */
export function VoiceRecorder({
  onRecorded,
  disabled = false,
  maxSeconds = ATTACHMENT_LIMITS.maxRecordingSeconds,
}: {
  onRecorded: (attachment: KnowledgeAttachment) => void | Promise<void>;
  disabled?: boolean;
  maxSeconds?: number;
}) {
  const supported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const stopRef = useRef<() => void>(() => {});

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };
  stopRef.current = stop;

  useEffect(
    () => () => {
      discardRef.current = true;
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseStream();
    },
    [],
  );

  const start = async () => {
    setError('');
    setStatus('');
    setSeconds(0);
    secondsRef.current = 0;
    discardRef.current = false;
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = supportedMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('The recording stopped unexpectedly. Nothing was added.');
        clearTimer();
        releaseStream();
        setState('idle');
      };
      recorder.onstop = async () => {
        clearTimer();
        releaseStream();
        const duration = Math.max(0.4, (Date.now() - startedAtRef.current) / 1000);
        const discarded = discardRef.current;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        recorderRef.current = null;
        if (discarded || blob.size === 0) {
          setState('idle');
          setSeconds(0);
          return;
        }
        setState('saving');
        try {
          const attachment = await recordingToAttachment(blob, duration);
          await onRecorded(attachment);
          setStatus(`Voice note recorded: ${formatDuration(attachment.durationSeconds)} (${formatBytes(attachment.size)}).`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The recording could not be stored.');
        } finally {
          setState('idle');
          setSeconds(0);
          secondsRef.current = 0;
        }
      };

      startedAtRef.current = Date.now();
      recorder.start(1000);
      setState('recording');
      setStatus('Recording. Speak close to the microphone.');
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        secondsRef.current = elapsed;
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) stopRef.current();
      }, 250);
    } catch (err) {
      releaseStream();
      setState('idle');
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the browser, or add the recording later.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'The microphone could not be started. Check browser permissions.',
      );
    }
  };

  const discard = () => {
    discardRef.current = true;
    stop();
    setStatus('Recording discarded. Nothing was added.');
    setSeconds(0);
  };

  if (!supported) {
    return (
      <p className="voice-recorder-note">
        This browser cannot record audio here. MediaRecorder and microphone access are required;
        you can still attach an audio file above.
      </p>
    );
  }

  return (
    <div className={`voice-recorder voice-recorder-${state}`}>
      <div className="voice-recorder-controls">
        {state === 'recording' ? (
          <>
            <span className="recording-dot" aria-hidden="true" />
            <span className="recorder-timer" aria-hidden="true">
              {formatDuration(seconds)}
            </span>
            <Button size="sm" icon="check" onClick={stop}>
              Stop and keep
            </Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={discard}>
              Discard
            </Button>
            <span className="muted tiny">
              Max {formatDuration(maxSeconds)}
            </span>
          </>
        ) : (
          <Button
            size="sm"
            icon="mic"
            onClick={() => void start()}
            disabled={disabled || state !== 'idle'}
          >
            {state === 'requesting'
              ? 'Waiting for the microphone…'
              : state === 'saving'
                ? 'Storing recording…'
                : 'Record a voice note'}
          </Button>
        )}
      </div>
      <p className="voice-recorder-hint">
        Audio is stored with this record and follows its sharing scope. It is never uploaded unless
        you configure a local speech service and press Transcribe.
      </p>
      <div className="voice-recorder-status" role="status" aria-live="polite">
        {status}
      </div>
      {error ? (
        <p className="field-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : null}
    </div>
  );
}
