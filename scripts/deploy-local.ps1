param(
  [int]$Port = 5173
)

npm run build
npm run preview -- --port $Port --strictPort
