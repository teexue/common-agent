package i18n

import "embed"

//go:embed locales/content/*.json locales/log/*.json
var localeFS embed.FS
