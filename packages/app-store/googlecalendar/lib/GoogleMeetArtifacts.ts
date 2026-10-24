import type { JWT, OAuth2Client } from "googleapis-common";

type GoogleAuthClient = OAuth2Client | JWT;
type MeetSpace = { name?: string };

const MEET_API_BASE_URL = "https://meet.googleapis.com/v2";
const ARTIFACT_CONFIG_UPDATE_MASK = [
  "config.artifactConfig.recordingConfig.autoRecordingGeneration",
  "config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration",
  "config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration",
].join(",");

const getMeetingCode = (hangoutLink: string): string => {
  const url = new URL(hangoutLink);
  if (url.protocol !== "https:" || url.hostname !== "meet.google.com") {
    throw new Error("Unexpected Google Meet URL");
  }

  const meetingCode = url.pathname.split("/").filter(Boolean)[0];
  if (!meetingCode || !/^[a-z0-9-]+$/.test(meetingCode)) {
    throw new Error("Google Meet URL has no valid meeting code");
  }
  return meetingCode;
};

export const enableAutomaticGoogleMeetArtifacts = async ({
  authClient,
  hangoutLink,
}: {
  authClient: GoogleAuthClient;
  hangoutLink: string;
}): Promise<void> => {
  const meetingCode = getMeetingCode(hangoutLink);
  const spaceResponse = await authClient.request<MeetSpace>({
    method: "GET",
    url: `${MEET_API_BASE_URL}/spaces/${meetingCode}`,
  });
  const spaceName = spaceResponse.data.name;
  if (!spaceName || !/^spaces\/[A-Za-z0-9_-]+$/.test(spaceName)) {
    throw new Error("Google Meet API returned no valid space name");
  }

  await authClient.request({
    method: "PATCH",
    url: `${MEET_API_BASE_URL}/${spaceName}?updateMask=${encodeURIComponent(ARTIFACT_CONFIG_UPDATE_MASK)}`,
    data: {
      config: {
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "ON" },
          transcriptionConfig: { autoTranscriptionGeneration: "ON" },
          smartNotesConfig: { autoSmartNotesGeneration: "ON" },
        },
      },
    },
  });
};
