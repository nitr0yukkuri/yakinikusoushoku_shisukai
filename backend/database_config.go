package main

import "strings"

// Renderの環境変数に貼り付けた接続文字列を、pgxが解釈できる形に整える。
func normalizeDatabaseURL(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		first, last := value[0], value[len(value)-1]
		if (first == '\'' && last == '\'') || (first == '"' && last == '"') {
			value = strings.TrimSpace(value[1 : len(value)-1])
		}
	}
	return value
}
