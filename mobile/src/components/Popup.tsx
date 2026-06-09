import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ModalProps, Platform } from 'react-native';

interface PopupProps extends ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: React.ReactNode;
}

export const Popup: React.FC<PopupProps> = ({
  visible,
  onClose,
  title,
  message,
  children,
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
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}
          
          {children}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, // flex: 1の代わりに、画面全体を確実に覆う設定
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Webで他の要素の裏に隠れないように最前面に設定
  },
  popupContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    // 端末（OS）ごとに影の出し方を分けることで警告を消す
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)' as any,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#ff6347',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});