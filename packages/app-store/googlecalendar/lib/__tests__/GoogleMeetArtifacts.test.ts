import { describe, expect, it, vi } from "vitest";
import { enableAutomaticGoogleMeetArtifacts } from "../GoogleMeetArtifacts";

describe("enableAutomaticGoogleMeetArtifacts", () => {
  it("enables recording, transcription, and smart notes on a Calendar-created Meet space", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { name: "spaces/space_123" } })
      .mockResolvedValueOnce({ data: {} });

    await enableAutomaticGoogleMeetArtifacts({
      authClient: { request } as never,
      hangoutLink: "https://meet.google.com/abc-defg-hij",
    });

    expect(request).toHaveBeenNthCalledWith(1, {
      method: "GET",
      url: "https://meet.googleapis.com/v2/spaces/abc-defg-hij",
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: "PATCH",
        data: {
          config: {
            artifactConfig: {
              recordingConfig: { autoRecordingGeneration: "ON" },
              transcriptionConfig: { autoTranscriptionGeneration: "ON" },
              smartNotesConfig: { autoSmartNotesGeneration: "ON" },
            },
          },
        },
      })
    );
  });

  it("rejects non-Google Meet URLs before making an API request", async () => {
    const request = vi.fn();

    await expect(
      enableAutomaticGoogleMeetArtifacts({
        authClient: { request } as never,
        hangoutLink: "https://example.com/abc-defg-hij",
      })
    ).rejects.toThrow("Unexpected Google Meet URL");
    expect(request).not.toHaveBeenCalled();
  });
});
