import type { ImagePickerAsset } from 'expo-image-picker';

export function getPersistableProfileImage(asset: ImagePickerAsset) {
  if (asset.base64) {
    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  }
  return asset.uri;
}
