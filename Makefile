.PHONY: all build frontend backend clean release \
	build-darwin-amd64 build-darwin-arm64 \
	build-linux-amd64 build-linux-arm64 \
	build-windows-amd64 build-windows-arm64

BIN_DIR := bin
BINARY  := agent-server
PKG     := ./cmd
CGO     := 0

# Release version, injected into core/version at build time.
# Defaults to a git tag (or "dev" when none is present); override with
# `make release VERSION=v1.2.3` (CI passes the release tag).
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

LDFLAGS := -s -w -X github.com/teexue/common-agent/core/version.Version=$(VERSION)

all: build

build: frontend backend

frontend:
	pnpm --dir frontend run build

backend:
	go build -ldflags "$(LDFLAGS)" -o $(BIN_DIR)/$(BINARY) $(PKG)

clean:
	rm -rf $(BIN_DIR)/ cmd/dist/*
	@touch cmd/dist/.gitkeep

# ── Cross-compile helpers ─────────────────────────────────────────

define GO_CROSS
	CGO_ENABLED=$(CGO) GOOS=$(1) GOARCH=$(2) \
		go build -ldflags "$(LDFLAGS)" -o $(BIN_DIR)/$(BINARY)-$(1)-$(2)$(3) $(PKG)
endef

build-darwin-amd64:
	$(call GO_CROSS,darwin,amd64,)

build-darwin-arm64:
	$(call GO_CROSS,darwin,arm64,)

build-linux-amd64:
	$(call GO_CROSS,linux,amd64,)

build-linux-arm64:
	$(call GO_CROSS,linux,arm64,)

build-windows-amd64:
	$(call GO_CROSS,windows,amd64,.exe)

build-windows-arm64:
	$(call GO_CROSS,windows,arm64,.exe)

# ── Cross-compile all platforms (frontend once) ───────────────────
# Usage: make release VERSION=v1.2.3

release: frontend \
	build-darwin-amd64 build-darwin-arm64 \
	build-linux-amd64 build-linux-arm64 \
	build-windows-amd64 build-windows-arm64
	@echo ""
	@echo "Built version: $(VERSION)"
	@echo "Artifacts in $(BIN_DIR)/:"
	@ls -lh $(BIN_DIR)/$(BINARY)-*
