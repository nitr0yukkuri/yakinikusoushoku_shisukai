import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';

import { getAvatarInitials } from '../utils/avatar';

type ProfileAvatarProps = {
  name?: string;
  profileImage?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
};

export function ProfileAvatar({ name, profileImage, size, style }: ProfileAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (profileImage && failedSource !== profileImage) {
    return (
      <Image
        source={{ uri: profileImage }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        resizeMode="cover"
        onError={() => setFailedSource(profileImage)}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#208AEF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: Math.round(size * 0.38),
          fontWeight: '700',
        }}
      >
        {getAvatarInitials(name)}
      </Text>
    </View>
  );
}
