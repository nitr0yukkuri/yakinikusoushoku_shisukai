import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface CalendarViewProps {
  selectedDate: string;
  onDayPress: (day: any) => void;
  markedDates: any;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ selectedDate, onDayPress, markedDates }) => {
  return (
    <View style={styles.container}>
      <Calendar 
        onDayPress={onDayPress} 
        markedDates={markedDates}
        
        // ★ここを追加：カレンダーの文字を大きく、デザインを整える
        theme={{
          textDayFontSize: 18,       // 日付の文字サイズ（デフォルトより少し大きめ）
          textMonthFontSize: 22,     // 一番上の「〇月」の文字サイズ
          textDayHeaderFontSize: 15, // 曜日の文字サイズ
          todayTextColor: '#2330df', // 今日の日付をアプリの青色に
          arrowColor: '#2330df',     // 左右の矢印を青色に
        }}
        
        // ★ここを追加：カレンダー自体のスタイル
        style={{
          height: 400, // カレンダー本体の高さを広げる
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    // ★ここを変更：350 から 450 に広げて余白を埋める
    height: 450, 
    width: '100%',
    justifyContent: 'center',
  }
});