import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppMap } from '../components/AppMap';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';

export default function HomeScreen() {
  const [isPopupVisible, setPopupVisible] = useState(false);

  return (
    <View style={styles.container}>
      <AppMap style={styles.map} />

      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <View style={styles.contentWrapper} pointerEvents="box-none">
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/Matsunya_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <TouchableOpacity style={styles.iconContainer}>
              <Ionicons name="person" size={26} color="#2330df" />
            </TouchableOpacity>
          </View>

          <View style={styles.mainContent} pointerEvents="none" />

          <Popup
            visible={isPopupVisible}
            onClose={() => setPopupVisible(false)}
            title="通知"
            message="新着の通知はありません。"
          />
        </View>

        <View style={styles.footerWrapper}>
          <Footer onPressNotification={() => setPopupVisible(true)} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  footerWrapper: {
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  logoImage: {
    width: 220,
    height: 60,
  },
  iconContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#515151',
  },
  mainContent: {
    flex: 1,
  },
});