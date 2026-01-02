import * as FileSystem from 'expo-file-system';
import { apiFetch } from './api';

export async function presignUpload({ fileName, mime, size }) {
  return apiFetch('/media/presign', {
    method: 'POST',
    body: JSON.stringify({ fileName, mime, size })
  });
}

export async function uploadToPresignedUrl({ uploadUrl, fileUri, mime }) {
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': mime }
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error('UPLOAD_FAILED');
  }
  return true;
}

export async function confirmUpload(mediaId) {
  return apiFetch('/media/confirm', {
    method: 'POST',
    body: JSON.stringify({ mediaId })
  });
}
