npm run build


npm install -g serve
  serve -s build

uvicorn app.main:app --reload
