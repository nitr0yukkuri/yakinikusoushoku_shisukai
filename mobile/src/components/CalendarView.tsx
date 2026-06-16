import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

import { LocaleConfig } from 'react-native-calendars';

// ▼ ここから追加：カレンダーの日本語化設定
LocaleConfig.locales['jp'] = {
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: '今日'
};
LocaleConfig.defaultLocale = 'jp'; // デフォルト言語を日本語に設定

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