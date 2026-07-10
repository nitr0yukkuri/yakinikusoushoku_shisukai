import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert, // ★追加
} from 'react-native';
import { useRouter } from 'expo-router';

import { AppMap } from '../components/AppMap';
import { ArrivalTimeBadge } from '../components/ArrivalTimeBadge';
import { CalendarView } from '../components/CalendarView';
import { Footer } from '../components/Footer';
import { 
  FriendPanel, 
  FriendSearchPanel, 
  FriendQRPanel ,
  FriendRequestsPanel
} from '../components/FriendPanel';
import MeetupSettingForm from '../components/meetupSettingForm';
import { NotificationPanel } from '../components/NotificationPanel';
import PastimeSpotPanel from '../components/PastimeSpotPanel';
import { Popup } from '../components/Popup';
import ProfileEditSection from '../components/ProfileEditSection';
import { ProfileAvatar } from '../components/ProfileAvatar';
import SettingsPanel from '../components/SettingsPanel';
import SystemSettingsPanel from '../components/SystemSettingsPanel';
import PastimeSettingsPanel from '../components/PastimeSettingsPanel';
import { useProfile } from '../contexts/profile-context';
import { useMeetupSession } from '../hooks/use-meetup-session';
import { useNotifications } from '../hooks/use-notifications';
import { getProfileImageSignature } from '../utils/profile-image';

const arriveButtonDistanceMeters = 100;

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

const distanceInMeters = (origin: MapCoordinate, destination: MapCoordinate) => {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const latitude1 = toRadians(origin.latitude);
  const latitude2 = toRadians(destination.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile, avatarUrl, token } = useProfile();
  
  // ★追加：allArrived, arrivedUsers, sendArrival を受け取る
  const {
    activeMeetup,
    etaMinutes,
    routePolyline,
    allArrived,
    arrivedUsers,
    sendArrival,
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
  const [isProfilePopupVisible, setProfilePopupVisible] = useState(false);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isSystemVisible, setSystemVisible] = useState(false);
  const [isPastimeVisible, setPastimeVisible] = useState(false);
  const [isCalendarPopupVisible, setCalendarPopupVisible] = useState(false);
  const [isMeetupSettingVisible, setMeetupSettingVisible] = useState(false);
  const [isFriendPopupVisible, setFriendPopupVisible] = useState(false);
  const [isSpotPopupVisible, setSpotPopupVisible] = useState(false);
  const [isFriendSearchVisible, setFriendSearchVisible] = useState(false);
  const [isFriendQRVisible, setFriendQRVisible] = useState(false);
  const [isFriendRequestsVisible, setFriendRequestsVisible] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [editingMeetupId, setEditingMeetupId] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<MapCoordinate | null>(null);

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
  const handleCurrentLocationChange = useCallback((
    coordinate: MapCoordinate,
    options?: { forceETARefresh?: boolean },
  ) => {
    setCurrentLocation(coordinate);
    reportCurrentLocation(coordinate, options);
  }, [reportCurrentLocation]);
  const isAnyPopupVisible = isPopupVisible
    || isProfilePopupVisible
    || isSettingsVisible
    || isSystemVisible
    || isPastimeVisible
    || isCalendarPopupVisible
    || isMeetupSettingVisible
    || isFriendPopupVisible
    || isSpotPopupVisible
    || isFriendSearchVisible
    || isFriendQRVisible
    || isFriendRequestsVisible;
  const shouldShowArriveButton = (() => {
    if (!activeMeetup || isAnyPopupVisible || arrivedUsers.includes(profile?.userId || '')) {
      return false;
    }
    if (!activeMeetupLocation || !currentLocation) {
      return false;
    }
    return distanceInMeters(currentLocation, activeMeetupLocation) <= arriveButtonDistanceMeters;
  })();

  const hasEvents = selectedEvents.length > 0;

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
        routePolyline={routePolyline}
        hideSharedLocations={allArrived}
        onCurrentLocationChange={handleCurrentLocationChange}
        onWebSocketDisconnect={reconnectWebSocket}
      />
      
      {/* ★変更：etaMinutes が null になれば非表示になる */}
      {activeMeetup && etaMinutes !== null && !isAnyPopupVisible ? (
        <ArrivalTimeBadge minutes={etaMinutes} style={styles.arrivalBadge} />
      ) : null}

      {/* ★追加：自分が到着していない間だけ「到着ボタン」を表示する */}
      {shouldShowArriveButton && (
        <View style={styles.arriveButtonContainer} pointerEvents="box-none">
          <TouchableOpacity 
            style={styles.arriveButton}
            onPress={() => {
              sendArrival();
              Alert.alert("共有しました", "全員がそろうとタイマーが消えます。");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.arriveButtonText}>到着!</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <FriendPanel 
              onOpenSearch={() => setFriendSearchVisible(true)}
              onOpenQR={() => setFriendQRVisible(true)}
              onOpenRequests={() => setFriendRequestsVisible(true)}
              pauseAutoRefresh={isFriendSearchVisible || isFriendQRVisible || isFriendRequestsVisible}
            />
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
            visible={isFriendSearchVisible}
            onClose={() => setFriendSearchVisible(false)}
            title="ID検索"
            icon="person-add-outline"
            slideDirection="right"
            showBackButton
          >
            <FriendSearchPanel />
          </Popup>

          <Popup
            visible={isFriendQRVisible}
            onClose={() => setFriendQRVisible(false)}
            title="マイQRコード"
            icon="qr-code-outline"
            slideDirection="right"
            showBackButton
          >
            <FriendQRPanel />
          </Popup>

          <Popup
            visible={isFriendRequestsVisible}
            onClose={() => setFriendRequestsVisible(false)}
            title="保留中の申請"
            icon="mail-unread-outline"
            slideDirection="right"
            showBackButton
          >
            <FriendRequestsPanel />
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
            <SystemSettingsPanel />
          </Popup>

          <Popup
            visible={isPastimeVisible}
            onClose={() => setPastimeVisible(false)}
            title="好きな暇つぶし"
            icon="cafe-outline"
            slideDirection="right"
            showBackButton
          >
            <PastimeSettingsPanel />
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
    zIndex: 1,
    elevation: 1,
  },
  // ★追加：到着ボタンのスタイル
  arriveButtonContainer: {
    position: 'absolute',
    bottom: 110, // フッターに被らない高さ
    alignSelf: 'center',
    zIndex: 2,
    elevation: 2,
  },
  arriveButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#267a3f',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  arriveButtonLabel: {
    color: '#526057',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  arriveButtonText: {
    color: '#267a3f',
    fontSize: 18,
    fontWeight: 'bold',
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
});
