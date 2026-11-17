#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instalá Node.js desde https://nodejs.org"; exit 1; }
(sleep 2; (open http://localhost:3000 || xdg-open http://localhost:3000) 2>/dev/null) &
node server.js
