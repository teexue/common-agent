#!/bin/sh
# Read lines from stdin, respond to JSON-RPC requests.
while IFS= read -r line; do
  method=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('method',''))" 2>/dev/null)
  id=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',0))" 2>/dev/null)

  case "$method" in
    initialize)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"mock\",\"version\":\"0.1\"}}}"
      ;;
    notifications/initialized)
      ;;
    tools/list)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"tools\":[{\"name\":\"echo\",\"description\":\"Echo tool\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"msg\":{\"type\":\"string\"}}}}]}}"
      ;;
    tools/call)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"echo result\"}]}}"
      ;;
    *)
      echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32601,\"message\":\"method not found\"}}"
      ;;
  esac
done
