import { Audio } from 'expo-av';
import { supabaseUrl, supabaseAnonKey } from './supabase';

const TRANSCRIPTION_TIMEOUT = 30000;

export async function startRecording(): Promise<Audio.Recording> {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });

  const uri = recording.getURI();
  if (!uri) {
    throw new Error('NO_AUDIO');
  }

  return uri;
}

export async function transcribeAudio(audioUri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT);

    console.log('[voice-service] URL:', `${supabaseUrl}/functions/v1/speech-to-text`);
    console.log('[voice-service] apikey first 20 chars:', supabaseAnonKey?.substring(0, 20));
    console.log('[voice-service] apikey length:', supabaseAnonKey?.length);

    const response = await fetch(`${supabaseUrl}/functions/v1/speech-to-text`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Transcription failed');
    }

    return data.text || null;
  } catch (error) {
    console.error('[voice-service] Error:', error);
    return null;
  }
}
