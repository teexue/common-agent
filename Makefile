.PHONY: all build frontend backend clean release \
	build-darwin-amd64 build-darwin-arm64 \
	build-linux-amd64 build-linux-arm64 \
	build-windows-amd64 build-windows-arm64

BIN_DIR := bin
BINARY  := agent-server
PKG     := ./cmd
CGO     := 0
LDFLAGS := -s -w

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
# Usage: make release

release: frontend \
	build-darwin-amd64 build-darwin-arm64 \
	build-linux-amd64 build-linux-arm64 \
	build-windows-amd64 build-windows-arm64
	@echo ""
	@echo "Artifacts in $(BIN_DIR)/:"
	@ls -lh $(BIN_DIR)/$(BINARY)-*
