import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppMap } from '../components/AppMap';
import { Footer } from '../components/Footer';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <AppMap style={styles.map} />
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
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

        <Footer />
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
