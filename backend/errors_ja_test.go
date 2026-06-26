package main

import (
	"net/http"
	"testing"
)

func TestLocalizeErrorMessage(t *testing.T) {
	tests := []struct {
		name    string
		status  int
		message string
		want    string
	}{
		{name: "known error", status: http.StatusConflict, message: "already friends", want: "すでにフレンドです。"},
		{name: "dynamic error", status: http.StatusBadRequest, message: "invited user must be your friend: taro", want: "招待する相手はフレンドである必要があります。"},
		{name: "preserves Japanese", status: http.StatusBadRequest, message: "日時を入力してください。", want: "日時を入力してください。"},
		{name: "hides unknown internal detail", status: http.StatusInternalServerError, message: "database connection refused", want: "サーバーでエラーが発生しました。"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := localizeErrorMessage(test.status, test.message); got != test.want {
				t.Fatalf("localizeErrorMessage() = %q, want %q", got, test.want)
			}
		})
	}
}
