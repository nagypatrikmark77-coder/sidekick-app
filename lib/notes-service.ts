import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export type Priority = 'low' | 'medium' | 'high';
export type Category = 'munka' | 'suli' | 'személyes' | 'egyéb';

export interface Project {
  id: string;
  name: string;
  color: string;
  category?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  category: Category;
  tags: string[];
  project_id: string | null;
  due_date: string | null;
  pinned: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface NoteAttachment {
  id: string;
  note_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// Notes CRUD
export const notesService = {
  // Get all notes for current user
  async getNotes(projectId?: string | null): Promise<Note[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

  // Get single note
  async getNote(id: string): Promise<Note | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

  // Create note
  async createNote(note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        ...note,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update note
  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>): Promise<Note> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete note
  async deleteNote(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Delete attachments first
    await attachmentsService.deleteNoteAttachments(id);

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  // Toggle pin
  async togglePin(id: string): Promise<Note> {
    const note = await this.getNote(id);
    if (!note) throw new Error('Note not found');

    return this.updateNote(id, { pinned: !note.pinned });
  },
};

// Projects CRUD
export const projectsService = {
  // Get all projects for current user
  async getProjects(): Promise<Project[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get single project
  async getProject(id: string): Promise<Project | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

  // Create project
  async createProject(project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...project,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update project
  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>): Promise<Project> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete project
  async deleteProject(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Remove project from notes
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

  // Get note count for project
  async getProjectNoteCount(projectId: string | null): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

// Attachments CRUD
export const attachmentsService = {
  // Get attachments for a note
  async getNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('note_attachments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Upload attachment
  async uploadAttachment(noteId: string, uri: string, fileName: string): Promise<NoteAttachment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Read file
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = fileName.split('.').pop();
    const filePath = `${session.user.id}/${noteId}/${Date.now()}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('note-attachments')
      .upload(filePath, blob, {
        contentType: blob.type,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('note-attachments')
      .getPublicUrl(filePath);

    // Create attachment record
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

  // Delete attachment
  async deleteAttachment(attachmentId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Get attachment to get file path
    const { data: attachment, error: fetchError } = await supabase
      .from('note_attachments')
      .select('file_path, note_id')
      .eq('id', attachmentId)
      .single();

    if (fetchError) throw fetchError;

    // Verify note belongs to user
    const note = await notesService.getNote(attachment.note_id);
    if (!note || note.user_id !== session.user.id) {
      throw new Error('Unauthorized');
    }

    // Delete from storage
    await supabase.storage
      .from('note-attachments')
      .remove([attachment.file_path]);

    // Delete record
    const { error } = await supabase
      .from('note_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) throw error;
  },

  // Delete all attachments for a note
  async deleteNoteAttachments(noteId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Get all attachments
    const attachments = await this.getNoteAttachments(noteId);

    // Delete from storage
    const filePaths = attachments.map(a => a.file_path);
    if (filePaths.length > 0) {
      await supabase.storage
        .from('note-attachments')
        .remove(filePaths);
    }

    // Delete records
    const { error } = await supabase
      .from('note_attachments')
      .delete()
      .eq('note_id', noteId);

    if (error) throw error;
  },

  // Get public URL for attachment
  getAttachmentUrl(filePath: string): string {
    const { data: { publicUrl } } = supabase.storage
      .from('note-attachments')
      .getPublicUrl(filePath);
    return publicUrl;
  },
};

// Image picker helper
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      return null;
    }
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
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}
