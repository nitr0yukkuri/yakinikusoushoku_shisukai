import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions, Animated, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ModalPropsを外して独自に定義します
interface PopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  sheetHeight?: number;
}

export const Popup: React.FC<PopupProps> = ({
  visible,
  onClose,
  title,
  message,
  children,
  icon = "notifications-outline",
  sheetHeight = SCREEN_HEIGHT * 0.7, // 高さ75%
}) => {
  const [isRendered, setIsRendered] = useState(false);
  
  // スライド用とフェード用の2つのアニメーションを準備
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // 表示：スライドインと背景のフェードインを同時に実行
      Animated.parallel([
        Animated.timing(translateY, {
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
      // 非表示：スライドアウトと背景のフェードアウトを同時に実行
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsRendered(false); // アニメーション完了後に完全に消す
      });
    }
  }, [visible]);

  // 開いていない時は何も描画しない
  if (!visible && !isRendered) return null;

  return (
    <View style={styles.absoluteContainer}>
      {/* 背景（オーバーレイ） */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      {/* ボトムシート本体 */}
      <Animated.View style={[styles.popupContainer, { height: sheetHeight, transform: [{ translateY }] }]}>
        
        {/* ドラッグハンドル */}
        <View style={styles.dragHandleWrapper}>
          <View style={styles.dragHandle} />
        </View>

        {/* ヘッダー領域 */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
              <Ionicons name={icon} size={26} color="#515151" />
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.headerRight}>
              <TouchableOpacity onPress={onClose} style={styles.closeXButton} activeOpacity={0.6}>
                <Ionicons name="close" size={28} color="#515151" />
              </TouchableOpacity>
          </View>
        </View>

        {/* コンテンツ領域 */}
        <View style={styles.contentContainer}>
          {message && <Text style={styles.message}>{message}</Text>}
          {children}
        </View>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    overflow: 'hidden', // フッター側にはみ出して表示されないようにする
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
  contentContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingBottom: 20 },
  message: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24 },
});