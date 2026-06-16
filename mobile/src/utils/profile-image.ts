import type { ImagePickerAsset } from 'expo-image-picker';

export function getPersistableProfileImage(asset: ImagePickerAsset): string | null {
  if (asset.base64) {
    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  }
  return null;
}

export function getProfileImageSignature(profileImage?: string | null) {
  if (!profileImage) return 'none';

  let hash = 0;
  for (let index = 0; index < profileImage.length; index += 1) {
    hash = Math.imul(31, hash) + profileImage.charCodeAt(index);
    hash |= 0;
  }
  return `${profileImage.length}:${hash.toString(36)}`;
}
