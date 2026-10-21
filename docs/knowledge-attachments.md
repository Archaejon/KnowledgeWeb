# Files, voice notes and transcription

Knowledge records can carry files of any format and, for text records, a recorded
voice note. This document describes what is stored, where it lives, what it
inherits, and how the optional transcription boundary works.

## What a record can hold

| Limit | Value |
| --- | --- |
| One file or recording | 1.5 MB |
| All attachments on one record | 2.5 MB, 6 items |
| All attachments on the node | 3 MB |

Limits are checked before anything is written, both in the editor and in the node
service, so a rejected file never reaches storage. Counts, totals and the current
usage are shown in the editor as items are added.

Any MIME type is accepted. There is no server-side allow-list because there is no
server: the browser reads the file and stores it. That also means there is no
virus scanning, transcoding or preview pipeline. A file is downloadable exactly as
it was attached.

## Where the bytes live

Attachment bytes are base64 data URLs inside the knowledge record. The record is
part of the node's JSON state, which means:

- a JSON backup contains every attachment, so one file restores the whole node;
- a record cannot be deleted while leaving orphaned bytes behind;
- base64 adds about a third to the stored size, which is why the node cap is
  below the usual 5 MB `localStorage` quota;
- large media is not streamed. A 1.5 MB file is parsed with the rest of the node
  on every load.

If storage is full anyway (for example, another tab wrote first), the store keeps
the change in memory and the existing storage banner says it could not be saved.
Export a backup before that happens.

## Sharing

An attachment has no scope of its own. It is exactly as readable as its record:
private, relationship-shared, group-shared or public. Removing a file updates the
record and is recorded in version history like any other edit to the record, but
the previous bytes are not retained in the version list.

Downloading creates a copy outside the node's control. The detail page says so
next to the files, and the Markdown export lists file names and transcripts while
noting that the files themselves live in the node.

Audio is personal data. The editor and detail page both note that everyone who
can be heard must have agreed to be recorded, and that the sharing scope applies
to the recording itself.

## Voice notes

- Capture uses `MediaRecorder` and `getUserMedia`. Chromium and Firefox record
  `audio/webm;codecs=opus`; Safari records `audio/mp4`.
- Recording is capped at ten minutes and stops automatically. The microphone is
  released as soon as recording stops or is discarded.
- A recording is added to the draft only after it has been stored, and it is
  persisted when the record is saved. Cancelling the editor discards a new
  recording.
- The detail page plays recordings inline and offers a download.
- If the browser has no `MediaRecorder`, the editor says so and still accepts an
  audio file through the normal file picker.
- Permission denial, a missing microphone and recorder failures are reported in
  place, without losing the rest of the draft.

## Transcription

Transcription is optional and off by default. It is a separate capability from
the question-answering assistant: a local speech model is needed.

Configure it under **Node settings → Optional AI**:

- `Transcription endpoint`: the full OpenAI-compatible audio route, for example
  `http://127.0.0.1:8080/v1/audio/transcriptions` from whisper.cpp's server.
- `Transcription model`: the model id that service expects.

The capability is offered only when the optional AI adapter is enabled, both
fields are set, and the endpoint is a valid `http` or `https` URL. When it is not
configured, the Transcribe button is disabled and states the reason with a link to
settings.

When an author presses Transcribe, the app:

1. reads the selected recording from the record;
2. posts it as multipart form data with the configured model and
   `response_format=json`;
3. stores the returned text on that attachment with the provider, model and time.

Nothing is transcribed automatically. Only the author may add a transcript,
because a transcript becomes readable text on a shared record. A second run
replaces the stored transcript. The transcript appears under the recording, is
included in the Markdown export, is matched by knowledge search, and is included
in the AI assistant's context for readers who can already read the record.

### Failure modes

| Situation | What happens |
| --- | --- |
| No endpoint or model | Transcribe is disabled with an explanation |
| Assistant disabled | Transcribe is disabled; the recording stays untouched |
| Service unreachable | "Could not reach the speech-to-text service…" |
| CORS not allowed | Same message; the service must allow this browser origin |
| Non-2xx answer | HTTP status is shown with a pointer to the endpoint, model and CORS |
| Timeout | Bounded by the AI timeout, with a 60 s floor for audio |
| Empty result | Reported; nothing is stored |

Only the selected recording is sent, only to the configured endpoint. A local
endpoint keeps the audio on the machine; a remote URL would not, so the settings
panel says so explicitly.

## What this is not

- No bundled speech model, no automatic transcription queue, no batch runs.
- No speaker labels, language selection, timestamps or transcript editing.
- No chunking for recordings longer than the ten-minute capture limit.
- No per-file permissions, previews, thumbnails or media streaming.
- No virus scanning or content moderation.
- AI answer quality still depends on the configured local model; transcripts are
  text, not verified facts.

## Testing

The end-to-end probe uses a fake audio device:

```bash
# separate Chromium with a CDP port and a fake microphone
chrome --headless=new --remote-debugging-port=9223 \
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
  --user-data-dir=.tooling/chrome-voice-profile about:blank

node .tooling/probe-knowledge-files.mjs
```

It covers two uploads in different formats, a real `MediaRecorder` capture,
attachment limits, persistence across reloads, download links, the disabled
transcription state, a transcription against a stubbed local endpoint, transcript
persistence, the real Markdown download, removing a file through the editor,
axe-core on the detail page and the open editor, and cleanup. It prints 25
checks and exits non-zero on failure.
