//go:build !windows

package builtin

func hostACP() uint32 { return 65001 }
