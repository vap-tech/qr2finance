npm run build


npm install -g serve
  serve -s build

uvicorn app.main:app --reload

python -m app.initial_data -> create all tables
