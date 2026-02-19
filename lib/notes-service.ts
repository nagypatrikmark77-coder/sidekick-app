import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import type { Note, NoteAttachment, Project, Priority, NoteCategory } from '@/types/database';

// Re-export types for convenience
export type { Note, NoteAttachment, Project, Priority, NoteCategory } from '@/types/database';
export type Category = NoteCategory;

// ── Shared auth helper ────────────────────────────────────────────────────────

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

// ── Notes CRUD ────────────────────────────────────────────────────────────────

export const notesService = {
  async getNotes(projectId?: string | null): Promise<Note[]> {
    const session = await getSession();

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (projectId !== undefined) {
      if (projectId === null) {
        query = query.is('project_id', null);
      } else {
        query = query.eq('project_id', projectId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getNote(id: string): Promise<Note | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async createNote(note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('notes')
      .insert({ ...note, user_id: session.user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>): Promise<Note> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteNote(id: string): Promise<void> {
    const session = await getSession();

    await attachmentsService.deleteNoteAttachments(id);

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  async togglePin(id: string): Promise<Note> {
    const note = await this.getNote(id);
    if (!note) throw new Error('Note not found');
    return this.updateNote(id, { pinned: !note.pinned });
  },
};

// ── Projects CRUD ─────────────────────────────────────────────────────────────

export const projectsService = {
  async getProjects(): Promise<Project[]> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getProject(id: string): Promise<Project | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async createProject(project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...project, user_id: session.user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>): Promise<Project> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProject(id: string): Promise<void> {
    const session = await getSession();

    await supabase
      .from('notes')
      .update({ project_id: null })
      .eq('project_id', id)
      .eq('user_id', session.user.id);

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  async getProjectNoteCount(projectId: string | null): Promise<number> {
    const session = await getSession();

    let query = supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (projectId === null) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },
};

// ── Attachments ───────────────────────────────────────────────────────────────

export const attachmentsService = {
  async getNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
    await getSession();

    const { data, error } = await supabase
      .from('note_attachments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async uploadAttachment(noteId: string, uri: string, fileName: string): Promise<NoteAttachment> {
    const session = await getSession();

    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = fileName.split('.').pop();
    const filePath = `${session.user.id}/${noteId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('note-attachments')
      .upload(filePath, blob, { contentType: blob.type });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('note_attachments')
      .insert({
        note_id: noteId,
        file_path: filePath,
        file_name: fileName,
        file_size: blob.size,
        mime_type: blob.type,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    const session = await getSession();

    const { data: attachment, error: fetchError } = await supabase
      .from('note_attachments')
      .select('file_path, note_id')
      .eq('id', attachmentId)
      .single();

    if (fetchError) throw fetchError;

    const note = await notesService.getNote(attachment.note_id);
    if (!note || note.user_id !== session.user.id) {
      throw new Error('Unauthorized');
    }

    await supabase.storage
      .from('note-attachments')
      .remove([attachment.file_path]);

    const { error } = await supabase
      .from('note_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) throw error;
  },

  async deleteNoteAttachments(noteId: string): Promise<void> {
    await getSession();

    const attachments = await this.getNoteAttachments(noteId);

    const filePaths = attachments.map(a => a.file_path);
    if (filePaths.length > 0) {
      await supabase.storage.from('note-attachments').remove(filePaths);
    }

    const { error } = await supabase
      .from('note_attachments')
      .delete()
      .eq('note_id', noteId);

    if (error) throw error;
  },

  getAttachmentUrl(filePath: string): string {
    const { data: { publicUrl } } = supabase.storage
      .from('note-attachments')
      .getPublicUrl(filePath);
    return publicUrl;
  },
};

// ── Image picker helpers ──────────────────────────────────────────────────────

export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}
