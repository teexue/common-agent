package builtin

import (
	"unicode/utf8"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

// testCodePage overrides the Windows ANSI code page in tests. Zero means host.
var testCodePage uint32

func decodeConsole(b []byte) string {
	if len(b) == 0 || utf8.Valid(b) {
		return string(b)
	}
	if runtimeGOOS != "windows" {
		return string(b)
	}
	enc := encodingForCodePage(activeCodePage())
	if enc == nil {
		enc = simplifiedchinese.GB18030
	}
	if s, ok := decodeAs(b, enc); ok {
		return s
	}
	return string(b)
}

func activeCodePage() uint32 {
	if testCodePage != 0 {
		return testCodePage
	}
	if runtimeGOOS != "windows" {
		return 65001
	}
	return hostACP()
}

func encodingForCodePage(cp uint32) encoding.Encoding {
	switch cp {
	case 936, 54936:
		return simplifiedchinese.GB18030
	case 950:
		return traditionalchinese.Big5
	case 932:
		return japanese.ShiftJIS
	case 949:
		return korean.EUCKR
	default:
		return nil
	}
}

func decodeAs(b []byte, enc encoding.Encoding) (string, bool) {
	out, err := enc.NewDecoder().Bytes(b)
	if err != nil || !utf8.Valid(out) {
		return "", false
	}
	return string(out), true
}
