package main

import (
	"net/http"
	"strings"
	"unicode"
)

var japaneseErrorMessages = map[string]string{
	"method not allowed":                                  "この操作には対応していません。",
	"not found":                                           "データが見つかりません。",
	"invalid json body":                                   "入力内容の形式が正しくありません。",
	"user not found":                                      "そのユーザーはいません。",
	"profile not found":                                   "プロフィールが見つかりません。",
	"friend not found":                                    "フレンドが見つかりません。",
	"already friends":                                     "すでにフレンドです。",
	"friend request already pending":                      "すでにフレンド申請中です。",
	"cannot send a friend request to yourself":            "自分自身にはフレンド申請できません。",
	"friend request not found":                            "フレンド申請が見つかりません。",
	"friend request is no longer pending":                 "このフレンド申請はすでに処理されています。",
	"only the requester can cancel this request":          "申請を取り消せるのは申請者だけです。",
	"only the recipient can respond to this request":      "この申請に対応できるのは受信者だけです。",
	"profile setup is required":                           "プロフィール設定が必要です。",
	"userId is already in use":                            "このユーザーIDはすでに使われています。",
	"userId and userName are required":                    "ユーザーIDとユーザーネームを入力してください。",
	"userId must be alphanumeric":                         "ユーザーIDは半角英数字またはアンダースコアで入力してください。",
	"valid userId is required":                            "正しいユーザーIDを入力してください。",
	"valid requestId is required":                         "正しい申請情報が必要です。",
	"action must be accept, reject, or cancel":            "申請の操作内容が正しくありません。",
	"meetup not found":                                    "待ち合わせが見つかりません。",
	"meetup access denied":                                "この待ち合わせを表示する権限がありません。",
	"meetup not found or not owned by you":                "待ち合わせが見つからないか、編集する権限がありません。",
	"valid meetup invitation not found":                   "有効な待ち合わせ招待が見つかりません。",
	"invitation not found":                                "待ち合わせの招待が見つかりません。",
	"member not found or not owned by you":                "メンバーが見つからないか、操作する権限がありません。",
	"invalid meetup status":                               "待ち合わせの状態が正しくありません。",
	"inviteCode is required":                              "招待コードを入力してください。",
	"action must be accept, decline, or remove":           "招待の操作内容が正しくありません。",
	"valid meetupId is required":                          "正しい待ち合わせ情報が必要です。",
	"origin is not allowed":                               "この接続元からは利用できません。",
	"invalid google id token":                             "Googleログイン情報が無効です。もう一度ログインしてください。",
	"Google client ID is not configured":                  "Googleログインの設定が完了していません。",
	"JWT_SECRET is not configured":                        "サーバーの認証設定が完了していません。",
	"idToken is required":                                 "Googleログイン情報が必要です。",
	"valid WebSocket ticket is required":                  "位置共有の認証情報が無効です。",
	"invalid token subject":                               "ログイン情報が無効です。もう一度ログインしてください。",
	"failed to calculate route":                           "経路を計算できませんでした。",
	"failed to resolve spot":                              "待ち合わせ場所を特定できませんでした。",
	"failed to read spot":                                 "スポット情報を取得できませんでした。",
	"failed to search nearby spots":                       "周辺スポットを検索できませんでした。",
	"failed to search spots":                              "スポットを検索できませんでした。",
	"notification not found":                              "通知が見つかりません。",
	"notificationId or all is required":                   "更新する通知を指定してください。",
	"valid placeId is required":                           "正しい場所情報が必要です。",
	"valid origin coordinates are required":               "現在地の位置情報が正しくありません。",
	"travelMode must be DRIVE, WALK, BICYCLE, or TRANSIT": "移動方法の指定が正しくありません。",
	"bufferMinutes must be between 0 and 30":              "余裕時間は0分から30分の間で指定してください。",
	"radius must be between 50 and 5000 meters":           "検索範囲は50mから5000mの間で指定してください。",
	"radius must be between 50 and 50000 meters":          "検索範囲は50mから50000mの間で指定してください。",
	"limit must be between 1 and 20":                      "表示件数は1件から20件の間で指定してください。",
	"q must be between 1 and 100 characters":              "検索文字は1文字から100文字で入力してください。",
}

func localizeErrorMessage(status int, message string) string {
	trimmed := strings.TrimSpace(message)
	if translated, ok := japaneseErrorMessages[trimmed]; ok {
		return translated
	}
	if strings.HasPrefix(trimmed, "invited user must be your friend:") {
		return "招待する相手はフレンドである必要があります。"
	}
	if containsJapanese(trimmed) {
		return trimmed
	}

	switch status {
	case http.StatusBadRequest:
		return "入力内容が正しくありません。"
	case http.StatusUnauthorized:
		return "ログインが必要です。"
	case http.StatusForbidden:
		return "この操作を行う権限がありません。"
	case http.StatusNotFound:
		return "データが見つかりません。"
	case http.StatusMethodNotAllowed:
		return "この操作には対応していません。"
	case http.StatusConflict:
		return "現在の状態では操作できません。"
	case http.StatusBadGateway:
		return "外部サービスとの通信に失敗しました。"
	case http.StatusInternalServerError:
		return "サーバーでエラーが発生しました。"
	default:
		return "処理に失敗しました。"
	}
}

func containsJapanese(message string) bool {
	for _, r := range message {
		if unicode.In(r, unicode.Hiragana, unicode.Katakana, unicode.Han) {
			return true
		}
	}
	return false
}
