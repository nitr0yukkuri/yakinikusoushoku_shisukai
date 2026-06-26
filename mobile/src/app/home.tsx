import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppMap } from '../components/AppMap';
import { ArrivalTimeBadge } from '../components/ArrivalTimeBadge';
import { CalendarView } from '../components/CalendarView';
import { Footer } from '../components/Footer';
import { FriendPanel } from '../components/FriendPanel';
import MeetupSettingForm from '../components/meetupSettingForm';
import { NotificationPanel } from '../components/NotificationPanel';
import PastimeSpotPanel from '../components/PastimeSpotPanel';
import { Popup } from '../components/Popup';
import ProfileEditSection from '../components/ProfileEditSection';
import { ProfileAvatar } from '../components/ProfileAvatar';
import SettingsPanel from '../components/SettingsPanel';
import { useProfile } from '../contexts/profile-context';
import { useMeetupSession } from '../hooks/use-meetup-session';
import { useNotifications } from '../hooks/use-notifications';
import { getProfileImageSignature } from '../utils/profile-image';

const pastimeOptions = [
  'カフェ',
  'カラオケ',
  'ファミレス',
  'ゲーム',
  'ジム',
];

export default function HomeScreen() {
  const router = useRouter();
  const { profile, avatarUrl, logout, token } = useProfile();
  const {
    activeMeetup,
    etaMinutes,
    meetups,
    reconnectWebSocket,
    refreshMeetups,
    reportCurrentLocation,
    respondToInvite,
    scheduleData,
    wsTicket,
  } = useMeetupSession(token, profile?.userId);
  const {
    error: notificationError,
    isLoading: isLoadingNotifications,
    markAllRead,
    notifications,
    refresh: refreshNotifications,
    respondToFriendRequest,
    unreadCount,
  } = useNotifications(token);

  const [isPopupVisible, setPopupVisible] = useState(false);
  const [isProfilePopupVisible, setProfilePopupVisible] =
    useState(false);
  const [isSettingsVisible, setSettingsVisible] =
    useState(false);
  const [isSystemVisible, setSystemVisible] = useState(false);
  const [isPastimeVisible, setPastimeVisible] =
    useState(false);
  const [isCalendarPopupVisible, setCalendarPopupVisible] =
    useState(false);
  const [isMeetupSettingVisible, setMeetupSettingVisible] =
    useState(false);
  const [isFriendPopupVisible, setFriendPopupVisible] =
    useState(false);
  const [isSpotPopupVisible, setSpotPopupVisible] =
    useState(false);

  const [selectedPastimes, setSelectedPastimes] = useState<
    string[]
  >([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [editingMeetupId, setEditingMeetupId] = useState<number | null>(null);

  const selectedEvents = selectedDate
    ? scheduleData[selectedDate] || []
    : [];
  const selectedMeetups = selectedEvents.flatMap((event) => {
    const meetup = meetups.find((item) => String(item.id) === event.id);
    return meetup ? [meetup] : [];
  });
  const selectedInvitedMeetup = selectedMeetups
    .find((meetup) => meetup?.membershipStatus === 'invited');
  const selectedOwnedMeetup = selectedMeetups
    .find((meetup) => meetup.ownerUserId === profile?.userId);
  const selectedEditableMeetup = selectedOwnedMeetup || selectedMeetups
    .find((meetup) => meetup.membershipStatus === 'accepted');
  const editingMeetup = editingMeetupId === null
    ? null
    : meetups.find((meetup) => meetup.id === editingMeetupId) || null;
  const activeMeetupLocation = useMemo(() => activeMeetup ? {
    latitude: activeMeetup.latitude,
    longitude: activeMeetup.longitude,
  } : null, [activeMeetup]);

  const hasEvents = selectedEvents.length > 0;

  const togglePastime = (option: string) => {
    setSelectedPastimes((previous) =>
      previous.includes(option)
        ? previous.filter((item) => item !== option)
        : [...previous, option],
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleDayPress = (dateString: string) => {
    setSelectedDate(dateString);
    setEditingMeetupId(null);
  };

  return (
    <View style={styles.container}>
      <AppMap
        style={styles.map}
        roomId={activeMeetup ? `meetup:${activeMeetup.id}` : undefined}
        wsTicket={wsTicket}
        userId={profile?.userId}
        userName={profile?.name}
        profileImage={avatarUrl || undefined}
        followCurrentLocation
        selectedLocation={activeMeetupLocation}
        onCurrentLocationChange={reportCurrentLocation}
        onWebSocketDisconnect={reconnectWebSocket}
      />
      {activeMeetup && etaMinutes !== null ? (
        <ArrivalTimeBadge minutes={etaMinutes} style={styles.arrivalBadge} />
      ) : null}

      <SafeAreaView
        style={styles.safeArea}
        pointerEvents="box-none"
      >
        <View
          style={styles.contentWrapper}
          pointerEvents="box-none"
        >
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/matsunya-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <TouchableOpacity
              style={styles.iconContainer}
              onPress={() => setProfilePopupVisible(true)}
              activeOpacity={0.7}
            >
              <ProfileAvatar
                key={`${profile?.name ?? ''}:${getProfileImageSignature(
                  avatarUrl,
                )}`}
                name={profile?.name}
                profileImage={avatarUrl}
                size={50}
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
          </View>

          <View
            style={styles.mainContent}
            pointerEvents="none"
          />

          <Popup
            visible={isPopupVisible}
            onClose={() => setPopupVisible(false)}
            title="通知"
          >
            <NotificationPanel
              notifications={notifications}
              isLoading={isLoadingNotifications}
              error={notificationError}
              onOpenFriends={() => {
                setPopupVisible(false);
                setFriendPopupVisible(true);
              }}
              onRespondRequest={respondToFriendRequest}
              onRespondMeetup={async (meetupId, action) => {
                await respondToInvite(meetupId, action);
                await refreshNotifications();
              }}
            />
          </Popup>

          <Popup
            visible={isFriendPopupVisible}
            onClose={() => setFriendPopupVisible(false)}
            title="フレンド"
            icon="people-outline"
          >
            <FriendPanel />
          </Popup>

          <Popup
            visible={isProfilePopupVisible}
            onClose={() => setProfilePopupVisible(false)}
            title="プロフィール設定"
            icon="person-outline"
          >
            <ProfileEditSection
              key={`${profile?.id ?? 'profile'}-${
                profile?.name ?? ''
              }-${profile?.bio ?? ''}-${getProfileImageSignature(
                avatarUrl,
              )}`}
              onSaveSuccess={() =>
                setProfilePopupVisible(false)
              }
            />
          </Popup>

          <Popup
            visible={isCalendarPopupVisible}
            onClose={() => setCalendarPopupVisible(false)}
            title="スケジュール"
            icon="calendar-outline"
          >
            <CalendarView
              selectedDate={selectedDate}
              onDayPress={handleDayPress}
              scheduleData={scheduleData}
            />

            <View style={styles.calendarActions}>
              {!selectedDate ? (
                <Text style={styles.noDateText}>
                  日付を選択してください
                </Text>
              ) : hasEvents ? (
                <View style={styles.calendarButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      styles.calendarRowButton,
                    ]}
                    onPress={() => {
                      setEditingMeetupId(null);
                      setMeetupSettingVisible(true);
                    }}
                  >
                    <Text style={styles.selectButtonText}>
                      予定を追加
                    </Text>
                  </TouchableOpacity>

                  {selectedInvitedMeetup || selectedEditableMeetup ? (
                    <TouchableOpacity
                      style={[
                        styles.selectButton,
                        styles.calendarRowButton,
                        styles.editButton,
                      ]}
                      onPress={() => {
                        if (selectedInvitedMeetup) {
                          respondToInvite(selectedInvitedMeetup.id, 'accept')
                            .catch((error) => console.warn('Failed to accept meetup invitation:', error));
                          return;
                        }
                        if (!selectedEditableMeetup) return;
                        setEditingMeetupId(selectedEditableMeetup.id);
                        setMeetupSettingVisible(true);
                      }}
                    >
                      <Text style={styles.selectButtonText}>
                        {selectedInvitedMeetup ? '参加' : '編集'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => {
                    setEditingMeetupId(null);
                    setMeetupSettingVisible(true);
                  }}
                >
                  <Text style={styles.selectButtonText}>
                    予定を追加
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Popup>

          <Popup
            visible={isMeetupSettingVisible}
            onClose={() =>
              setMeetupSettingVisible(false)
            }
            title="待ち合わせ詳細設定"
            icon="location-outline"
            slideDirection="right"
            showBackButton
          >
            <MeetupSettingForm
              key={editingMeetup ? `edit-${editingMeetup.id}` : `create-${selectedDate}`}
              selectedDate={selectedDate}
              existingMeetup={editingMeetup}
              onSave={(data) => {
                console.log('保存されたデータ:', data);
                refreshMeetups().catch((error) => console.warn('Failed to refresh meetups:', error));
                setEditingMeetupId(null);
                setMeetupSettingVisible(false);
              }}
              onDelete={() => {
                refreshMeetups().catch((error) => console.warn('Failed to refresh meetups:', error));
                setEditingMeetupId(null);
                setMeetupSettingVisible(false);
              }}
            />
          </Popup>

          <Popup
            visible={isSpotPopupVisible}
            onClose={() => setSpotPopupVisible(false)}
            title="暇つぶしスポット"
            icon="cafe-outline"
          >
            <PastimeSpotPanel />
          </Popup>

          <Popup
            visible={isSettingsVisible}
            onClose={() => setSettingsVisible(false)}
            title="設定"
            icon="settings-outline"
          >
            <SettingsPanel
              onOpenSystem={() =>
                setSystemVisible(true)
              }
              onOpenPastime={() =>
                setPastimeVisible(true)
              }
            />
          </Popup>

          <Popup
            visible={isSystemVisible}
            onClose={() => setSystemVisible(false)}
            title="システム設定"
            icon="settings-outline"
            slideDirection="right"
            showBackButton
          >
            <View style={styles.popupBody}>
              <Text style={styles.popupLabel}>
                メールアドレス
              </Text>

              <View style={styles.emailDisplay}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color="#6b706b"
                />
                <Text
                  style={styles.emailText}
                  numberOfLines={1}
                >
                  {profile?.email || ''}
                </Text>
              </View>

              <Text style={styles.deleteTitle}>
                アカウントを削除
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleLogout}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#b71c1c"
                />
                <Text style={styles.deleteButtonText}>
                  削除する
                </Text>
              </TouchableOpacity>
            </View>
          </Popup>

          <Popup
            visible={isPastimeVisible}
            onClose={() => setPastimeVisible(false)}
            title="好きな暇つぶし"
            icon="cafe-outline"
            slideDirection="right"
            showBackButton
          >
            <View style={styles.chipGrid}>
              {pastimeOptions.map((option) => {
                const isSelected =
                  selectedPastimes.includes(option);

                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.chip}
                    onPress={() => togglePastime(option)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#4d6048"
                        style={styles.checkIcon}
                      />
                    )}
                    <Text style={styles.chipText}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Popup>
        </View>

        <View style={styles.footerWrapper}>
          <Footer
            onPressFriend={() =>
              setFriendPopupVisible(true)
            }
            onPressNotification={() => {
              setPopupVisible(true);
              markAllRead()
                .then(refreshNotifications)
                .catch((error) => console.warn('Failed to refresh notifications:', error));
            }}
            notificationCount={unreadCount}
            onPressCalendar={() =>
              setCalendarPopupVisible(true)
            }
            onPressSpot={() =>
              setSpotPopupVisible(true)
            }
            onPressSettings={() =>
              setSettingsVisible(true)
            }
          />
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
  arrivalBadge: {
    position: 'absolute',
    top: 85,
    alignSelf: 'center',
    zIndex: 2,
    elevation: 2,
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
    paddingTop: 5,
  },
  logoImage: {
    width: 260,
    height: 90,
    marginLeft: -35,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#515151',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatar: {
    borderRadius: 25,
  },
  mainContent: {
    flex: 1,
  },
  calendarActions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  calendarButtonRow: {
    width: '90%',
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'center',
  },
  calendarRowButton: {
    flex: 1,
    width: undefined,
  },
  editButton: {
    backgroundColor: '#4d6048',
  },
  noDateText: {
    color: '#888888',
    marginTop: 15,
  },
  selectButton: {
    width: '80%',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#2330df',
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  popupBody: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  popupLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  emailDisplay: {
    width: '100%',
    height: 38,
    borderWidth: 1,
    borderColor: '#b7bdb7',
    backgroundColor: '#e6e9e6',
    paddingHorizontal: 10,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    color: '#6b706b',
    fontSize: 14,
    flex: 1,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 14,
  },
  deleteButton: {
    minWidth: 150,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#e57373',
    backgroundColor: '#ffcdd2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    color: '#b71c1c',
    fontSize: 15,
    fontWeight: '700',
  },
  chipGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 6,
    marginTop: 120,
  },
  chip: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#4d6048',
    backgroundColor: '#f6fff1',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  checkIcon: {
    position: 'absolute',
    left: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#1f1f1f',
    fontWeight: '600',
  },
});
