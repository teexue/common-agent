//go:build windows

package builtin

import "golang.org/x/sys/windows"

func hostACP() uint32 { return windows.GetACP() }
