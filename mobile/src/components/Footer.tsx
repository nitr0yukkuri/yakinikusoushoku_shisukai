import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FooterProps {
  onPressFriend?: () => void;      // ★ここを変更！
  onPressNotification?: () => void;
  onPressCalendar?: () => void;
  onPressSettings?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onPressFriend,
  onPressNotification,
  onPressCalendar,
  onPressSettings,
}) => {
  return (
    <View style={styles.footerContainer}>
      {/* 1. フレンド */}
      <TouchableOpacity style={styles.tab} onPress={onPressFriend}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add-outline" size={26} color="#515151" />
        </View>
        <Text style={styles.tabText}>フレンド</Text>
      </TouchableOpacity>

      {/* 2. カレンダー */}
      <TouchableOpacity style={styles.tab} onPress={onPressCalendar}>
        <View style={styles.iconContainer}>
          <Ionicons name="calendar-outline" size={26} color="#515151" />
        </View>
        <Text style={styles.tabText}>カレンダー</Text>
      </TouchableOpacity>

      {/* 3. 暇つぶしスポット */}
      <TouchableOpacity style={styles.tab}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="cafe-outline"
            size={29}
            color="#515151"
            style={{ transform: [{ translateY: 5 }] }}
          />
        </View>
        <Text style={styles.tabText}>スポット</Text>
      </TouchableOpacity>

      {/* 4. 通知 */}
      <TouchableOpacity style={styles.tab} onPress={onPressNotification}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications-outline" size={26} color="#515151" />
        </View>
        <Text style={styles.tabText}>通知</Text>
      </TouchableOpacity>

      {/* 5. 設定 */}
      <TouchableOpacity style={styles.tab} onPress={onPressSettings}>
        <View style={styles.iconContainer}>
          <Ionicons name="settings-outline" size={26} color="#515151" />
        </View>
        <Text style={styles.tabText}>設定</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#d4ffbc',
    paddingVertical: 10,
    paddingBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 50,
  },
  iconContainer: {
    height: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 10,
    color: '#646464',
    marginTop: 4,
    fontWeight: '500',
  },
});