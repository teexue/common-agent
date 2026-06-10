.PHONY: all build frontend backend clean

all: build

build: frontend backend

frontend:
	pnpm --dir frontend run build

backend:
	go build -o bin/agent-server ./cmd

clean:
	rm -rf bin/ cmd/dist/*
	@touch cmd/dist/.gitkeep
