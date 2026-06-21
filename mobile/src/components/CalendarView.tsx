import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  scheduleData: Record<string, { id: string; title: string }[]>; // 予定データを受け取る
}

export const CalendarView: React.FC<CalendarViewProps> = ({ selectedDate, onDayPress, scheduleData }) => {
  return (
    <View style={styles.container}>
      <Calendar 
        onDayPress={onDayPress} 
        
        // ★ここを追加：カレンダーの文字を大きく、デザインを整える
        theme={{
          textDayFontSize: 18,       // 日付の文字サイズ（デフォルトより少し大きめ）
          textMonthFontSize: 22,     // 一番上の「〇月」の文字サイズ
          textDayHeaderFontSize: 15, // 曜日の文字サイズ
          todayTextColor: '#2330df', // 今日の日付をアプリの青色に
          arrowColor: '#2330df',     // 左右の矢印を青色に
        }}

        // ★ここがポイント：日付セルを丸ごとカスタマイズする
        dayComponent={({ date, state }) => {
          if (!date) return <View />;

          const dateString = date.dateString;
          const isSelected = dateString === selectedDate;
          const dailyEvents = scheduleData[dateString] || []; // その日の予定を取得

          return (
            <TouchableOpacity
              onPress={() => onDayPress(dateString)}
              style={[
                styles.dayCell,
                isSelected && styles.selectedDayCell // 選択時のスタイル
              ]}
            >
              {/* 日付の数字 */}
              <Text style={[
                styles.dayText,
                state === 'disabled' && styles.disabledText,
                state === 'today' && !isSelected && styles.todayText,
                isSelected && styles.selectedDayText
              ]}>
                {date.day}
              </Text>

              {/* 予定の表示エリア（最大2件まで表示） */}
              <View style={styles.eventsContainer}>
                {dailyEvents.slice(0, 2).map((event, index) => (
                  <Text key={index} style={styles.eventText} numberOfLines={1}>
                    {event.title}
                  </Text>
                ))}
                {dailyEvents.length > 2 && (
                  <Text style={styles.moreText}>他 {dailyEvents.length - 2}件</Text>
                )}
              </View>
            </TouchableOpacity>
          );
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
    height: 520, 
    width: '100%',
    justifyContent: 'center',
  },
  // カレンダーの1マスのスタイル
  dayCell: {
    width: 46,
    height: 60, // 予定を表示するため少し縦長に
    alignItems: 'center',
    paddingTop: 4,
    borderRadius: 8,
  },
  selectedDayCell: {
    backgroundColor: '#e2fbe2', // 選択時の背景色
    borderColor: '#4d6048',
    borderWidth: 1,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  todayText: {
    color: '#2330df',
    fontWeight: 'bold',
  },
  selectedDayText: {
    fontWeight: 'bold',
    color: '#1f1f1f',
  },
  disabledText: {
    color: '#c0c0c0',
  },
  eventsContainer: {
    marginTop: 2,
    width: '100%',
    alignItems: 'center',
    gap: 2,
  },
  eventText: {
    fontSize: 9,
    color: '#fff',
    backgroundColor: '#ff9800', // 予定のラベル色
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    width: '95%',
    textAlign: 'center',
    overflow: 'hidden',
  },
  moreText: {
    fontSize: 8,
    color: '#888',
  }
});