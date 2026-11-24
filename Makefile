.PHONY: up down test lint logs shell-backend

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && python -m pytest -v
	cd frontend && npm test

test-backend:
	cd backend && python -m pytest -v

test-frontend:
	cd frontend && npm test

lint:
	cd backend && python -m py_compile app/main.py app/config.py app/contracts.py \
		app/storage.py app/sessions.py app/chat.py app/routes.py \
		app/llm/cache.py app/llm/routing.py app/llm/attempts.py
	cd frontend && npm run lint

logs:
	docker compose logs -f

shell-backend:
	docker compose exec backend bash
