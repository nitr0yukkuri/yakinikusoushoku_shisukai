import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions, Animated, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 🌟 追加：現在開いているポップアップの onClose を保持する変数
let activePopupClose: (() => void) | null = null;

interface PopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  sheetHeight?: number;
  slideDirection?: 'bottom' | 'right';
  showBackButton?: boolean;
}

export const Popup: React.FC<PopupProps> = ({
  visible,
  onClose,
  title,
  message,
  children,
  icon = "notifications-outline",
  sheetHeight = SCREEN_HEIGHT * 0.75,
  slideDirection = 'bottom',
  showBackButton = false,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  
  const translateAnim = useRef(new Animated.Value(slideDirection === 'right' ? SCREEN_WIDTH : SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // 🌟 追加：もし別のポップアップが開いていたら、そちらの onClose を発火させて閉じる
      if (slideDirection !== 'right' && activePopupClose && activePopupClose !== onClose) {
        activePopupClose();
      }
      // 🌟 追加：自分自身を「現在開いているポップアップ」として登録
      if (slideDirection !== 'right') {
        activePopupClose = onClose;
      }

      setIsRendered(true);
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // 🌟 追加：自分が閉じられる時は、登録を解除する
      if (activePopupClose === onClose) {
        activePopupClose = null;
      }

      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: slideDirection === 'right' ? SCREEN_WIDTH : SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible, onClose]); // onClose を依存配列に追加

  if (!visible && !isRendered) return null;

  return (
    <View style={styles.absoluteContainer}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.popupContainer, { 
        height: sheetHeight, 
        transform: [ slideDirection === 'right' ? { translateX: translateAnim } : { translateY: translateAnim } ] 
      }]}>
        
        <View style={styles.dragHandleWrapper}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {showBackButton ? (
              <TouchableOpacity onPress={onClose} style={styles.closeXButton} activeOpacity={0.6}>
                <Ionicons name="arrow-back" size={28} color="#515151" />
              </TouchableOpacity>
            ) : (
              <Ionicons name={icon} size={26} color="#515151" />
            )}
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.headerRight}>
            {!showBackButton && (
              <TouchableOpacity onPress={onClose} style={styles.closeXButton} activeOpacity={0.6}>
                <Ionicons name="close" size={28} color="#515151" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {message && <Text style={styles.message}>{message}</Text>}
          {children}
        </ScrollView>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popupContainer: {
    width: '100%',
    backgroundColor: '#e2fbe2',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: { elevation: 10 },
      web: { boxShadow: '0px -3px 6px rgba(0, 0, 0, 0.15)' as any },
    }),
  },
  dragHandleWrapper: { alignItems: 'center', width: '100%', paddingBottom: 10 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#cccccc', borderRadius: 2.5 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: 45, paddingHorizontal: 4 },
  headerLeft: { width: 40, alignItems: 'flex-start' },
  headerRight: { width: 40, alignItems: 'flex-end' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', flex: 1 },
  closeXButton: { padding: 4 },
  contentContainer: { flex: 1, width: '100%' },
  contentInner: { alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 20 },
  message: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24 },
});
