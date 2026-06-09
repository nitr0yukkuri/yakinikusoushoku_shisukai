import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ModalProps, Platform } from 'react-native';
// アイコンを使用するために Ionicons をインポート
import { Ionicons } from '@expo/vector-icons'; 

interface PopupProps extends ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap; // 左上のアイコンを自由に変えられるようにProps化（デフォルトは通知アイコン）
}

export const Popup: React.FC<PopupProps> = ({
  visible,
  onClose,
  title,
  message,
  children,
  icon = "notifications-outline", // デフォルトのアイコン指定
  ...props
}) => {
  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      {...props}
    >
      <View style={styles.overlay}>
        <View style={styles.popupContainer}>
          
          {/* 【新設】ヘッダー領域：左側にアイコン、右側に×ボタン */}
          <View style={styles.headerContainer}>
            {/* デザインや色合い（#515151）を変えずに左上に配置 */}
            <Ionicons name={icon} size={26} color="#515151" />
            
            {/* 右上の×ボタン */}
            <TouchableOpacity onPress={onClose} style={styles.closeXButton} activeOpacity={0.6}>
              <Ionicons name="close" size={28} color="#515151" />
            </TouchableOpacity>
          </View>

          {/* コンテンツ表示領域 */}
          <View style={styles.contentContainer}>
            {title && <Text style={styles.title}>{title}</Text>}
            {message && <Text style={styles.message}>{message}</Text>}
            
            {/* ボタン以外の追加コンテンツ（画像など）があればここに表示されます */}
            {children}
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // 背景の暗転
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popupContainer: {
    width: '80%',
    height: '55%', // 縦長にするために高さを明示的に指定
    backgroundColor: '#e2fbe2', // 背景を薄緑色に変更
    borderRadius: 20,
    padding: 20,
    // 影の設定（Web警告対策済み）
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.15)' as any,
      },
    }),
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 40,
  },
  closeXButton: {
    padding: 4, // タップしやすくするための押し幅
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // 文字やコンテンツを上下中央に配置
    width: '100%',
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
    color: '#333',
  },
  message: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    horizontalAlign: 'center',
  },
});